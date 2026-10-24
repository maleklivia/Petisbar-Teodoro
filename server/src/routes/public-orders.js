import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { pricesMatch, roundMoney, stockAllowsOrder } from '../services/order-pricing.js';
import { calculatePromotions, couponCanStack } from '../services/promotions.js';
import { reserveOrderStock } from '../services/order-stock-reservations.js';
import { hashToken, optionalCustomerAuthenticate } from '../middleware/customer-auth.js';
import { storefrontAcceptance } from '../services/storefront-hours.js';
import { sendCustomerEmail } from '../services/customer-email.js';

const optionSchema = z.record(z.string().regex(/^[a-z][a-zA-Z0-9_-]{0,39}$/),z.unknown()).default({});
const itemSchema = z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(20), expectedUnitPrice: z.number().nonnegative(), flavoredIce: z.boolean().default(false), options: optionSchema });
const comboSchema = z.object({ promotionId:z.string().uuid(), selections:z.array(z.object({ groupId:z.string().uuid(), items:z.array(z.object({ productId:z.string().min(1).max(100),quantity:z.number().int().min(1).max(20),flavoredIce:z.boolean().default(false),options:optionSchema })).min(1).max(30) })).min(1).max(20) });
const couponSchema = z.object({ code: z.string().trim().min(1).max(40), phone: z.string().trim().min(8).max(24), items: z.array(itemSchema).max(30), combos:z.array(comboSchema).max(10).default([]) }).refine(data=>data.items.length+data.combos.flatMap(c=>c.selections.flatMap(g=>g.items)).length>0);
const orderSchema = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(24) }),
  fulfillmentType: z.enum(['retirada', 'entrega']),
  tableNumber: z.string().trim().max(20).default(''),
  address: z.object({ postalCode:z.string().trim().max(12).default(''), city:z.string().trim().max(100).default(''), street:z.string().trim().max(160).default(''), number:z.string().trim().max(30).default(''), district:z.string().trim().max(100).default(''), complement:z.string().trim().max(120).default(''), reference:z.string().trim().max(180).default('') }).default({}),
  paymentMethod: z.enum(['Pix', 'Dinheiro', 'Cartão na entrega']), notes: z.string().trim().max(500).default(''),
  couponCode: z.string().trim().max(40).default(''), adultConfirmed: z.boolean().default(false), website: z.string().max(0).optional(),
  idempotencyKey:z.string().uuid(), useLoyalty:z.boolean().default(false), items: z.array(itemSchema).max(30).default([]), combos:z.array(comboSchema).max(10).default([]),
}).refine(data=>data.items.length+data.combos.flatMap(c=>c.selections.flatMap(g=>g.items)).length>0);
const idempotencySchema = z.string().trim().min(16).max(200);

const normalizePhone = value => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
};
const validPhone = phone => phone.length === 10 || phone.length === 11;
function normalizePostalCode(value) { return String(value || '').replace(/\D/g, '').slice(0, 8); }
function deliveryForPostalCode(value, settings) {
  const postalCode = normalizePostalCode(value);
  const zones = Array.isArray(settings?.zones) ? settings.zones : [];
  const zone = zones
    .filter(item => String(item?.prefixo || '').replace(/\D/g, '') && postalCode.startsWith(String(item.prefixo).replace(/\D/g, '')))
    .sort((a, b) => String(b.prefixo).length - String(a.prefixo).length)[0];
  if (!zone) return null;
  const fee = Number(zone.valor);
  return Number.isFinite(fee) && fee >= 0 ? { fee: roundMoney(fee), zone: String(zone.nome || zone.prefixo) } : null;
}
async function findCoupon(db, code, lock = false) {
  const { rows } = await db.query(`SELECT id,code,discount_percent,discount_amount,max_discount,max_uses,first_order_only FROM coupons WHERE upper(code)=upper($1) AND active=true AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now()) ${lock ? 'FOR UPDATE' : ''}`, [code]);
  return rows[0] || null;
}

async function couponEligibility(db, coupon, phone) {
  if(coupon.max_uses!=null){const count=await db.query('SELECT count(*)::int AS uses FROM coupon_redemptions WHERE coupon_id=$1',[coupon.id]);if(count.rows[0].uses>=coupon.max_uses)return 'coupon_limit_reached';}
  const used = await db.query('SELECT 1 FROM coupon_redemptions WHERE coupon_id=$1 AND phone_normalized=$2', [coupon.id, phone]);
  if (used.rowCount) return 'coupon_already_used';
  if (coupon.first_order_only) {
    const previous = await db.query("SELECT 1 FROM orders WHERE right(regexp_replace(coalesce(customer_phone,''),'\\D','','g'),11)=$1 AND source NOT LIKE '%(Teste)' LIMIT 1", [phone]);
    if (previous.rowCount) return 'first_order_only';
  }
  return '';
}

function discountFor(coupon, subtotal) {
  if(coupon.discount_amount!=null)return roundMoney(Math.min(subtotal,Number(coupon.discount_amount)));
  const percentage = roundMoney(subtotal * Number(coupon.discount_percent) / 100);
  return roundMoney(coupon.max_discount === null ? percentage : Math.min(percentage, Number(coupon.max_discount)));
}

export default async function publicOrderRoutes(app) {
  const defaultStorefront = {
    minimumOrder: 20,
    deliveryTime: '30–60 min',
    isOpen: false,
    hours: 'Horários definidos no ERP',
    paymentMethods: ['Pix', 'Dinheiro', 'Cartão na entrega'],
    promotions: [{ title: 'Promoções do dia', description: 'Confira as promoções disponíveis no cardápio.' }],
    whatsapp: '5521975816050',
    allowOrdersWithoutStockForTesting: false,
    deliveryZones: { defaultFee: null, zones: [] },
  };
  app.get('/public/storefront', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const keys = ['horario','storefront.minimumOrder', 'storefront.deliveryTime', 'storefront.isOpen', 'storefront.hours', 'storefront.paymentMethods', 'storefront.promotions', 'storefront.whatsapp', 'storefront.allowOrdersWithoutStockForTesting', 'storefront.deliveryZones'];
    const { rows } = await app.db.query('SELECT key,value FROM app_settings WHERE key = ANY($1::text[])', [keys]);
    const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
    const manuallyEnabled = values['storefront.isOpen'] === undefined ? defaultStorefront.isOpen : Boolean(values['storefront.isOpen']);
    const hours = String(values['storefront.hours'] ?? defaultStorefront.hours);
    const acceptance = storefrontAcceptance(manuallyEnabled, values.horario||hours);
    return { data: {
      minimumOrder: Number(values['storefront.minimumOrder'] ?? defaultStorefront.minimumOrder),
      deliveryTime: String(values['storefront.deliveryTime'] ?? defaultStorefront.deliveryTime),
      isOpen: acceptance.open,
      manuallyEnabled,
      closedReason: acceptance.reason,
      hours,
      paymentMethods: Array.isArray(values['storefront.paymentMethods']) ? values['storefront.paymentMethods'] : defaultStorefront.paymentMethods,
      promotions: Array.isArray(values['storefront.promotions']) ? values['storefront.promotions'] : defaultStorefront.promotions,
      whatsapp: String(values['storefront.whatsapp'] ?? defaultStorefront.whatsapp),
      allowOrdersWithoutStockForTesting: values['storefront.allowOrdersWithoutStockForTesting'] === true,
      deliveryZones: values['storefront.deliveryZones'] && typeof values['storefront.deliveryZones'] === 'object' ? values['storefront.deliveryZones'] : defaultStorefront.deliveryZones,
    } };
  });
  // O cardápio e o fechamento usam os mesmos dados de produto e estoque.
  app.get('/public/catalog', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const catalog=await app.db.query('SELECT id,name,category,description,sale_price,photo_url,current_stock,option_groups FROM products WHERE active=true ORDER BY category,name');
    const configuredIds=catalog.rows.flatMap(product=>(product.option_groups||[]).flatMap(group=>(group.options||[]).map(option=>option.priceProductId).filter(Boolean)));
    const variantIds=[...new Set([...configuredIds,'p-pet006','p-pet007','p-drk002','p-drk003','p-drk011','p-ref005','p-ref002','p-ref003','p-agu001'])];
    const variants=await app.db.query('SELECT id,sale_price FROM products WHERE id=ANY($1::text[])',[variantIds]);
    const prices = Object.fromEntries(variants.rows.map(row => [row.id, Number(row.sale_price)]));
    return {data:catalog.rows.map(product => ({...product,
      option_groups:(product.option_groups||[]).map(group=>({...group,options:(group.options||[]).map(option=>({...option,priceProductPrice:option.priceProductId?prices[option.priceProductId]:null}))})),
      option_prices:product.id==='p-drk001' ? {flavors:{morango:prices['p-drk002'],maracuja:prices['p-drk003']}}
        : product.id==='p-pet001' ? {G:prices['p-pet006']}
        : product.id==='p-pet002' ? {G:prices['p-pet007'],drinks:{'coca-cola':prices['p-ref005'],guarana:prices['p-ref002'],agua:prices['p-agu001']}}
        : product.id==='p-drk010' ? {'700ml':prices['p-drk011']}
        : product.id==='p-ref001' ? {soda:{'coca-cola':prices['p-ref005'],guarana:prices['p-ref002'],sprite:prices['p-ref003']}} : null,
    }))};
  });

  app.post('/public/coupons/validate', { config:{rateLimit:{max:20,timeWindow:'1 minute'}} }, async (request,reply) => {
    const parsed=couponSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'validation_error'});
    const phone=normalizePhone(parsed.data.phone); if(!validPhone(phone))return reply.code(400).send({error:'invalid_phone'});
    const coupon=await findCoupon(app.db,parsed.data.code); if(!coupon)return reply.code(404).send({error:'coupon_not_found'});
    const reason=await couponEligibility(app.db,coupon,phone); if(reason)return reply.code(409).send({error:reason});
    const priced=await calculatePromotions(app.db,parsed.data.items,parsed.data.combos); if(priced.error)return reply.code(409).send({error:priced.error});
    if(!pricesMatch(parsed.data.items,priced))return reply.code(409).send({error:'catalog_changed'});
    if(!couponCanStack(priced))return reply.code(409).send({error:'coupon_not_combinable'});
    const amount=discountFor(coupon,Math.max(0,priced.subtotal-priced.promotionDiscount));
    return {data:{code:coupon.code,discount:amount,subtotalNormal:priced.subtotal,promotionDiscount:priced.promotionDiscount,description:`${Number(coupon.discount_percent)}% de desconto${coupon.max_discount?` (máximo R$ ${Number(coupon.max_discount).toFixed(2)})`:''}`, promotions:priced.promotions.map(p=>({code:p.code,name:p.name,discount:p.discount}))}};
  });

  app.post('/public/orders', {config:{rateLimit:{max:10,timeWindow:'1 minute'}}}, async (request,reply) => {
    const parsed=orderSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'validation_error',details:parsed.error.flatten()});
    const input=parsed.data; if(input.website)return reply.code(400).send({error:'invalid_request'});
    await optionalCustomerAuthenticate(request);
    const rawIdempotencyKey=request.headers['idempotency-key'];
    const idempotencyKey=typeof rawIdempotencyKey==='string'&&idempotencySchema.safeParse(rawIdempotencyKey).success?rawIdempotencyKey:null;
    const requestHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const phone=normalizePhone(input.customer.phone); if(!validPhone(phone))return reply.code(400).send({error:'invalid_phone'});
    if(input.fulfillmentType==='entrega'&&(!input.address.postalCode||!input.address.city||!input.address.street||!input.address.number||!input.address.district))return reply.code(400).send({error:'delivery_address_required'});
    const client=await app.db.connect();
    try {
      await client.query('BEGIN');
      const requestHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const claimed=await client.query(`INSERT INTO public_order_idempotency(idempotency_key,request_hash) VALUES($1,$2)
        ON CONFLICT(idempotency_key) DO NOTHING RETURNING idempotency_key`,[input.idempotencyKey,requestHash]);
      if(!claimed.rowCount){
        const previous=await client.query('SELECT request_hash,response FROM public_order_idempotency WHERE idempotency_key=$1 FOR UPDATE',[input.idempotencyKey]);
        if(previous.rows[0]?.request_hash!==requestHash){await client.query('ROLLBACK');return reply.code(409).send({error:'idempotency_key_reused'});}
        if(previous.rows[0]?.response){await client.query('COMMIT');return reply.code(201).send(previous.rows[0].response);}
        await client.query('ROLLBACK');return reply.code(409).send({error:'order_request_in_progress'});
      }
      if(idempotencyKey){
        const existing=await client.query('SELECT request_hash,order_id FROM order_idempotency_keys WHERE idempotency_key_hash=$1 AND expires_at>now() FOR UPDATE',[hashToken(idempotencyKey)]);
        if(existing.rowCount){
          if(existing.rows[0].request_hash!==requestHash){await client.query('ROLLBACK');return reply.code(409).send({error:'idempotency_key_reused'});}
          const previous=await client.query('SELECT response FROM public_order_idempotency WHERE order_id=$1',[existing.rows[0].order_id]);
          await client.query('ROLLBACK');
          if(!previous.rows[0]?.response)return reply.code(409).send({error:'idempotency_order_missing'});
          return reply.code(201).send(previous.rows[0].response);
        }
      }
      const priced=await calculatePromotions(client,input.items,input.combos,{lock:true}); if(priced.error){await client.query('ROLLBACK');return reply.code(409).send({error:priced.error,details:priced});}
      if(!pricesMatch(input.items,priced)){await client.query('ROLLBACK');return reply.code(409).send({error:'catalog_changed'});}
      const storefrontResult=await client.query("SELECT key,value FROM app_settings WHERE key=ANY($1::text[]) FOR SHARE",[['horario','storefront.isOpen','storefront.hours','storefront.deliveryZones']]);
      const storefrontValues=Object.fromEntries(storefrontResult.rows.map(row=>[row.key,row.value]));
      const manuallyEnabled=storefrontValues['storefront.isOpen']===undefined?defaultStorefront.isOpen:Boolean(storefrontValues['storefront.isOpen']);
      const hours=String(storefrontValues['storefront.hours']??defaultStorefront.hours);
      const deliveryZones=storefrontValues['storefront.deliveryZones'] && typeof storefrontValues['storefront.deliveryZones']==='object' ? storefrontValues['storefront.deliveryZones'] : defaultStorefront.deliveryZones;
      const acceptance=storefrontAcceptance(manuallyEnabled,storefrontValues.horario||hours);
      if(!acceptance.open){await client.query('ROLLBACK');return reply.code(409).send({error:'store_closed',reason:acceptance.reason});}
      const paymentResult=await client.query("SELECT value FROM app_settings WHERE key='storefront.paymentMethods' FOR SHARE");
      const paymentMethods=Array.isArray(paymentResult.rows[0]?.value)?paymentResult.rows[0].value:defaultStorefront.paymentMethods;
      if(!paymentMethods.includes(input.paymentMethod)){await client.query('ROLLBACK');return reply.code(409).send({error:'payment_unavailable'});}
      const minimumResult=await client.query("SELECT value FROM app_settings WHERE key='storefront.minimumOrder' FOR SHARE");
      const minimumOrder=Number(minimumResult.rows[0]?.value ?? 20);
      if(priced.subtotal<minimumOrder){await client.query('ROLLBACK');return reply.code(422).send({error:'minimum_order_not_met',minimumOrder});}
      if(priced.items.some(item=>['Drinks','Cervejas'].includes(item.category))&&!input.adultConfirmed){await client.query('ROLLBACK');return reply.code(400).send({error:'adult_confirmation_required'});}
      const testStockResult=await client.query("SELECT value FROM app_settings WHERE key='storefront.allowOrdersWithoutStockForTesting' FOR SHARE");
      const testStockMode=testStockResult.rows[0]?.value===true;
      if(!stockAllowsOrder(priced.items,testStockMode)){await client.query('ROLLBACK');return reply.code(409).send({error:'insufficient_stock'});}
      let coupon=null,couponDiscount=0;
      if(input.couponCode){if(!couponCanStack(priced)){await client.query('ROLLBACK');return reply.code(409).send({error:'coupon_not_combinable'});}coupon=await findCoupon(client,input.couponCode,true);if(!coupon){await client.query('ROLLBACK');return reply.code(404).send({error:'coupon_not_found'});}const reason=await couponEligibility(client,coupon,phone);if(reason){await client.query('ROLLBACK');return reply.code(409).send({error:reason});}couponDiscount=discountFor(coupon,Math.max(0,priced.subtotal-priced.promotionDiscount));}
      const discountBeforeLoyalty=roundMoney(priced.promotionDiscount+couponDiscount);
      let loyaltyDiscount=0;
      if(input.useLoyalty && request.customer?.id){
        await client.query('SELECT pg_advisory_xact_lock(71652202)');
        const loyalty=await client.query(`SELECT COALESCE(SUM(CASE WHEN entry_type IN ('credito','ajuste') THEN amount ELSE -amount END),0) AS balance
          FROM cashback_ledger WHERE customer_account_id=$1 AND (expires_at IS NULL OR expires_at>now())`,[request.customer.id]);
        loyaltyDiscount=roundMoney(Math.min(Math.max(0,Number(loyalty.rows[0]?.balance||0)),Math.max(0,priced.subtotal-discountBeforeLoyalty)));
      }
      const discount=roundMoney(discountBeforeLoyalty+loyaltyDiscount);
      let deliveryFee=0;
      if(input.fulfillmentType==='entrega'){
        const delivery=deliveryForPostalCode(input.address.postalCode, deliveryZones);
        if(!delivery){await client.query('ROLLBACK');return reply.code(422).send({error:'delivery_area_unavailable'});}
        deliveryFee=delivery.fee;
      }
      const total=roundMoney(Math.max(0,priced.subtotal+deliveryFee-discount)); const id=`web-${randomUUID()}`;
      const numberResult=await client.query("SELECT nextval('order_number_seq') AS number"); const orderNumber=Number(numberResult.rows[0].number);
      const source=testStockMode?(input.tableNumber?'Mesa QR (Teste)':'Cardápio Digital (Teste)'):(input.tableNumber?'Mesa QR':'Cardápio Digital');
      const rawNotes=input.tableNumber?`Mesa ${input.tableNumber}${input.notes?` — ${input.notes}`:''}`:input.notes;
      const notes=testStockMode?`[TESTE SEM ESTOQUE] ${rawNotes}`.trim():rawNotes;
      const initialStatus=input.paymentMethod==='Pix'?'Aguardando Pagamento':'Em Produção';
      await client.query("INSERT INTO orders (id,order_number,source,client_name,customer_phone,status,subtotal,delivery_fee,discount,total,payment_method,notes,fulfillment_type,delivery_address,promotion_discount,coupon_discount,coupon_code,customer_account_id,table_number,client_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)",[id,orderNumber,source,input.customer.name,input.customer.phone,initialStatus,priced.subtotal,deliveryFee,discount,total,input.paymentMethod,notes,input.fulfillmentType,input.address,priced.promotionDiscount,couponDiscount,coupon?.code||null,request.customer?.id||null,input.tableNumber||null,request.customer?.client_id||null]);
      const reservation=await reserveOrderStock(client,{orderId:id,items:priced.items,allowWithoutStock:testStockMode});
      if(reservation.error){await client.query('ROLLBACK');return reply.code(409).send({error:reservation.error,details:reservation});}
      for(const application of priced.promotions){
        await client.query(`INSERT INTO promotion_applications(id,order_id,promotion_id,code,name,rule_type,discount_amount,normal_subtotal,applied_subtotal,item_snapshot)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[application.id,id,application.promotionId,application.code,application.name,application.ruleType,application.discount,application.normalSubtotal,application.appliedSubtotal,JSON.stringify(application.comboGroups||application.items||[])]);
      }
      for(const item of priced.items)await client.query(`INSERT INTO order_items (order_id,product_id,name,quantity,unit_price,subtotal,options,list_unit_price,promotion_discount,promotion_application_id,combo_group_id,combo_group_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,item.productId,item.name,item.quantity,item.unitPrice,item.subtotal,JSON.stringify(item.options||{}),item.listUnitPrice,item.promotionDiscount,item.promotionApplicationId,item.comboGroupId,item.comboGroupName]);
      if(coupon&&!testStockMode)await client.query('INSERT INTO coupon_redemptions (coupon_id,order_id,phone_normalized,discount_amount) VALUES ($1,$2,$3,$4)',[coupon.id,id,phone,couponDiscount]);
      if(loyaltyDiscount>0&&!testStockMode){
        await client.query(`INSERT INTO cashback_ledger(customer_account_id,client_id,order_id,entry_type,amount)
          SELECT $1,client_id,$2,'uso',$3 FROM customer_accounts WHERE id=$1`,[request.customer.id,id,loyaltyDiscount]);
      }
      await client.query(`INSERT INTO order_status_history (order_id,status,previous_status,changed_by,source,metadata) VALUES ($1,$2,NULL,NULL,'public',$3)`,[id,initialStatus,JSON.stringify({created:true,paymentAtDelivery:initialStatus==='Em Produção'})]);
      const trackingToken=randomBytes(32).toString('hex');
      await client.query(`INSERT INTO order_tracking_tokens (order_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '30 days')`,[id,hashToken(trackingToken)]);
      if(idempotencyKey)await client.query(`INSERT INTO order_idempotency_keys (idempotency_key_hash,request_hash,order_id,customer_account_id,expires_at) VALUES ($1,$2,$3,$4,now()+interval '30 days')`,[hashToken(idempotencyKey),requestHash,id,request.customer?.id||null]);
      const response={data:{id,orderNumber,status:initialStatus,paymentMethod:input.paymentMethod,subtotal:priced.subtotal,deliveryFee,discount,promotionDiscount:priced.promotionDiscount,couponDiscount,loyaltyDiscount,total,couponCode:coupon?.code||null,promotions:priced.promotions.map(p=>({code:p.code,discount:p.discount})),trackingToken}};
      await client.query('UPDATE public_order_idempotency SET order_id=$2,response=$3 WHERE idempotency_key=$1',[input.idempotencyKey,id,response]);
      let customerEmail = null;
      if (request.customer?.id) {
        const customer = await client.query('SELECT email FROM customer_accounts WHERE id=$1', [request.customer.id]);
        customerEmail = customer.rows[0]?.email || null;
      }
      await client.query('COMMIT');
      if (customerEmail && !testStockMode) {
        void sendCustomerEmail({
          email: customerEmail,
          subject: `Pedido #${orderNumber} recebido — Petisbar Teodoro`,
          text: `Olá, ${input.customer.name}!\n\nRecebemos seu pedido #${orderNumber}. Status atual: ${initialStatus}.\nTotal: R$ ${total.toFixed(2).replace('.', ',')}.\n\nAcompanhe o pedido pelo link disponibilizado no cardápio.`,
        }).catch(error => request.log.error({ event: 'order_email_failed', orderId: id, error: error.message }, 'falha ao enviar confirmação do pedido'));
      }
      return reply.code(201).send(response);
    } catch(error){await client.query('ROLLBACK');if(error.code==='23505'&&error.constraint?.includes('coupon'))return reply.code(409).send({error:'coupon_already_used'});throw error;} finally{client.release();}
  });

  app.get('/public/orders/track/:token', {config:{rateLimit:{max:30,timeWindow:'1 minute'}}}, async (request,reply) => {
    const token=String(request.params.token||'');
    if(!/^[a-f0-9]{32,128}$/i.test(token))return reply.code(404).send({error:'tracking_not_found'});
    const result=await app.db.query(`SELECT o.id,o.order_number,o.status,o.created_at,o.subtotal,o.delivery_fee,o.discount,o.total,o.payment_method,o.fulfillment_type,ot.id AS token_id FROM order_tracking_tokens ot JOIN orders o ON o.id=ot.order_id WHERE ot.token_hash=$1 AND ot.revoked_at IS NULL AND ot.expires_at>now()`,[hashToken(token)]);
    if(!result.rowCount)return reply.code(404).send({error:'tracking_not_found'});
    const order=result.rows[0];
    await app.db.query('UPDATE order_tracking_tokens SET last_used_at=now() WHERE id=$1',[order.token_id]);
    const [items,history]=await Promise.all([
      app.db.query('SELECT name,quantity,unit_price,subtotal,options FROM order_items WHERE order_id=$1 ORDER BY id',[order.id]),
      app.db.query('SELECT status,previous_status,created_at FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id',[order.id]),
    ]);
    delete order.token_id;
    return {data:{...order,items:items.rows,history:history.rows}};
  });
}
