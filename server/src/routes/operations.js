import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';

const uuid=z.string().uuid();
const fail=(code,statusCode=409)=>Object.assign(new Error(code),{code,statusCode});
export default async function operationsRoutes(app){
  const transaction=async fn=>{const c=await app.db.connect();try{await c.query('BEGIN');const data=await fn(c);await c.query('COMMIT');return{data};}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
  const expected=async(c,s)=>{
    const sales=await c.query(`SELECT coalesce(sum(total),0) amount FROM orders WHERE payment_method='Dinheiro'
      AND status IN ('Entregue','Concluído') AND effects_applied_at >= $1 AND effects_reversed_at IS NULL
      AND coalesce(source,'') NOT LIKE '%(Teste)'`,[s.opened_at]);
    const moves=await c.query("SELECT coalesce(sum(CASE WHEN movement_type='entrada' THEN amount ELSE -amount END),0) amount FROM cash_movements WHERE session_id=$1",[s.id]);
    return Math.round((Number(s.opening_amount)+Number(sales.rows[0].amount)+Number(moves.rows[0].amount))*100)/100;
  };
  app.get('/operations',{preHandler:requirePermission('orders.read')},async request=>{
    const cashAccess=request.user.permissions.includes('finance.read');
    const [tables,drivers,loyalty,cash,movements,scheduled]=await Promise.all([
      app.db.query('SELECT * FROM restaurant_tables WHERE active ORDER BY table_number'),
      app.db.query('SELECT * FROM delivery_drivers WHERE active ORDER BY name'),
      app.db.query('SELECT * FROM loyalty_settings WHERE id=true'),
      cashAccess?app.db.query('SELECT * FROM cash_sessions ORDER BY opened_at DESC LIMIT 20'):Promise.resolve({rows:[]}),
      cashAccess?app.db.query('SELECT * FROM cash_movements ORDER BY created_at DESC LIMIT 1000'):Promise.resolve({rows:[]}),
      app.db.query('SELECT order_number,client_name,status,total,scheduled_for FROM orders WHERE scheduled_for IS NOT NULL ORDER BY scheduled_for DESC LIMIT 200'),
    ]);
    const current=cash.rows.find(s=>!s.closed_at);
    return{data:{tables:tables.rows,drivers:drivers.rows,loyalty:loyalty.rows[0]||{active:false,cashback_percent:5,expires_in_days:30},cash:cash.rows,movements:movements.rows,scheduled:scheduled.rows,expected:current?await expected(app.db,current):null}};
  });
  app.post('/operations/cash/open',{preHandler:requirePermission('finance.write')},async request=>{
    const body=z.object({id:uuid,amount:z.number().nonnegative().max(1000000)}).parse(request.body);
    return transaction(async c=>{await c.query("SELECT pg_advisory_xact_lock(71652201)");const same=await c.query('SELECT * FROM cash_sessions WHERE id=$1',[body.id]);if(same.rowCount)return same.rows[0];
      if((await c.query('SELECT id FROM cash_sessions WHERE closed_at IS NULL')).rowCount)throw fail('cash_already_open');
      return(await c.query('INSERT INTO cash_sessions(id,opened_by,opening_amount,opened_at) VALUES($1,$2,$3,clock_timestamp()) RETURNING *',[body.id,request.user.id,body.amount])).rows[0];});
  });
  app.post('/operations/cash/:id/close',{preHandler:requirePermission('finance.write')},async request=>{
    const id=uuid.parse(request.params.id),body=z.object({amount:z.number().nonnegative().max(1000000)}).parse(request.body);
    return transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(71652201)');const r=await c.query('SELECT * FROM cash_sessions WHERE id=$1 FOR UPDATE',[id]);if(!r.rowCount)throw fail('cash_not_found',404);if(r.rows[0].closed_at)return r.rows[0];
      return(await c.query('UPDATE cash_sessions SET closed_at=clock_timestamp(),expected_amount=$2,counted_amount=$3 WHERE id=$1 RETURNING *',[id,await expected(c,r.rows[0]),body.amount])).rows[0];});
  });
  app.post('/operations/cash/:id/movements',{preHandler:requirePermission('finance.write')},async request=>{
    const session=uuid.parse(request.params.id),body=z.object({id:uuid,type:z.enum(['entrada','saida']),amount:z.number().positive().max(1000000),reason:z.string().trim().min(1).max(500)}).parse(request.body);
    return transaction(async c=>{const r=await c.query('SELECT * FROM cash_sessions WHERE id=$1 FOR UPDATE',[session]);if(!r.rowCount||r.rows[0].closed_at)throw fail('cash_closed');
      const prior=await c.query('SELECT * FROM cash_movements WHERE id=$1',[body.id]);if(prior.rowCount){const p=prior.rows[0];if(p.session_id!==session||p.movement_type!==body.type||Number(p.amount)!==body.amount||p.reason!==body.reason)throw fail('idempotency_key_reused');return p;}
      return(await c.query('INSERT INTO cash_movements(id,session_id,movement_type,amount,reason,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[body.id,session,body.type,body.amount,body.reason,request.user.id])).rows[0];});
  });
  app.post('/operations/tables',{preHandler:requirePermission('settings.manage')},async request=>{
    const b=z.object({number:z.string().trim().min(1).max(20)}).parse(request.body);
    try{return{data:(await app.db.query('INSERT INTO restaurant_tables(table_number) VALUES($1) RETURNING *',[b.number])).rows[0]};}catch(e){if(e.code==='23505')throw fail('table_already_exists');throw e;}
  });
  app.patch('/operations/tables/:id',{preHandler:requirePermission('settings.manage')},async request=>{
    const b=z.object({status:z.enum(['livre','ocupada','inativa'])}).parse(request.body);
    return{data:(await app.db.query("UPDATE restaurant_tables SET status=$2,active=($2<>'inativa') WHERE id=$1 RETURNING *",[uuid.parse(request.params.id),b.status])).rows[0]};
  });
  app.post('/operations/drivers',{preHandler:requirePermission('settings.manage')},async request=>{
    const b=z.object({name:z.string().trim().min(1).max(120),phone:z.string().max(30).default(''),vehicle:z.string().max(100).default('')}).parse(request.body);
    return{data:(await app.db.query('INSERT INTO delivery_drivers(name,phone,vehicle) VALUES($1,$2,$3) RETURNING *',[b.name,b.phone,b.vehicle])).rows[0]};
  });
  app.patch('/operations/drivers/:id',{preHandler:requirePermission('settings.manage')},async request=>{
    const b=z.object({available:z.boolean().optional(),active:z.boolean().optional()}).parse(request.body);
    return{data:(await app.db.query('UPDATE delivery_drivers SET available=coalesce($2,available),active=coalesce($3,active) WHERE id=$1 RETURNING *',[uuid.parse(request.params.id),b.available??null,b.active??null])).rows[0]};
  });
  app.put('/operations/loyalty',{preHandler:requirePermission('settings.manage')},async request=>{
    const b=z.object({active:z.literal(false),percent:z.number().min(0).max(30),days:z.number().int().min(1).max(365)}).parse(request.body);
    return{data:(await app.db.query('INSERT INTO loyalty_settings(id,active,cashback_percent,expires_in_days) VALUES(true,false,$1,$2) ON CONFLICT(id) DO UPDATE SET active=false,cashback_percent=$1,expires_in_days=$2,updated_at=now() RETURNING *',[b.percent,b.days])).rows[0]};
  });
}
