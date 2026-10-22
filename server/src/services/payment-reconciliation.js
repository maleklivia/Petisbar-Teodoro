import { transitionOrderStatus } from './order-effects.js';
import { getOrder } from './mercadopago.js';
import { config } from '../config.js';

export function startPaymentReconciliation(app){
  if(!config.MERCADOPAGO_ENABLED)return ()=>{};
  let stopped=false,timer;
  const run=async()=>{
    try{
      const payments=await app.db.query(`SELECT p.id,p.provider_order_id FROM order_payments p JOIN orders o ON o.id=p.order_id
        WHERE p.provider='mercadopago' AND p.provider_order_id IS NOT NULL AND o.status IN ('Novo','Aguardando Pagamento')
        AND p.status NOT IN ('rejected','cancelled','refunded','failed','expired') AND p.updated_at<now()-interval '30 seconds'
        ORDER BY p.updated_at LIMIT 20`);
      for(const payment of payments.rows){
        if(stopped)break;
        try{
          const snapshot=await getOrder(payment.provider_order_id);if(snapshot.error)continue;
          const client=await app.db.connect();try{await client.query('BEGIN');await applyPaymentSnapshot(client,payment.id,snapshot);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
        }catch(error){app.log.warn({code:error.code||error.name,paymentId:payment.id},'Falha na conciliação de pagamento');}
      }
    }catch(error){app.log.warn({code:error.code||error.name},'Falha ao consultar pagamentos pendentes');}
    finally{if(!stopped){timer=setTimeout(run,30000);timer.unref();}}
  };
  timer=setTimeout(run,15000);timer.unref();
  return ()=>{stopped=true;clearTimeout(timer);};
}

// Only a resource fetched with the merchant's credentials can release an order.
export async function applyPaymentSnapshot(client, paymentId, snapshot) {
  const found=await client.query('SELECT * FROM order_payments WHERE id=$1 FOR UPDATE',[paymentId]);
  if(!found.rowCount)return;
  const payment=found.rows[0];
  const result=await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[payment.order_id]);
  const order=result.rows[0];
  const payload=snapshot.payload||{};
  if(payload.external_reference!==order.id||Math.round(Number(payload.total_amount)*100)!==Math.round(Number(order.total)*100))
    throw Object.assign(new Error('payment_reference_mismatch'),{statusCode:409,code:'payment_reference_mismatch'});
  const isTest=String(order.source).includes('(Teste)')||String(order.notes).startsWith('[TESTE SEM ESTOQUE]');
  if(payload.live_mode===false&&!isTest)throw Object.assign(new Error('sandbox_payment_for_live_order'),{statusCode:409,code:'sandbox_payment_for_live_order'});
  const fee=snapshot.feeAmount;
  await client.query(`UPDATE order_payments SET status=$2,status_detail=$3,provider_payload=$4,
    fee_amount=coalesce($5,fee_amount),net_amount=gross_amount-coalesce($5,fee_amount),updated_at=now() WHERE id=$1`,
    [payment.id,snapshot.status,snapshot.statusDetail||'',JSON.stringify(payload),fee]);
  const approved=snapshot.status==='approved'||(snapshot.status==='processed'&&snapshot.statusDetail==='accredited');
  const paid=Number(payload.total_paid_amount??payload.transactions?.payments?.[0]?.paid_amount??0);
  if(approved&&Math.round(paid*100)>=Math.round(Number(order.total)*100)&&['Novo','Aguardando Pagamento','Pago','Confirmado'].includes(order.status)){
    if(['Novo','Aguardando Pagamento'].includes(order.status))await transitionOrderStatus(client,{orderId:order.id,nextStatus:'Pago',external:true});
    await transitionOrderStatus(client,{orderId:order.id,nextStatus:'Em Produção',external:true});
  }
  if(!isTest&&approved&&fee!==null&&fee!==undefined){
    await client.query(`INSERT INTO financial_entries(id,entry_date,description,category,entry_type,amount,reference_type,reference_id,effect_key)
      VALUES($1,current_date,$2,'Taxas de pagamento','Saída',$3,'order_payment',$4,$5)
      ON CONFLICT(effect_key) WHERE effect_key IS NOT NULL DO UPDATE SET amount=EXCLUDED.amount`,
      [`fin-mp-${payment.id}`,`Taxa Mercado Pago — pedido #${order.order_number}`,-Math.abs(fee),order.id,`payment-fee:${payment.id}`]);
  }
}
