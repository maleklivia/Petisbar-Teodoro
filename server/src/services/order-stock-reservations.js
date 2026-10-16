import { expandProductTechnicalSheet } from './technical-sheet-components.js';

const roundStock=value=>Math.round((Number(value)+Number.EPSILON)*1000)/1000;

function sheetProductId(item){
  if(item.productId==='p-drk001'&&item.options?.flavor==='morango')return 'p-drk002';
  if(item.productId==='p-drk001'&&item.options?.flavor==='maracuja')return 'p-drk003';
  if(item.productId==='p-pet001'&&item.options?.size==='G')return 'p-pet006';
  if(item.productId==='p-pet002'&&item.options?.size==='G')return 'p-pet007';
  if(item.productId==='p-drk010'&&item.options?.size==='700ml')return 'p-drk011';
  return item.productId;
}

export async function reserveOrderStock(client,{orderId,items,allowWithoutStock=false}){
  if(allowWithoutStock)return {reserved:false,testMode:true};
  const productTotals=new Map();
  for(const item of items){
    const effects=item.options?._stockEffects||[],replacement=effects.find(effect=>effect.mode==='replace');
    const mainId=replacement?.productId||item.productId,mainStock=replacement?.currentStock??item.currentStock;
    const components=[{productId:mainId,currentStock:mainStock,name:item.name},...effects.filter(effect=>effect.mode==='add').map(effect=>({productId:effect.productId,currentStock:effect.currentStock,name:item.name}))];
    for(const component of components){const current=productTotals.get(component.productId)||{name:component.name,quantity:0,currentStock:component.currentStock};current.quantity+=Number(item.quantity);productTotals.set(component.productId,current);}
  }
  for(const [productId,item] of productTotals){
    if(item.currentStock===null)continue;
    const reserved=await client.query("SELECT COALESCE(SUM(quantity),0) AS quantity FROM order_stock_reservations WHERE product_id=$1 AND status='reserved'",[productId]);
    const available=Number(item.currentStock)-Number(reserved.rows[0].quantity);
    if(available<item.quantity)return {error:'insufficient_stock',item:item.name,required:item.quantity,available};
  }
  const ingredientTotals=new Map();
  for(const item of items){
    const effects=item.options?._stockEffects||[],replacement=effects.find(effect=>effect.mode==='replace');
    const productIds=[replacement?.productId||sheetProductId(item),...effects.filter(effect=>effect.mode==='add').map(effect=>effect.productId)];
    for(const productId of [...new Set(productIds)]){
      const expanded=await expandProductTechnicalSheet(client,productId,Number(item.quantity));
      if(expanded?.error)return expanded;
      for(const ingredient of expanded?.items||[]){const current=ingredientTotals.get(ingredient.ingredientId)||{name:ingredient.name,unit:ingredient.unit,quantity:0};current.quantity+=ingredient.quantity;ingredientTotals.set(ingredient.ingredientId,current);}
    }
    if(item.options?.flavoredIce){
      const ice=await client.query("SELECT id,name,unit,active FROM ingredients WHERE id='i-029'");
      if(!ice.rowCount||!ice.rows[0].active)return {error:'stock_recipe_incomplete',item:'Gelo saborizado'};
      const current=ingredientTotals.get('i-029')||{name:ice.rows[0].name,unit:ice.rows[0].unit,quantity:0};
      current.quantity+=Number(item.quantity);ingredientTotals.set('i-029',current);
    }
  }
  const ingredientIds=[...ingredientTotals.keys()].sort();
  if(ingredientIds.length){
    const locked=await client.query('SELECT id,name,unit,current_stock,active FROM ingredients WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[ingredientIds]);
    if(locked.rowCount!==ingredientIds.length)return {error:'stock_recipe_incomplete'};
    for(const ingredient of locked.rows){
      if(!ingredient.active)return {error:'stock_recipe_incomplete',item:ingredient.name};
      const needed=roundStock(ingredientTotals.get(ingredient.id).quantity);
      const reserved=await client.query("SELECT COALESCE(SUM(quantity),0) AS quantity FROM order_stock_reservations WHERE ingredient_id=$1 AND status='reserved'",[ingredient.id]);
      const available=Number(ingredient.current_stock)-Number(reserved.rows[0].quantity);
      if(available<needed)return {error:'insufficient_ingredient_stock',item:ingredient.name,required:needed,available,unit:ingredient.unit};
    }
  }
  for(const [productId,item] of productTotals){
    if(item.currentStock===null)continue;
    await client.query(`INSERT INTO order_stock_reservations(order_id,product_id,quantity,unit) VALUES($1,$2,$3,'un')`,[orderId,productId,item.quantity]);
  }
  for(const [ingredientId,item] of ingredientTotals){
    await client.query(`INSERT INTO order_stock_reservations(order_id,ingredient_id,quantity,unit) VALUES($1,$2,$3,$4)`,[orderId,ingredientId,roundStock(item.quantity),item.unit]);
  }
  return {reserved:true,products:productTotals.size,ingredients:ingredientTotals.size};
}

export async function setOrderReservationsStatus(client,orderId,status){
  await client.query("UPDATE order_stock_reservations SET status=$2,updated_at=now() WHERE order_id=$1 AND status='reserved'",[orderId,status]);
}
