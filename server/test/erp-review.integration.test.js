import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import {readFile} from 'node:fs/promises';
import argon2 from 'argon2';

const enabled=process.env.ERP_REVIEW_DATABASE_URL;
test('homologação real de API e PostgreSQL isolado',{skip:!enabled},async t=>{
  assert.match(enabled,/petisbar_review_/,'A homologação exige banco isolado com nome petisbar_review_');
  process.env.DATABASE_URL=enabled;process.env.NODE_ENV='test';process.env.APP_ORIGIN='http://localhost';
  process.env.COOKIE_SECRET=randomUUID()+randomUUID();
  process.env.IFOOD_ENABLED='false';process.env.MERCADOPAGO_ENABLED='false';process.env.AI_ENABLED='false';
  const {buildApp}=await import('../src/app.js');
  const {db}=await import('../src/db.js');
  const {applyPaymentSnapshot}=await import('../src/services/payment-reconciliation.js');
  const app=await buildApp();await app.ready();
  const tag=`review-${randomUUID()}`;let cookie='',requests=0;
  const call=async(method,url,payload,auth=true,expected=200)=>{
    const r=await app.inject({method,url:`/api/v1${url}`,payload,remoteAddress:`127.1.${Math.floor(requests/200)}.${++requests%200+1}`,headers:auth?{cookie}: {}});
    assert.equal(r.statusCode,expected,`${method} ${url}: ${r.body}`);return r.statusCode===204?null:r.json();
  };
  const q=(sql,params)=>db.query(sql,params);
  const role=await q("SELECT id FROM roles WHERE name='admin'");
  const admin=await q('INSERT INTO users(role_id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id',[role.rows[0].id,tag,`${tag}@example.invalid`,await argon2.hash(tag)]);
  const login=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email:`${tag}@example.invalid`,password:tag}});
  assert.equal(login.statusCode,200);cookie=login.headers['set-cookie'].split(';')[0];
  try{
    await t.test('autorização em todas as áreas e leituras administrativas',async()=>{
      for(const path of ['/products','/ingredients','/technical-sheets','/clients','/suppliers','/purchases','/stock/movements','/finance/entries','/reports/overview','/settings','/promotions','/coupons','/documents','/operations','/dashboard','/ai/snapshot','/accounting-fiscal/profile','/accounting-fiscal/documents','/accounting-fiscal/obligations','/accounting-fiscal/monthly-report?month=2026-10']){
        await call('GET',path,undefined,false,401);await call('GET',path);
      }
      await call('POST','/operations/tables',{number:''},true,400);
    });
    await t.test('lançamentos e arquivo fiscal são internos, persistentes e coerentes no resumo',async()=>{
      await call('POST','/finance/entries',{date:'2026-02-30',description:tag,category:'Outros',type:'Entrada',value:1},true,400);
      const expense=(await call('POST','/finance/entries',{date:'2099-01-10',description:tag,category:'Outros',type:'Saída',value:7},true,201)).data;
      assert.equal(expense.value,-7);
      const report=(await call('GET','/accounting-fiscal/monthly-report?month=2099-01')).data;
      assert.ok(report.entries.some(row=>row.description===tag&&row.value===-7));
      await call('DELETE',`/finance/entries/${expense.id}`,undefined,true,204);
      await call('PUT','/accounting-fiscal/profile',{razao:tag,fantasia:'Homologação isolada'});
      assert.equal((await call('GET','/accounting-fiscal/profile')).data.razao,tag);
      const document=(await call('POST','/accounting-fiscal/documents',{documentType:'entrada',issueDate:'2099-01-10',counterparty:tag,amount:7},true,201)).data;
      assert.ok((await call('GET','/accounting-fiscal/documents')).data.some(row=>row.id===document.id));
      await call('DELETE',`/accounting-fiscal/documents/${document.id}`,undefined,true,204);
      const obligation={competence:'2099-01-01',type:'das_mei',dueDate:'2099-02-20',amount:0,status:'aberta'};
      const saved=(await call('POST','/accounting-fiscal/obligations',obligation,true,201)).data;
      await call('POST','/accounting-fiscal/obligations',obligation,true,409);
      assert.equal((await call('PATCH',`/accounting-fiscal/obligations/${saved.id}`,{...obligation,status:'cancelada'})).data.status,'cancelada');
    });
    const ingredient=`i-${tag}`,product=`p-${tag}`;
    await t.test('cadastros, ficha e movimento de estoque com conversão e bloqueio de saldo',async()=>{
      await call('POST','/ingredients',{id:ingredient,nome:tag,categoria:'Teste',unidade:'kg',estoqueAtual:1,estoqueMinimo:0,custoUnitario:10},true,201);
      await call('POST','/products',{id:product,nome:tag,categoria:'Teste',precoVenda:25,estoqueAtual:null},true,201);
      await call('PUT',`/technical-sheets/${product}`,{rendimento:1,itens:[{ingredienteId:ingredient,quantidade:100,unidade:'g'}]});
      await call('POST','/stock/movements',{tipo:'entrada',ingredienteId:ingredient,quantidade:500,unidade:'g',data:'2026-10-22'},true,201);
      assert.equal(Number((await q('SELECT current_stock FROM ingredients WHERE id=$1',[ingredient])).rows[0].current_stock),1.5);
      await call('POST','/stock/movements',{tipo:'saida',ingredienteId:ingredient,quantidade:2,unidade:'kg',data:'2026-10-22'},true,409);
    });
    await t.test('foto e opções são gravadas atomicamente, recuperadas e protegidas por vínculo',async()=>{
      const variant=`v-${tag}`,owner=`o-${tag}`;
      await call('POST','/products',{id:variant,nome:tag+' variante',categoria:'Teste',precoVenda:15,estoqueAtual:10},true,201);
      const groups=[{key:'sabor',label:'Sabor',type:'radio',required:true,options:[{value:'tradicional',label:'Tradicional',priceMode:'replace',stockMode:'replace',priceProductId:variant}]}];
      const bytes=await readFile(new URL('../../assets/products/soda.jpg',import.meta.url));
      const payload={id:owner,sku:tag,nome:tag+' com foto',categoria:'Teste',precoVenda:10,peso:400,optionGroups:groups,foto:'data:image/jpeg;base64,'+bytes.toString('base64')};
      const saved=(await call('POST','/products',payload,true,201)).data;
      assert.deepEqual(saved.option_groups,groups);assert.match(saved.photo_url,/^\/api\/v1\/public\/products\//);
      assert.equal(Number(saved.weight_grams),400);assert.equal(saved.sku,tag);
      const usage=(await call('GET',`/products/${variant}/usage`)).data;
      assert.equal(usage.products[0].id,owner);assert.equal(usage.products[0].groupLabel,'Sabor');assert.equal(usage.products[0].optionLabel,'Tradicional');
      const photo=await app.inject({method:'GET',url:saved.photo_url});assert.equal(photo.statusCode,200);assert.deepEqual(photo.rawPayload,bytes);
      const cached=await app.inject({method:'GET',url:saved.photo_url,headers:{'if-none-match':photo.headers.etag}});assert.equal(cached.statusCode,304);
      await call('POST','/products',{id:variant,nome:tag,categoria:'Teste',precoVenda:15,ativo:false},true,409);
      await call('DELETE',`/products/${variant}`,undefined,true,409);
      await call('POST','/products',{...payload,foto:'data:image/jpeg;base64,YmFk'},true,400);
      assert.equal(Number((await q('SELECT octet_length(image_bytes) n FROM product_photo_assets WHERE product_id=$1',[owner])).rows[0].n),bytes.length);
      await call('POST','/products',{...payload,foto:null},true,201);
      assert.equal((await q('SELECT 1 FROM product_photo_assets WHERE product_id=$1',[owner])).rowCount,0);
    });
    await t.test('clientes e fornecedores preservam campos e vínculos',async()=>{
      const client=(await call('POST','/clients',{nome:tag,telefone:'21999999999',email:'',cpf:'',observacoes:'Teste',enderecos:[{rua:'Rua de teste',numero:'1',cidade:'Teste',estado:'RJ'}]},true,201)).data;
      assert.equal(client.enderecos.length,1);
      const supplier=(await call('POST','/suppliers',{nome:tag,categoria:'Outros'},true,201)).data;assert.ok(supplier.id);
    });
    await t.test('recebimento concorrente ocorre uma vez e converte custo e quantidade',async()=>{
      const p=(await call('POST','/purchases',{fornecedorNome:tag,status:'Pedido',itens:[{ingredienteId:ingredient,quantidade:500,unidade:'g',custoUnitario:.02}]},true,201)).data;
      await Promise.all([call('PATCH',`/purchases/${p.id}/status`,{status:'Recebido'}),call('PATCH',`/purchases/${p.id}/status`,{status:'Recebido'})]);
      const i=(await q('SELECT current_stock,unit_cost FROM ingredients WHERE id=$1',[ingredient])).rows[0];assert.equal(Number(i.current_stock),2);assert.equal(Number(i.unit_cost),20);
      assert.equal(Number((await q("SELECT count(*) FROM stock_movements WHERE reference=$1",[p.id])).rows[0].count),1);
      const draft=await call('POST','/purchases',{fornecedorNome:tag,status:'Rascunho',itens:[{nome:'Item sem vínculo 1',quantidade:1,unidade:'un',custoUnitario:2},{nome:'Item sem vínculo 2',quantidade:1,unidade:'un',custoUnitario:3}]},true,201);
      await call('PATCH',`/purchases/${draft.data.id}/status`,{status:'Cancelado'});
      await call('PATCH',`/purchases/${draft.data.id}/status`,{status:'Recebido'},true,409);
    });
    const publicOrder=(paymentMethod='Cartão na entrega')=>({idempotencyKey:randomUUID(),customer:{name:tag,phone:'21999999999'},fulfillmentType:'retirada',paymentMethod,items:[{productId:product,quantity:1,expectedUnitPrice:25,options:{}}]});
    // Keep the acceptance fixture open across midnight and late-night test runs.
    // Production still validates its actual configured schedule.
    const clockParts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const minuteOfDay=Number(clockParts.find(p=>p.type==='hour').value)*60+Number(clockParts.find(p=>p.type==='minute').value);
    const clockAt=offset=>{const minute=(minuteOfDay+offset+1440)%1440;return `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;};
    await call('PUT','/settings',{'storefront.isOpen':true,'storefront.hours':`Segunda à Domingo - ${clockAt(-60)} até ${clockAt(60)}`,'storefront.minimumOrder':1,'storefront.allowOrdersWithoutStockForTesting':false});
    let order;
    await t.test('pedido público, repetição concorrente, produção, retirada e estorno',async()=>{
      const payload={...publicOrder(),notes:'[TESTE SEM ESTOQUE] texto do cliente'};const orders=await Promise.all([call('POST','/public/orders',payload,false,201),call('POST','/public/orders',payload,false,201)]);assert.equal(orders[0].data.id,orders[1].data.id);order=orders[0].data;
      assert.equal(order.status,'Em Produção');
      await call('PATCH',`/orders/${order.id}/status`,{status:'Pronto'});
      // Altering a recipe after acceptance must not change the reservation snapshot.
      await call('PUT',`/technical-sheets/${product}`,{rendimento:1,itens:[{ingredienteId:ingredient,quantidade:300,unidade:'g'}]});
      await Promise.all([call('PATCH',`/orders/${order.id}/status`,{status:'Entregue'}),call('PATCH',`/orders/${order.id}/status`,{status:'Entregue'})]);
      assert.equal(Number((await q('SELECT current_stock FROM ingredients WHERE id=$1',[ingredient])).rows[0].current_stock),1.9);
      assert.equal(Number((await q("SELECT count(*) FROM financial_entries WHERE reference_id=$1 AND category='Vendas'",[order.id])).rows[0].count),1);
      await call('PATCH',`/orders/${order.id}/status`,{status:'Cancelado'});assert.equal(Number((await q('SELECT current_stock FROM ingredients WHERE id=$1',[ingredient])).rows[0].current_stock),2);
    });
    await t.test('Pix pendente só libera após recurso confirmado e taxa não duplica',async()=>{
      const o=(await call('POST','/public/orders',publicOrder('Pix'),false,201)).data;assert.equal(o.status,'Aguardando Pagamento');
      const id=`pay-${tag}`;await q("INSERT INTO order_payments(id,order_id,provider,method,status,gross_amount) VALUES($1,$2,'mercadopago','Pix','action_required',25)",[id,o.id]);
      const snapshot={status:'processed',statusDetail:'accredited',feeAmount:.25,payload:{external_reference:o.id,total_amount:'25.00',total_paid_amount:'25.00',live_mode:true}};
      const c=await db.connect();try{await c.query('BEGIN');await applyPaymentSnapshot(c,id,snapshot);await c.query('COMMIT');await c.query('BEGIN');await applyPaymentSnapshot(c,id,snapshot);await c.query('COMMIT');}finally{c.release();}
      assert.equal((await q('SELECT status FROM orders WHERE id=$1',[o.id])).rows[0].status,'Em Produção');
      assert.equal(Number((await q("SELECT count(*) FROM financial_entries WHERE effect_key=$1",[`payment-fee:${id}`])).rows[0].count),1);
    });
    await t.test('caixa concorrente, movimento repetido e fechamento auditável',async()=>{
      await q("UPDATE cash_sessions SET closed_at=now() WHERE closed_at IS NULL");
      const id=randomUUID();await Promise.all([call('POST','/operations/cash/open',{id,amount:100}),call('POST','/operations/cash/open',{id,amount:100})]);
      const move={id:randomUUID(),type:'saida',amount:10,reason:'Teste'};
      await Promise.all([call('POST',`/operations/cash/${id}/movements`,move),call('POST',`/operations/cash/${id}/movements`,move)]);
      const closed=(await call('POST',`/operations/cash/${id}/close`,{amount:90})).data;assert.equal(Number(closed.expected_amount),90);
      await call('POST',`/operations/cash/${id}/movements`,{...move,id:randomUUID()},true,409);
    });
    await t.test('mesas, entregadores, documentos e cupons persistem e validam dados',async()=>{
      const table=(await call('POST','/operations/tables',{number:tag.slice(0,20)})).data;
      await call('PATCH',`/operations/tables/${table.id}`,{status:'ocupada'});
      const driver=(await call('POST','/operations/drivers',{name:tag})).data;await call('PATCH',`/operations/drivers/${driver.id}`,{available:false});
      const document=(await call('POST','/documents',{titulo:tag,categoria:'Manual',link:'https://example.invalid/manual',data:'2027-01-01'})).data;
      await call('PUT',`/documents/${document.id}`,{titulo:tag+' editado',categoria:'Manual',data:'2027-02-01'});
      await call('POST','/documents',{titulo:tag,categoria:'Manual',link:'javascript:alert(1)'},true,400);
      await call('DELETE',`/documents/${document.id}`);
      const coupon=(await call('POST','/coupons',{codigo:'R'+randomUUID().replaceAll('-','').toUpperCase(),tipo:'fixo',valor:3,limite:2,validade:'2027-01-01'})).data;
      assert.equal(coupon.validade,'2027-01-01');
      const validation=await call('POST','/public/coupons/validate',{code:coupon.codigo,phone:'21977777777',items:[{productId:product,quantity:1,expectedUnitPrice:25}]},false);
      assert.equal(validation.data.discount,3);await call('PATCH',`/coupons/${coupon.id}`,{active:false});
    });
    await t.test('combo com substituição de refrigerante, orçamento e pedido usam o mesmo preço',async()=>{
      await call('PUT','/settings',{'storefront.allowOrdersWithoutStockForTesting':true});
      const promotions=(await call('GET','/public/promotions',undefined,false)).data;
      const promo=promotions.find(p=>p.code==='COMBO-BATATA-RECHEADA');assert.ok(promo);
      assert.equal(promo.combo_price,null);assert.equal(Number(promo.discount_percent),5);
      const selections=promo.groups.map(g=>({groupId:g.id,items:Array.from({length:g.requiredQuantity},()=>({productId:g.products[0].id,quantity:1,options:g.products[0].id==='p-ref001'?{sodaFlavor:'coca-cola'}:{}}))}));
      const cart={items:[],combos:[{promotionId:promo.id,selections}]};
      const quote=(await call('POST','/public/pricing/quote',cart,false)).data;
      assert.equal(quote.totalAfterPromotions,Math.round((quote.subtotalNormal-Math.round((quote.subtotalNormal*.05+Number.EPSILON)*100)/100+Number.EPSILON)*100)/100);
      const sodaGroup=promo.groups.find(g=>g.products.some(p=>p.id==='p-ref001'));
      assert.ok(sodaGroup);const potatoGroups=promo.groups.filter(g=>g.id!==sodaGroup.id);assert.equal(potatoGroups.length,1);
      const potatoGroup=potatoGroups[0];
      for(const potato of potatoGroup.products.filter(p=>p.active))for(const sodaFlavor of ['coca-cola','guarana','sprite']){
        const choices=[{groupId:potatoGroup.id,items:[{productId:potato.id,quantity:2,options:{}}]},
          {groupId:sodaGroup.id,items:[{productId:'p-ref001',quantity:1,options:{sodaFlavor}}]}];
        const priced=(await call('POST','/public/pricing/quote',{items:[],combos:[{promotionId:promo.id,selections:choices}]},false)).data;
        assert.equal(priced.totalPromotionDiscount,Math.round((priced.subtotalNormal*.05+Number.EPSILON)*100)/100);
        assert.ok(priced.totalAfterPromotions<priced.subtotalNormal,`${potato.name} / ${sodaFlavor}`);
      }
      await call('PUT','/settings',{'storefront.isOpen':false});
      const payload={...publicOrder('Dinheiro'),...cart,expectedTestMode:true};
      const trackedTables=['orders','order_items','order_status_history','promotion_applications','public_order_idempotency','order_idempotency_keys','stock_movements','financial_entries'];
      const before=Object.fromEntries(await Promise.all(trackedTables.map(async table=>[table,(await q(`SELECT count(*) FROM ${table}`)).rows[0].count])));
      const simulated=(await call('POST','/public/orders',payload,false,200)).data;
      const repeated=(await call('POST','/public/orders',payload,false,200)).data;
      assert.equal(simulated.simulated,true);assert.equal(simulated.testMode,true);assert.equal(simulated.status,'Simulação concluída');
      assert.equal(Number(simulated.total),Number(quote.totalAfterPromotions));assert.deepEqual(repeated,simulated);
      assert.equal('id' in simulated,false);assert.equal('orderNumber' in simulated,false);assert.equal('trackingToken' in simulated,false);
      const after=Object.fromEntries(await Promise.all(trackedTables.map(async table=>[table,(await q(`SELECT count(*) FROM ${table}`)).rows[0].count])));
      assert.deepEqual(after,before,'simulação não grava pedidos, idempotência ou efeitos operacionais');
      await call('PUT','/settings',{'storefront.allowOrdersWithoutStockForTesting':false});
      const staleMode=await call('POST','/public/orders',payload,false,409);assert.equal(staleMode.error,'test_mode_changed');
      await call('PUT','/settings',{'storefront.isOpen':true});
    });
    await t.test('agenda semanal válida é canônica e dados inválidos não são salvos',async()=>{
      await call('PUT','/settings',{horario:{segunda:'Fechado',terca:'15h – 23h',quarta:'15h – 23h',quinta:'15h – 23h',sexta:'18h – 02h',sabado:'15h – 23h',domingo:'15h – 23h'}});
      const settings=(await call('GET','/settings')).data;
      assert.equal(settings.horario.sexta,'18:00 – 02:00');
      await call('PUT','/settings',{horario:{...settings.horario,sexta:'erro'}},true,400);
      assert.deepEqual((await call('GET','/settings')).data.horario,settings.horario);
    });
    await t.test('tentativas de autenticação de cliente persistem e bloqueiam o código após cinco erros',async()=>{
      const email=`${tag}-customer@example.invalid`,hash=createHash('sha256').update('123456').digest('hex');
      const ca=(await q('INSERT INTO customer_accounts(email,email_normalized,display_name) VALUES($1,$1,$2) RETURNING id',[email,tag])).rows[0];
      const challenge=(await q("INSERT INTO customer_login_challenges(customer_account_id,code_hash,expires_at) VALUES($1,$2,now()+interval '10 minutes') RETURNING id",[ca.id,hash])).rows[0];
      for(let n=0;n<5;n++)await call('POST','/customer/auth/verify',{email,code:'000000'},false,401);
      await call('POST','/customer/auth/verify',{email,code:'123456'},false,401);
      assert.equal(Number((await q('SELECT attempts FROM customer_login_challenges WHERE id=$1',[challenge.id])).rows[0].attempts),5);
      assert.equal((await q('SELECT 1 FROM customer_sessions WHERE customer_account_id=$1',[ca.id])).rowCount,0);
    });
    await t.test('usuário sem privilégios não lê financeiro nem altera cadastros',async()=>{
      const r=(await q('INSERT INTO roles(name) VALUES($1) RETURNING id',[tag])).rows[0];
      await q('INSERT INTO users(role_id,name,email,password_hash) VALUES($1,$2,$3,$4)',[r.id,tag,`${tag}-restricted@example.invalid`,await argon2.hash(tag)]);
      const login=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email:`${tag}-restricted@example.invalid`,password:tag}});
      assert.equal(login.statusCode,200);
      const adminCookie=cookie;cookie=login.headers['set-cookie'].split(';')[0];
      try{await call('GET','/finance/entries',undefined,true,403);await call('POST','/operations/cash/open',{id:randomUUID(),amount:10},true,403);await call('POST','/products',{},true,403);}
      finally{cookie=adminCookie;}
    });
  }finally{await app.close();await db.end();}
});
