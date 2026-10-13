import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1/test';
process.env.APP_ORIGIN ||= 'http://localhost:3000';
process.env.COOKIE_SECRET ||= 'test-only-cookie-secret-that-is-at-least-32-chars';
const {default:customerOrderRoutes}=await import('../src/routes/customer-orders.js');

test('atalhos de recompra consultam somente a conta autenticada e incluem opções e promoções',async()=>{
  const routes=new Map(),calls=[];
  const app={get(path,options,handler){routes.set(path,{options,handler})},db:{async query(sql,params){calls.push({sql,params});
    if(sql.includes('FROM orders'))return {rowCount:1,rows:[{id:'order-1',order_number:101,created_at:'2026-10-12',total:'40.00'}]};
    if(sql.includes('FROM order_items'))return {rowCount:1,rows:[{order_id:'order-1',product_id:'prod',quantity:2,options:{flavor:'limão'},promotion_application_id:'app-1'}]};
    if(sql.includes('FROM promotion_applications'))return {rowCount:1,rows:[{id:'app-1',order_id:'order-1',promotion_id:'promo-1',rule_type:'combo',item_snapshot:[{groupId:'g-1',productId:'prod',options:{flavor:'limão'}}]}]};
    throw new Error(`SQL inesperado: ${sql}`);
  }}};
  await customerOrderRoutes(app);
  const route=routes.get('/customer/reorder-shortcuts');
  assert.equal(typeof route.options.preHandler,'function');
  const result=await route.handler({customer:{id:'account-1'}});
  assert.equal(result.data[0].orderNumber,101);
  assert.equal(result.data[0].items[0].options.flavor,'limão');
  assert.equal(result.data[0].promotions[0].item_snapshot[0].groupId,'g-1');
  assert.deepEqual(calls[0].params,['account-1']);
  assert.match(calls.find(call=>call.sql.includes('FROM order_items')).sql,/options-'_stockEffects'/);
});
