import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';

const itemSchema = z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(20) });
const couponSchema = z.object({ code: z.string().trim().min(1).max(40), phone: z.string().trim().min(8).max(24), items: z.array(itemSchema).min(1).max(30) });
const orderSchema = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(24) }),
  fulfillmentType: z.enum(['retirada', 'entrega']),
  address: z.object({ postalCode:z.string().trim().max(12).default(''), city:z.string().trim().max(100).default(''), street:z.string().trim().max(160).default(''), number:z.string().trim().max(30).default(''), district:z.string().trim().max(100).default(''), complement:z.string().trim().max(120).default(''), reference:z.string().trim().max(180).default('') }).default({}),
  paymentMethod: z.enum(['Pix', 'Dinheiro', 'Cartão na entrega']), notes: z.string().trim().max(500).default(''),
  couponCode: z.string().trim().max(40).default(''), adultConfirmed: z.boolean().default(false), website: z.string().max(0).optional(),
  items: z.array(itemSchema).min(1).max(30),
});

const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
const normalizePhone = value => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
};
const validPhone = phone => phone.length === 10 || phone.length === 11;

async function pricedItems(db, requested, lock = false) {
  const ids = [...new Set(requested.map(item => item.productId))];
  const { rows } = await db.query(`SELECT id,name,category,sale_price,current_stock FROM products WHERE id=ANY($1::text[]) AND active=true ${lock ? 'FOR SHARE' : ''}`, [ids]);
  if (rows.length !== ids.length) return null;
  const products = new Map(rows.map(product => [product.id, product]));
  const items = requested.map(item => { const product=products.get(item.productId); const unitPrice=Number(product.sale_price); return {...item,name:product.name,category:product.category,currentStock:product.current_stock,unitPrice,subtotal:roundMoney(unitPrice*item.quantity)}; });
  return { items, subtotal: roundMoney(items.reduce((sum,item)=>sum+item.subtotal,0)) };
}

async function findCoupon(db, code, lock = false) {
  const { rows } = await db.query(`SELECT id,code,discount_percent,max_discount,first_order_only FROM coupons WHERE upper(code)=upper($1) AND active=true AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now()) ${lock ? 'FOR UPDATE' : ''}`, [code]);
  return rows[0] || null;
}

async function couponEligibility(db, coupon, phone) {
  const used = await db.query('SELECT 1 FROM coupon_redemptions WHERE coupon_id=$1 AND phone_normalized=$2', [coupon.id, phone]);
  if (used.rowCount) return 'coupon_already_used';
  if (coupon.first_order_only) {
    const previous = await db.query("SELECT 1 FROM orders WHERE right(regexp_replace(coalesce(customer_phone,''),'\\D','','g'),11)=$1 LIMIT 1", [phone]);
    if (previous.rowCount) return 'first_order_only';
  }
  return '';
}

function discountFor(coupon, subtotal) {
  const percentage = roundMoney(subtotal * Number(coupon.discount_percent) / 100);
  return roundMoney(coupon.max_discount === null ? percentage : Math.min(percentage, Number(coupon.max_discount)));
}

export default async function publicOrderRoutes(app) {
  app.get('/public/catalog', async () => { const {rows}=await app.db.query('SELECT id,name,category,description,sale_price,photo_url FROM products WHERE active=true AND (current_stock IS NULL OR current_stock>0) ORDER BY category,name'); return {data:rows}; });

  app.post('/public/coupons/validate', { config:{rateLimit:{max:20,timeWindow:'1 minute'}} }, async (request,reply) => {
    const parsed=couponSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'validation_error'});
    const phone=normalizePhone(parsed.data.phone); if(!validPhone(phone))return reply.code(400).send({error:'invalid_phone'});
    const coupon=await findCoupon(app.db,parsed.data.code); if(!coupon)return reply.code(404).send({error:'coupon_not_found'});
    const reason=await couponEligibility(app.db,coupon,phone); if(reason)return reply.code(409).send({error:reason});
    const priced=await pricedItems(app.db,parsed.data.items); if(!priced)return reply.code(409).send({error:'product_unavailable'});
    return {data:{code:coupon.code,discount:discountFor(coupon,priced.subtotal),description:'10% de desconto (máximo R$ 10,00)'}};
  });

  app.post('/public/orders', {config:{rateLimit:{max:10,timeWindow:'1 minute'}}}, async (request,reply) => {
    const parsed=orderSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'validation_error',details:parsed.error.flatten()});
    const input=parsed.data; if(input.website)return reply.code(400).send({error:'invalid_request'});
    const phone=normalizePhone(input.customer.phone); if(!validPhone(phone))return reply.code(400).send({error:'invalid_phone'});
    if(input.fulfillmentType==='entrega'&&(!input.address.postalCode||!input.address.city||!input.address.street||!input.address.number||!input.address.district))return reply.code(400).send({error:'delivery_address_required'});
    const client=await app.db.connect();
    try {
      await client.query('BEGIN');
      const priced=await pricedItems(client,input.items,true); if(!priced){await client.query('ROLLBACK');return reply.code(409).send({error:'product_unavailable'});}
      if(priced.items.some(item=>['Drinks','Cervejas'].includes(item.category))&&!input.adultConfirmed){await client.query('ROLLBACK');return reply.code(400).send({error:'adult_confirmation_required'});}
      if(priced.items.some(item=>item.currentStock!==null&&Number(item.currentStock)<item.quantity)){await client.query('ROLLBACK');return reply.code(409).send({error:'insufficient_stock'});}
      let coupon=null,discount=0;
      if(input.couponCode){coupon=await findCoupon(client,input.couponCode,true);if(!coupon){await client.query('ROLLBACK');return reply.code(404).send({error:'coupon_not_found'});}const reason=await couponEligibility(client,coupon,phone);if(reason){await client.query('ROLLBACK');return reply.code(409).send({error:reason});}discount=discountFor(coupon,priced.subtotal);}
      const deliveryFee=input.fulfillmentType==='entrega'?config.DEFAULT_DELIVERY_FEE:0;
      const total=roundMoney(Math.max(0,priced.subtotal+deliveryFee-discount)); const id=`web-${randomUUID()}`;
      const numberResult=await client.query("SELECT nextval('order_number_seq') AS number"); const orderNumber=Number(numberResult.rows[0].number);
      await client.query("INSERT INTO orders (id,order_number,source,client_name,customer_phone,status,subtotal,delivery_fee,discount,total,payment_method,notes,fulfillment_type,delivery_address) VALUES ($1,$2,'Cardápio Digital',$3,$4,'Novo',$5,$6,$7,$8,$9,$10,$11,$12)",[id,orderNumber,input.customer.name,input.customer.phone,priced.subtotal,deliveryFee,discount,total,input.paymentMethod,input.notes,input.fulfillmentType,input.address]);
      for(const item of priced.items)await client.query('INSERT INTO order_items (order_id,product_id,name,quantity,unit_price,subtotal) VALUES ($1,$2,$3,$4,$5,$6)',[id,item.productId,item.name,item.quantity,item.unitPrice,item.subtotal]);
      if(coupon)await client.query('INSERT INTO coupon_redemptions (coupon_id,order_id,phone_normalized,discount_amount) VALUES ($1,$2,$3,$4)',[coupon.id,id,phone,discount]);
      await client.query('COMMIT'); return reply.code(201).send({data:{id,orderNumber,status:'Novo',subtotal:priced.subtotal,deliveryFee,discount,total,couponCode:coupon?.code||null}});
    } catch(error){await client.query('ROLLBACK');if(error.code==='23505')return reply.code(409).send({error:'coupon_already_used'});throw error;} finally{client.release();}
  });
}
