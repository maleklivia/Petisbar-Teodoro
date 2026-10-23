import { z } from 'zod';
import { hashToken } from '../middleware/customer-auth.js';
import { createPixOrder,getOrder } from '../services/mercadopago.js';
import { applyPaymentSnapshot } from '../services/payment-reconciliation.js';
import { config } from '../config.js';

export default async function paymentRoutes(app){
  const serialize=p=>({status:p.status,statusDetail:p.status_detail,qrCode:p.qr_code,qrCodeBase64:p.qr_code_base64,ticketUrl:p.ticket_url,feeAmount:Number(p.fee_amount)});
  app.post('/public/orders/:id/pix',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(request,reply)=>{
    const id=z.string().min(1).max(100).safeParse(request.params.id);
    const token=z.string().regex(/^[a-f0-9]{32,128}$/i).safeParse(request.body?.trackingToken);
    if(!id.success||!token.success)return reply.code(400).send({error:'validation_error'});
    const client=await app.db.connect();
    try{
      await client.query('BEGIN');
      const found=await client.query(`SELECT o.* FROM orders o JOIN order_tracking_tokens ot ON ot.order_id=o.id
        WHERE o.id=$1 AND ot.token_hash=$2 AND ot.revoked_at IS NULL AND ot.expires_at>now() FOR UPDATE OF o`,[id.data,hashToken(token.data)]);
      if(!found.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:'order_not_found'});}
      const order=found.rows[0];
      if(order.payment_method!=='Pix'||order.status==='Cancelado'){await client.query('ROLLBACK');return reply.code(409).send({error:'payment_unavailable'});}
      const existing=await client.query('SELECT * FROM order_payments WHERE order_id=$1',[order.id]);
      if(existing.rowCount){await client.query('COMMIT');return {data:serialize(existing.rows[0])};}
      if(config.MERCADOPAGO_ENV==='sandbox'&&!String(order.source).includes('(Teste)')){await client.query('ROLLBACK');return reply.code(409).send({error:'sandbox_only'});}
      const p=await createPixOrder({orderId:order.id,amount:order.total,email:`pedido-${order.id}@petisbar.local`});
      if(p.error){await client.query('ROLLBACK');return reply.code(503).send({error:p.error});}
      const saved=await client.query(`INSERT INTO order_payments(id,order_id,provider,provider_order_id,provider_payment_id,method,status,status_detail,gross_amount,fee_amount,net_amount,qr_code,qr_code_base64,ticket_url,provider_payload)
        VALUES($1,$2,'mercadopago',$3,$4,'Pix',$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [p.id,order.id,p.providerOrderId,p.providerPaymentId,p.status,p.statusDetail,p.grossAmount,p.feeAmount??0,p.netAmount,p.qrCode,p.qrCodeBase64,p.ticketUrl,JSON.stringify(p.payload)]);
      await client.query('COMMIT');return {data:serialize(saved.rows[0])};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.post('/public/payments/mercadopago/webhook',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(request,reply)=>{
    const id=String(request.body?.data?.id||request.query?.['data.id']||request.query?.id||'');
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return reply.code(400).send({error:'provider_order_missing'});
    const payment=await app.db.query('SELECT id FROM order_payments WHERE provider_order_id=$1',[id]);
    if(!payment.rowCount)return reply.code(204).send();
    const snapshot=await getOrder(id);if(snapshot.error)return reply.code(503).send({error:'provider_unavailable'});
    const client=await app.db.connect();try{await client.query('BEGIN');await applyPaymentSnapshot(client,payment.rows[0].id,snapshot);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    return reply.code(204).send();
  });
}
