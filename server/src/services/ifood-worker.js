import { config } from '../config.js';
import { IfoodClient } from './ifood-client.js';

const money = value => {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + money(item?.value ?? item?.amount ?? 0), 0);
  const parsed = Number(value?.value ?? value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const statuses = { CONFIRMED:'Confirmado', PREPARATION_STARTED:'Em Produção', READY_TO_PICKUP:'Pronto', DISPATCHED:'Saiu para Entrega', CONCLUDED:'Concluído', CANCELLED:'Cancelado', CANCELLATION_ACCEPTED:'Cancelado' };

async function importOrder(client, order) {
  const externalId=order.id; if(!externalId)return;
  const exists=await client.query('SELECT id FROM orders WHERE external_order_id=$1',[externalId]); if(exists.rowCount)return;
  const id=`ifood-${externalId}`, numberResult=await client.query("SELECT nextval('order_number_seq') AS number");
  const orderNumber=Number(numberResult.rows[0].number), items=order.items||[];
  const subtotal=money(order.total?.subTotal ?? order.total?.subtotal), deliveryFee=money(order.total?.deliveryFee), discount=money(order.total?.benefits), total=money(order.total?.orderAmount ?? order.total?.total);
  const notes=typeof order.extraInfo==='string'?order.extraInfo:JSON.stringify(order.extraInfo||{});
  await client.query("INSERT INTO orders (id,order_number,source,client_name,customer_phone,status,subtotal,delivery_fee,discount,total,payment_method,notes,fulfillment_type,delivery_address,external_order_id,external_payload) VALUES ($1,$2,'iFood',$3,$4,'Novo',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",[id,orderNumber,order.customer?.name||'Cliente iFood',order.customer?.phone?.number||'',subtotal,deliveryFee,discount,total,order.payments?.methods?.[0]?.method||'iFood',notes,order.orderType==='TAKEOUT'?'retirada':'entrega',order.delivery?.deliveryAddress||{},externalId,order]);
  for(const item of items){const quantity=Number(item.quantity||1),unitPrice=money(item.unitPrice),itemSubtotal=money(item.totalPrice)||unitPrice*quantity,code=item.externalCode||'';const product=code?await client.query('SELECT id FROM products WHERE id=$1 OR sku=$1 LIMIT 1',[code]):{rows:[]};await client.query('INSERT INTO order_items (order_id,product_id,name,quantity,unit_price,subtotal,options) VALUES ($1,$2,$3,$4,$5,$6,$7)',[id,product.rows[0]?.id||null,item.name||'Item iFood',quantity,unitPrice,itemSubtotal,{externalCode:code,observations:item.observations||'',options:item.options||item.subItems||[]}]);}
}

async function processEvent(app, event) {
  const client=await app.db.connect();
  try {await client.query('BEGIN');const inserted=await client.query('INSERT INTO ifood_events (id,code,order_id,payload) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id',[event.id,event.code||event.fullCode||'UNKNOWN',event.orderId||null,event]);if(inserted.rowCount){if(['PLACED','ORDER_PLACED'].includes(event.code)||event.fullCode==='ORDER_PLACED')await importOrder(client,await IfoodClient.getOrder(event.orderId));const status=statuses[event.code]||statuses[event.fullCode?.replace('ORDER_','')];if(status&&event.orderId)await client.query('UPDATE orders SET status=$1,updated_at=now() WHERE external_order_id=$2',[status,event.orderId]);await client.query('UPDATE ifood_events SET processed_at=now() WHERE id=$1',[event.id]);}await client.query('COMMIT');return true;}catch(error){await client.query('ROLLBACK');app.log.error({error,eventId:event.id},'falha ao processar evento iFood');return false;}finally{client.release();}
}

export function startIfoodWorker(app) {
  if(!config.IFOOD_ENABLED)return()=>{};
  let running=false;
  const poll=async()=>{if(running)return;running=true;try{const events=await IfoodClient.pollEvents(),processed=[];for(const event of events)if(await processEvent(app,event))processed.push(event.id);if(processed.length)await IfoodClient.acknowledge(processed);}catch(error){app.log.error({error},'falha na consulta de pedidos iFood');}finally{running=false;}};
  poll();const timer=setInterval(poll,config.IFOOD_POLL_SECONDS*1000);return()=>clearInterval(timer);
}
