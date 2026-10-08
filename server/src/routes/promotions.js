import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';
import { calculatePromotions, listPromotions } from '../services/promotions.js';

const optionsSchema = z.record(z.string(), z.array(z.string()).max(30)).default({});
const groupSchema = z.object({
  code:z.string().regex(/^[a-z0-9_-]{1,40}$/), name:z.string().trim().min(1).max(100),
  requiredQuantity:z.number().int().min(1).max(30), maxQuantity:z.number().int().min(1).max(30),
  allowSameProduct:z.boolean().default(true), allowedOptions:optionsSchema,
  products:z.array(z.object({productId:z.string().min(1).max(100),surcharge:z.number().nonnegative().max(10000).default(0),allowedOptions:optionsSchema})).min(1).max(100),
}).refine(group=>group.maxQuantity>=group.requiredQuantity,{message:'invalid_group_quantity'});
const promotionSchema = z.object({
  code:z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/),
  name:z.string().trim().min(2).max(120), description:z.string().trim().max(2000).default(''),
  ruleType:z.enum(['percentage','fixed','combo']), discountPercent:z.number().positive().max(100).nullable().optional(),
  discountAmount:z.number().positive().max(100000).nullable().optional(), comboPrice:z.number().nonnegative().max(100000).nullable().optional(),
  startsAt:z.string().datetime().nullable().optional(), endsAt:z.string().datetime().nullable().optional(),
  priority:z.number().int().min(-100000).max(100000).default(100), stackWithCoupon:z.boolean().default(false),
  productIds:z.array(z.string().min(1).max(100)).max(100).default([]), groups:z.array(groupSchema).max(20).default([]),
}).superRefine((value,ctx)=>{
  if(value.startsAt&&value.endsAt&&new Date(value.startsAt)>new Date(value.endsAt))ctx.addIssue({code:'custom',message:'invalid_period'});
  if(value.ruleType==='percentage'&&(!value.discountPercent||value.discountAmount||value.comboPrice!=null))ctx.addIssue({code:'custom',message:'invalid_percentage_rule'});
  if(value.ruleType==='fixed'&&(!value.discountAmount||value.discountPercent||value.comboPrice!=null))ctx.addIssue({code:'custom',message:'invalid_fixed_rule'});
  if(value.ruleType==='combo'&&(value.discountPercent||value.discountAmount||value.productIds.length||!value.groups.length))ctx.addIssue({code:'custom',message:'invalid_combo_rule'});
  if(value.ruleType!=='combo'&&(!value.productIds.length||value.groups.length))ctx.addIssue({code:'custom',message:'promotion_products_required'});
  if(new Set(value.groups.map(group=>group.code)).size!==value.groups.length)ctx.addIssue({code:'custom',message:'duplicate_group_code'});
});

async function savePromotion(client, input, { id=null, userId, ip }) {
  const productIds=[...new Set([...input.productIds,...input.groups.flatMap(group=>group.products.map(product=>product.productId))])];
  const products=productIds.length?await client.query('SELECT id FROM products WHERE id=ANY($1::text[]) AND active=true ORDER BY id FOR UPDATE',[productIds]):{rows:[]};
  if(products.rowCount!==productIds.length)throw Object.assign(new Error('promotion_product_inactive_or_missing'),{statusCode:409,code:'promotion_product_inactive_or_missing'});
  let promotionId=id;
  if(id){
    const current=await client.query('SELECT id,active,code FROM promotions WHERE id=$1 FOR UPDATE',[id]);
    if(!current.rowCount)throw Object.assign(new Error('promotion_not_found'),{statusCode:404,code:'promotion_not_found'});
    await client.query(`UPDATE promotions SET code=$2,name=$3,description=$4,rule_type=$5,discount_percent=$6,discount_amount=$7,
      combo_price=$8,starts_at=$9,ends_at=$10,priority=$11,stack_with_coupon=$12,updated_by=$13,updated_at=now(),active=false WHERE id=$1`,
      [id,input.code,input.name,input.description,input.ruleType,input.discountPercent??null,input.discountAmount??null,input.comboPrice??null,
        input.startsAt??null,input.endsAt??null,input.priority,input.stackWithCoupon,userId]);
    await client.query('DELETE FROM promotion_products WHERE promotion_id=$1',[id]);
    await client.query('UPDATE promotion_groups SET active=false WHERE promotion_id=$1',[id]);
    if(current.rows[0].active)await client.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip)
      VALUES($1,'promotion.deactivate','promotion',$2,$3,$4)`,[userId,id,{code:current.rows[0].code,reason:'edited_rule'},ip]);
  }else{
    const created=await client.query(`INSERT INTO promotions(code,name,description,rule_type,discount_percent,discount_amount,combo_price,
      starts_at,ends_at,priority,stack_with_coupon,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
      [input.code,input.name,input.description,input.ruleType,input.discountPercent??null,input.discountAmount??null,input.comboPrice??null,
        input.startsAt??null,input.endsAt??null,input.priority,input.stackWithCoupon,userId]);
    promotionId=created.rows[0].id;
  }
  for(const productId of input.productIds)await client.query('INSERT INTO promotion_products(promotion_id,product_id) VALUES($1,$2)',[promotionId,productId]);
  for(const group of input.groups){
    const inserted=await client.query(`INSERT INTO promotion_groups(promotion_id,code,name,required_quantity,max_quantity,allow_same_product,allowed_options,active)
      VALUES($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT(promotion_id,code) DO UPDATE SET name=EXCLUDED.name,
      required_quantity=EXCLUDED.required_quantity,max_quantity=EXCLUDED.max_quantity,allow_same_product=EXCLUDED.allow_same_product,
      allowed_options=EXCLUDED.allowed_options,active=true RETURNING id`,[promotionId,group.code,group.name,group.requiredQuantity,group.maxQuantity,group.allowSameProduct,group.allowedOptions]);
    await client.query('DELETE FROM promotion_group_products WHERE group_id=$1',[inserted.rows[0].id]);
    for(const product of group.products)await client.query('INSERT INTO promotion_group_products(group_id,product_id,surcharge,allowed_options) VALUES($1,$2,$3,$4)',[inserted.rows[0].id,product.productId,product.surcharge,product.allowedOptions]);
  }
  await client.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip)
    VALUES($1,$2,'promotion',$3,$4,$5)`,[userId,id?'promotion.update':'promotion.create',promotionId,{code:input.code,ruleType:input.ruleType,productIds,groups:input.groups.length},ip]);
  return promotionId;
}

async function activationReadiness(db,id){
  const promo=await db.query('SELECT * FROM promotions WHERE id=$1',[id]);
  if(!promo.rowCount)return {ok:false,reason:'promotion_not_found'};
  const p=promo.rows[0];
  const refs=await db.query(`SELECT DISTINCT p.id,p.active FROM products p JOIN (SELECT product_id FROM promotion_products WHERE promotion_id=$1 UNION
    SELECT gp.product_id FROM promotion_groups g JOIN promotion_group_products gp ON gp.group_id=g.id WHERE g.promotion_id=$1 AND g.active=true) r ON r.product_id=p.id ORDER BY p.id`,[id]);
  if(p.rule_type==='combo'&&p.combo_price===null)return {ok:false,reason:'promotion_price_unconfigured'};
  if(p.rule_type==='percentage'&&p.discount_percent===null)return {ok:false,reason:'promotion_value_unconfigured'};
  if(p.rule_type==='fixed'&&p.discount_amount===null)return {ok:false,reason:'promotion_value_unconfigured'};
  const groups=await db.query(`SELECT g.id,COUNT(gp.product_id)::int AS products FROM promotion_groups g LEFT JOIN promotion_group_products gp ON gp.group_id=g.id
    WHERE g.promotion_id=$1 AND g.active=true GROUP BY g.id`,[id]);
  if(p.rule_type==='combo'&&(!groups.rowCount||groups.rows.some(group=>!group.products)))return {ok:false,reason:'combo_group_empty'};
  if(!refs.rowCount||refs.rows.some(row=>!row.active))return {ok:false,reason:'promotion_product_inactive_or_missing'};
  const estimate=(await listPromotions(db)).find(item=>item.id===id);
  if(p.rule_type==='combo'&&Number(p.combo_price)>Number(estimate?.normalPriceEstimate||0))return {ok:false,reason:'combo_price_exceeds_normal',minimumNormalPrice:Number(estimate?.normalPriceEstimate||0)};
  if(!estimate?.costComplete)return {ok:false,reason:'promotion_cost_incomplete',productIds:estimate?.missingCostProductIds||[],productNames:estimate?.missingCostProductNames||[]};
  if(p.rule_type==='combo'&&Number(p.combo_price)<0)return {ok:false,reason:'promotion_price_invalid'};
  return {ok:true};
}

export default async function promotionRoutes(app){
  app.get('/public/promotions',async(request,reply)=>{reply.header('Cache-Control','no-store');return {data:(await listPromotions(app.db,{publicOnly:true})).filter(p=>p.active).map(({created_by,updated_by,estimatedCost,estimatedMargin,marginPercent,costComplete,missingCostProductIds,missingCostProductNames,marginBasis,...promotion})=>promotion)};});
  app.get('/promotions/catalog',{preHandler:requirePermission('promotions.read')},async()=>{
    const {rows}=await app.db.query(`SELECT p.id,p.name,p.category,p.description,p.sale_price,p.purchase_cost,p.active,
      (ts.id IS NOT NULL) AS has_sheet,(SELECT COUNT(*) FROM technical_sheet_items tsi WHERE tsi.sheet_id=ts.id)::int AS sheet_items
      FROM products p LEFT JOIN technical_sheets ts ON ts.product_id=p.id WHERE p.active=true ORDER BY p.category,p.name`);
    return {data:rows};
  });
  app.get('/promotions',{preHandler:requirePermission('promotions.read')},async()=>({data:await listPromotions(app.db)}));
  app.post('/promotions',{preHandler:requirePermission('promotions.write')},async(request,reply)=>{
    const parsed=promotionSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'validation_error',details:parsed.error.flatten()});
    const client=await app.db.connect();try{await client.query('BEGIN');const id=await savePromotion(client,parsed.data,{userId:request.user.id,ip:request.ip});
      const readiness=await activationReadiness(client,id);const data=(await listPromotions(client)).find(p=>p.id===id);await client.query('COMMIT');return reply.code(201).send({data,readiness});
    }catch(error){await client.query('ROLLBACK');if(error.code==='23505')return reply.code(409).send({error:'promotion_code_exists'});throw error;}finally{client.release();}
  });
  app.put('/promotions/:id',{preHandler:requirePermission('promotions.write')},async(request,reply)=>{
    const id=zId.safeParse(request.params.id),parsed=promotionSchema.safeParse(request.body);if(!id.success||!parsed.success)return reply.code(400).send({error:'validation_error'});
    const client=await app.db.connect();try{await client.query('BEGIN');await savePromotion(client,parsed.data,{id:id.data,userId:request.user.id,ip:request.ip});
      const readiness=await activationReadiness(client,id.data);const data=(await listPromotions(client)).find(p=>p.id===id.data);await client.query('COMMIT');return {data,readiness};
    }catch(error){await client.query('ROLLBACK');if(error.code==='23505')return reply.code(409).send({error:'promotion_code_exists'});throw error;}finally{client.release();}
  });
  app.patch('/promotions/:id/status',{preHandler:requirePermission('promotions.write')},async(request,reply)=>{
    const id=zId.safeParse(request.params.id),body=zStatus.safeParse(request.body);if(!id.success||!body.success)return reply.code(400).send({error:'validation_error'});
    const client=await app.db.connect();try{await client.query('BEGIN');
      if(body.data.active)await client.query(`SELECT p.id FROM products p WHERE p.id IN (
        SELECT product_id FROM promotion_products WHERE promotion_id=$1 UNION
        SELECT gp.product_id FROM promotion_groups g JOIN promotion_group_products gp ON gp.group_id=g.id WHERE g.promotion_id=$1 AND g.active=true
      ) ORDER BY p.id FOR UPDATE`,[id.data]);
      const current=await client.query('SELECT * FROM promotions WHERE id=$1 FOR UPDATE',[id.data]);if(!current.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:'promotion_not_found'});}
      if(body.data.active){const readiness=await activationReadiness(client,id.data);if(!readiness.ok){await client.query('ROLLBACK');return reply.code(409).send({error:readiness.reason,details:readiness});}}
      await client.query('UPDATE promotions SET active=$2,updated_at=now(),updated_by=$3 WHERE id=$1',[id.data,body.data.active,request.user.id]);
      await client.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip) VALUES($1,$2,'promotion',$3,$4,$5)`,[request.user.id,body.data.active?'promotion.activate':'promotion.deactivate',id.data,{code:current.rows[0].code},request.ip]);
      const data=(await listPromotions(client)).find(p=>p.id===id.data);await client.query('COMMIT');return {data};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.post('/public/pricing/quote',async(request,reply)=>{
    const parsed=quoteSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'validation_error'});
    const client=await app.db.connect();try{await client.query('BEGIN');const result=await calculatePromotions(client,parsed.data.items,parsed.data.combos);
      await client.query('ROLLBACK');if(result.error)return reply.code(409).send({error:result.error,details:result});
      return {data:{subtotalNormal:result.subtotal,promotions:result.promotions.map(p=>({code:p.code,name:p.name,discount:p.discount,items:p.items})),
        rejectedPromotions:result.rejectedPromotions,totalPromotionDiscount:result.promotionDiscount,totalAfterPromotions:result.subtotal-result.promotionDiscount}};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
}

const zId=z.string().uuid();
const zStatus=z.object({active:z.boolean()});
const lineSchema=z.object({productId:z.string().min(1).max(100),quantity:z.number().int().min(1).max(20),expectedUnitPrice:z.number().nonnegative().optional(),options:z.record(z.string(),z.unknown()).default({})});
const quoteSchema=z.object({items:z.array(lineSchema).max(30).default([]),combos:z.array(z.object({promotionId:zId,selections:z.array(z.object({groupId:zId,items:z.array(lineSchema).min(1).max(30)})).min(1)})).max(10).default([])}).refine(data=>data.items.length+data.combos.reduce((n,combo)=>n+combo.selections.reduce((m,group)=>m+group.items.length,0),0)>0);
