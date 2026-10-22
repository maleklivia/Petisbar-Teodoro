import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
    assert.equal(r.statusCode,expected,`${method} ${url}: ${r.body}`);return r.json();
  };
  const q=(sql,params)=>db.query(sql,params);
  const role=await q("SELECT id FROM roles WHERE name='admin'");
  const admin=await q('INSERT INTO users(role_id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id',[role.rows[0].id,tag,`${tag}@example.invalid`,await argon2.hash(tag)]);
  const login=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email:`${tag}@example.invalid`,password:tag}});
  assert.equal(login.statusCode,200);cookie=login.headers['set-cookie'].split(';')[0];
  try{
    await t.test('autorização em todas as áreas e leituras administrativas',async()=>{
      for(const path of ['/products','/ingredients','/technical-sheets','/clients','/suppliers','/purchases','/stock/movements','/finance/entries','/reports/overview','/settings','/promotions','/coupons','/documents','/operations','/dashboard','/ai/snapshot']){
        await call('GET',path,undefined,false,401);await call('GET',path);
      }
      await call('POST','/operations/tables',{number:''},true,400);
    });
    const ingredient=`i-${tag}`,product=`p-${tag}`;
    await t.test('cadastros, ficha e movimento de estoque com conversão e bloqueio de saldo',async()=>{
      await call('POST','/ingredients',{id:ingredient,nome:tag,categoria:'Teste',unidade:'kg',estoqueAtual:1,estoqueMinimo:0,custoUnitario:10});
      await call('POST','/products',{id:product,nome:tag,categoria:'Teste',precoVenda:25,estoqueAtual:null});
      await call('PUT',`/technical-sheets/${product}`,{rendimento:1,itens:[{ingredienteId:ingredient,quantidade:100,unidade:'g'}]});
      await call('POST','/stock/movements',{tipo:'entrada',ingredienteId:ingredient,quantidade:500,unidade:'g',data:'2026-10-22'},true,201);
      assert.equal(Number((await q('SELECT current_stock FROM ingredients WHERE id=$1',[ingredient])).rows[0].current_stock),1.5);
      await call('POST','/stock/movements',{tipo:'saida',ingredienteId:ingredient,quantidade:2,unidade:'kg',data:'2026-10-22'},true,409);
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
    await call('PUT','/settings',{'storefront.isOpen':true,'storefront.hours':'Segunda à Domingo - 00h até 23h','storefront.minimumOrder':1,'storefront.allowOrdersWithoutStockForTesting':false});
    let order;
    await t.test('pedido público, repetição concorrente, produção, retirada e estorno',async()=>{
      const payload=publicOrder();const orders=await Promise.all([call('POST','/public/orders',payload,false,201),call('POST','/public/orders',payload,false,201)]);assert.equal(orders[0].data.id,orders[1].data.id);order=orders[0].data;
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
      const validation=await call('POST','/public/coupons/validate',{code:coupon.codigo,phone:'21977777777',items:[{productId:product,quantity:1,expectedUnitPrice:25}]},false);
      assert.equal(validation.data.discount,3);await call('PATCH',`/coupons/${coupon.id}`,{active:false});
    });
  }finally{await app.close();await db.end();}
});
