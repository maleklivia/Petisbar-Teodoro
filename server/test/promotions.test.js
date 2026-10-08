import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePromotions, couponCanStack } from '../src/services/promotions.js';

const comboId='11111111-1111-4111-8111-111111111111';
const groupId='22222222-2222-4222-8222-222222222222';
const percentId='33333333-3333-4333-8333-333333333333';
const fixedId='44444444-4444-4444-8444-444444444444';

function fakeDb({promotions=[],groups=[],products=[],costs=[],variants=[]}={}){
  return {async query(sql,params=[]){
    if(sql.includes('FROM promotions p'))return {rows:promotions};
    if(sql.includes('FROM promotion_groups g'))return {rows:groups};
    if(sql.includes('LEFT JOIN technical_sheets'))return {rows:costs};
    if(sql.includes('SELECT id,name,category,sale_price,current_stock'))return {rows:products.filter(product=>params[0].includes(product.id))};
    if(sql.includes('SELECT id,sale_price FROM products'))return {rows:variants.filter(product=>params[0].includes(product.id))};
    if(sql.includes('SELECT * FROM promotions WHERE id=ANY'))return {rows:promotions.filter(promotion=>params[0].includes(promotion.id)).map(promotion=>({
      id:promotion.id,code:promotion.code,rule_type:promotion.rule_type,priority:promotion.priority,
      discount_percent:promotion.discount_percent,discount_amount:promotion.discount_amount,combo_price:promotion.combo_price,
      cmv_estimate_percent:promotion.cmv_estimate_percent??null,
      stack_with_coupon:promotion.stack_with_coupon,active:true,starts_at:null,ends_at:null,
    }))};
    throw new Error(`Unexpected SQL: ${sql}`);
  }};
}

function promo(id,{code=id,rule_type='combo',priority=100,combo_price=18,discount_percent=null,discount_amount=null,cmv_estimate_percent=null,stack_with_coupon=false,products:targetProducts=[],starts_at=null,ends_at=null}={}){
  return {id,code,name:code,description:'',rule_type,priority,combo_price,discount_percent,discount_amount,stack_with_coupon,
    cmv_estimate_percent,active:true,starts_at,ends_at,products:targetProducts};
}

function group(promotionId,{products:allowed=[{id:'beer',name:'Cerveja',category:'Cervejas',salePrice:10,surcharge:0,active:true,allowedOptions:{}}]}={}){
  return {id:groupId,promotion_id:promotionId,code:'bebidas',name:'Bebidas',required_quantity:2,max_quantity:2,
    allow_same_product:true,allowed_options:{},products:allowed};
}

const beerProduct={id:'beer',name:'Cerveja',category:'Cervejas',sale_price:'10.00',current_stock:null};
const beerCost={id:'beer',purchase_cost:'3.00',ingredient_count:0,incomplete_count:0,recipe_cost:'0'};

test('combo recalcula preço fechado no servidor e preserva duas escolhas do mesmo produto',async()=>{
  const database=fakeDb({promotions:[promo(comboId)],groups:[group(comboId)],products:[beerProduct],costs:[beerCost]});
  const result=await calculatePromotions(database,[],[{promotionId:comboId,selections:[{groupId,items:[
    {productId:'beer',quantity:1,options:{}},{productId:'beer',quantity:1,options:{}},
  ]}]}]);
  assert.equal(result.subtotal,20);
  assert.equal(result.promotionDiscount,2);
  assert.equal(result.items.length,2);
  assert.deepEqual(result.items.map(item=>item.productId),['beer','beer']);
  assert.deepEqual(result.items.map(item=>item.listUnitPrice),[10,10]);
  assert.deepEqual(result.items.map(item=>item.unitPrice),[9,9]);
  assert.equal(result.items[0].promotionApplicationId,result.items[1].promotionApplicationId);
  assert.equal(couponCanStack(result),false);
});

test('recusa grupos incompletos e produto não permitido; permite instâncias em conjuntos distintos',async()=>{
  const database=fakeDb({promotions:[promo(comboId)],groups:[group(comboId)],products:[beerProduct],costs:[beerCost]});
  assert.equal((await calculatePromotions(database,[],[{promotionId:comboId,selections:[]}])).error,'combo_group_required');
  assert.equal((await calculatePromotions(database,[],[{promotionId:comboId,selections:[{groupId,items:[{productId:'other',quantity:2,options:{}}]}]}])).error,'combo_product_not_allowed');
  const selected={promotionId:comboId,selections:[{groupId,items:[{productId:'beer',quantity:2,options:{}}]}]};
  const repeated=await calculatePromotions(database,[],[selected,selected]);
  assert.equal(repeated.promotions.length,2);
  assert.equal(repeated.promotionDiscount,4);
  assert.notEqual(repeated.promotions[0].id,repeated.promotions[1].id);
  assert.equal(repeated.promotions[0].comboGroups.length,2);
  assert.equal(repeated.promotions[1].comboGroups.length,2);
});

test('rejeita preço fechado que ultrapassa o valor normal dos componentes',async()=>{
  const database=fakeDb({promotions:[promo(comboId,{combo_price:21})],groups:[group(comboId)],products:[beerProduct],costs:[beerCost]});
  const result=await calculatePromotions(database,[],[{promotionId:comboId,selections:[{groupId,items:[
    {productId:'beer',quantity:2,options:{}},
  ]}]}]);
  assert.equal(result.error,'combo_price_exceeds_normal');
  assert.equal(result.normalPrice,20);
});

test('ordena promoções concorrentes pela prioridade e nunca reaproveita a unidade',async()=>{
  const percent=promo(percentId,{code:'A-PERCENT',rule_type:'percentage',priority:20,discount_percent:10,stack_with_coupon:true,products:[{id:'beer',name:'Cerveja',salePrice:10}]});
  const fixed=promo(fixedId,{code:'B-FIXED',rule_type:'fixed',priority:10,discount_amount:2,products:[{id:'beer',name:'Cerveja',salePrice:10}]});
  const database=fakeDb({promotions:[percent,fixed],products:[beerProduct],costs:[beerCost]});
  const result=await calculatePromotions(database,[{productId:'beer',quantity:2,options:{}}]);
  assert.equal(result.promotions.length,1);
  assert.equal(result.promotions[0].code,'A-PERCENT');
  assert.equal(result.promotionDiscount,2);
  assert.equal(result.rejectedPromotions[0].reason,'priority_conflict');
  assert.equal(couponCanStack(result),true);
});

test('o mesmo carrinho usa preços normais atuais e cupons não acumulam por padrão',async()=>{
  const discount=promo(percentId,{code:'PROMO10',rule_type:'percentage',priority:10,discount_percent:10,products:[{id:'beer',name:'Cerveja',salePrice:12}]});
  const database=fakeDb({promotions:[discount],products:[{...beerProduct,sale_price:'12.00'}],costs:[beerCost]});
  const result=await calculatePromotions(database,[{productId:'beer',quantity:1,options:{}}]);
  assert.equal(result.subtotal,12);
  assert.equal(result.promotionDiscount,1.2);
  assert.equal(couponCanStack(result),false);
});

test('informa promoção automática expirada e bloqueia combo ainda não iniciado',async()=>{
  const beerTarget={id:'beer',name:'Cerveja',salePrice:10};
  const expired=promo(percentId,{code:'EXPIRED',rule_type:'percentage',discount_percent:10,products:[beerTarget],ends_at:new Date(Date.now()-60000).toISOString()});
  const database=fakeDb({promotions:[expired],products:[beerProduct],costs:[beerCost]});
  const result=await calculatePromotions(database,[{productId:'beer',quantity:1,options:{}}]);
  assert.equal(result.rejectedPromotions[0].reason,'promotion_expired');

  const future=promo(comboId,{starts_at:new Date(Date.now()+60000).toISOString()});
  const futureDb=fakeDb({promotions:[future],groups:[group(comboId)],products:[beerProduct],costs:[beerCost]});
  const combo=await calculatePromotions(futureDb,[],[{promotionId:comboId,selections:[]}]);
  assert.equal(combo.error,'promotion_not_started');
});

test('mantém duas opções da caipirinha como duas linhas com preços atuais distintos',async()=>{
  const promotion=promo(comboId,{combo_price:30.2,cmv_estimate_percent:35});
  const allowed={id:'p-drk001',name:'Caipirinha',category:'Drinks',salePrice:15.9,surcharge:0,active:true,
    allowedOptions:{flavor:['natural','morango','maracuja']}};
  const beerGroup={...group(comboId,{products:[allowed]}),allowed_options:{flavor:['natural','morango','maracuja']},required_quantity:2,max_quantity:2};
  const database=fakeDb({promotions:[promotion],groups:[beerGroup],products:[{id:'p-drk001',name:'Caipirinha',category:'Drinks',sale_price:'15.90',current_stock:null}],
    variants:[{id:'p-drk002',sale_price:'16.90'}],costs:[{...beerCost,id:'p-drk001',purchase_cost:'5.00'}]});
  const result=await calculatePromotions(database,[],[{promotionId:comboId,selections:[{groupId,items:[
    {productId:'p-drk001',quantity:1,options:{flavor:'natural'}},{productId:'p-drk001',quantity:1,options:{flavor:'morango'}},
  ]}]}]);
  assert.equal(result.subtotal,32.8);
  assert.equal(result.items.length,2);
  assert.deepEqual(result.items.map(item=>item.listUnitPrice),[15.9,16.9]);
  assert.equal(result.promotionDiscount,1.6);
  assert.equal(result.promotions[0].price,31.2);
  assert.equal(result.promotions[0].estimatedCmvPercent,36.79);
});

test('cobra acréscimo de substituição sem transformar o acréscimo em desconto',async()=>{
  const premium={id:'premium',name:'Cerveja premium',category:'Cervejas',salePrice:12,surcharge:2,active:true,allowedOptions:{}};
  const standard={id:'beer',name:'Cerveja comum',category:'Cervejas',salePrice:10,surcharge:0,active:true,allowedOptions:{}};
  const promotion=promo(comboId,{combo_price:19});
  const selectedGroup={...group(comboId,{products:[standard,premium]}),required_quantity:2,max_quantity:2};
  const database=fakeDb({promotions:[promotion],groups:[selectedGroup],products:[beerProduct,{...beerProduct,id:'premium',name:'Cerveja premium',sale_price:'12.00'}],costs:[beerCost]});
  const result=await calculatePromotions(database,[],[{promotionId:comboId,selections:[{groupId,items:[
    {productId:'beer',quantity:1,options:{}},{productId:'premium',quantity:1,options:{}},
  ]}]}]);
  assert.equal(result.subtotal,22);
  assert.equal(result.promotionDiscount,1);
  assert.equal(result.promotions[0].price,21);
  assert.deepEqual(result.items.map(item=>item.listUnitPrice),[10,12]);
});
