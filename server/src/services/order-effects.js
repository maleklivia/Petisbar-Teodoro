import { randomUUID } from 'node:crypto';
import { canTransitionOrder, convertQuantity, isCompletedStatus } from '../domain/orders.js';
import { setOrderReservationsStatus } from './order-stock-reservations.js';
import { recipeRequirements,stockComponents } from './recipe-requirements.js';

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundStock = value => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
// A customer's free-text notes must never control stock or financial effects.
const isTestOrder = order => ['Cardápio Digital (Teste)','Mesa QR (Teste)'].includes(order.source);
async function applyLoyaltyCredit(client, order) {
  if (isTestOrder(order) || !order.customer_account_id) return;
  const setting = await client.query('SELECT active,cashback_percent,expires_in_days FROM loyalty_settings WHERE id=true FOR SHARE');
  if (!setting.rows[0]?.active || Number(setting.rows[0].cashback_percent) <= 0) return;
  const amount = roundMoney(Number(order.total) * Number(setting.rows[0].cashback_percent) / 100);
  if (amount <= 0) return;
  await client.query(`INSERT INTO cashback_ledger(customer_account_id,client_id,order_id,entry_type,amount,expires_at)
    SELECT $1,client_id,$2,'credito',$3,now()+make_interval(days => $4)
    FROM customer_accounts WHERE id=$1
    ON CONFLICT (order_id) WHERE entry_type='credito' DO NOTHING`,
    [order.customer_account_id, order.id, amount, Number(setting.rows[0].expires_in_days)]);
}
async function reverseLoyaltyCredit(client, order) {
  if (!order.customer_account_id || isTestOrder(order)) return;
  const credit = await client.query(`SELECT amount FROM cashback_ledger WHERE order_id=$1 AND entry_type='credito' FOR UPDATE`, [order.id]);
  if (!credit.rowCount) return;
  const reversed = await client.query(`SELECT 1 FROM cashback_ledger WHERE order_id=$1 AND entry_type='ajuste' LIMIT 1`, [order.id]);
  if (reversed.rowCount) return;
  await client.query(`INSERT INTO cashback_ledger(customer_account_id,client_id,order_id,entry_type,amount)
    SELECT customer_account_id,client_id,order_id,'ajuste',amount FROM cashback_ledger WHERE order_id=$1 AND entry_type='credito'`, [order.id]);
}

function businessError(code, statusCode = 409, details) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function insertMovement(client, { order, ingredientId = null, productId = null, type, quantity, unit, reason }) {
  await client.query(`
    INSERT INTO stock_movements
      (id, ingredient_id, product_id, movement_type, quantity, unit, reason, reference, movement_date, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,current_date,$9)
  `, [randomUUID(), ingredientId, productId, type, quantity, unit, reason, order.id, order.created_by]);
}

async function consumeIngredient(client, order, ingredient, quantity) {
  const required = roundStock(quantity);
  const updated = await client.query(`
    UPDATE ingredients SET current_stock=current_stock-$1,updated_at=now()
    WHERE id=$2 AND current_stock >= $1 RETURNING id
  `, [required, ingredient.id]);
  if (!updated.rowCount) {
    throw businessError('insufficient_stock', 409, {
      item: ingredient.name,
      required,
      available: Number(ingredient.current_stock),
      unit: ingredient.unit,
    });
  }
  await insertMovement(client, {
    order,
    ingredientId: ingredient.id,
    type: 'Saída',
    quantity: required,
    unit: ingredient.unit,
    reason: `Baixa automática do pedido #${order.order_number}`,
  });
  return required * Number(ingredient.unit_cost);
}

async function applyInventory(client, order) {
  // Reservation quantities are the operational snapshot captured at acceptance.
  // Recipe edits made while cooking must not change the accepted consumption.
  const reservations=await client.query("SELECT * FROM order_stock_reservations WHERE order_id=$1 AND status='reserved' ORDER BY ingredient_id,product_id FOR UPDATE",[order.id]);
  if(reservations.rowCount){
    const productIds=reservations.rows.map(r=>r.product_id).filter(Boolean).sort();
    if(productIds.length)await client.query('SELECT id FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[productIds]);
    const ingredientIds=reservations.rows.map(r=>r.ingredient_id).filter(Boolean).sort();
    if(ingredientIds.length)await client.query('SELECT id FROM ingredients WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[ingredientIds]);
    let cmv=0;
    for(const r of reservations.rows){
      if(r.ingredient_id){
        const ingredient=await client.query('SELECT id,name,unit,current_stock,unit_cost FROM ingredients WHERE id=$1 FOR UPDATE',[r.ingredient_id]);
        if(!ingredient.rowCount)throw businessError('stock_recipe_incomplete');
        cmv+=await consumeIngredient(client,order,ingredient.rows[0],Number(r.quantity));
      }else{
        const p=await client.query('UPDATE products SET current_stock=current_stock-$2,updated_at=now() WHERE id=$1 AND current_stock >= $2 RETURNING purchase_cost',[r.product_id,r.quantity]);
        if(!p.rowCount)throw businessError('insufficient_stock');
        await insertMovement(client,{order,productId:r.product_id,type:'Saída',quantity:Number(r.quantity),unit:r.unit,reason:`Baixa automática do pedido #${order.order_number}`});
        cmv+=Number(p.rows[0].purchase_cost||0)*Number(r.quantity);
      }
    }
    return roundMoney(cmv);
  }
  const items=await client.query('SELECT product_id,quantity,options FROM order_items WHERE order_id=$1 ORDER BY product_id',[order.id]);
  let cmv=0;
  for(const raw of items.rows){
    const item={productId:raw.product_id,quantity:Number(raw.quantity),options:raw.options||{}};
    for(const component of stockComponents(item)){
      const recipe=await recipeRequirements(client,component.productId,component.quantity);
      if(recipe){
        for(const r of recipe){
          const ingredient=await client.query('SELECT id,name,unit,current_stock,unit_cost FROM ingredients WHERE id=$1 FOR UPDATE',[r.ingredient_id]);
          cmv+=await consumeIngredient(client,order,ingredient.rows[0],r.quantity);
        }
      }else{
        const product=await client.query('SELECT id,name,current_stock,purchase_cost FROM products WHERE id=$1 FOR UPDATE',[component.productId]);
        const p=product.rows[0];if(!p)throw businessError('product_unavailable');
        if(p.current_stock!==null){
          const updated=await client.query('UPDATE products SET current_stock=current_stock-$2,updated_at=now() WHERE id=$1 AND current_stock >= $2 RETURNING id',[p.id,component.quantity]);
          if(!updated.rowCount)throw businessError('insufficient_stock');
          await insertMovement(client,{order,productId:p.id,type:'Saída',quantity:component.quantity,unit:'un',reason:`Baixa automática do pedido #${order.order_number}`});
        }
        cmv+=Number(p.purchase_cost||0)*component.quantity;
      }
    }
    if(item.options.flavoredIce){
      const ice=await client.query("SELECT id,name,unit,current_stock,unit_cost FROM ingredients WHERE id='i-029' FOR UPDATE");
      if(!ice.rowCount)throw businessError('stock_recipe_incomplete');
      cmv+=await consumeIngredient(client,order,ice.rows[0],item.quantity);
    }
  }
  return roundMoney(cmv);
}

async function applyFinancialEntries(client, order, cmv) {
  await client.query(`
    INSERT INTO financial_entries
      (id,entry_date,description,category,entry_type,amount,reference_type,reference_id,created_by,effect_key)
    VALUES ($1,current_date,$2,'Vendas','Entrada',$3,'order',$4,$5,$6)
    ON CONFLICT (effect_key) WHERE effect_key IS NOT NULL DO NOTHING
  `, [randomUUID(), `Pedido #${order.order_number} · ${order.source}`, order.total, order.id, order.created_by, `order:${order.id}:sale`]);
  if (cmv > 0) {
    await client.query(`
      INSERT INTO financial_entries
        (id,entry_date,description,category,entry_type,amount,reference_type,reference_id,created_by,effect_key)
      VALUES ($1,current_date,$2,'CMV','Saída',$3,'order',$4,$5,$6)
      ON CONFLICT (effect_key) WHERE effect_key IS NOT NULL DO NOTHING
    `, [randomUUID(), `CMV do pedido #${order.order_number}`, -Math.abs(cmv), order.id, order.created_by, `order:${order.id}:cmv`]);
  }
}

async function applyEffects(client, order) {
  if (order.effects_applied_at && !order.effects_reversed_at) return;
  if (order.effects_reversed_at) throw businessError('order_effects_already_reversed');
  if (isTestOrder(order)) {
    await setOrderReservationsStatus(client,order.id,'released');
    await client.query('UPDATE orders SET effects_applied_at=now() WHERE id=$1',[order.id]);
    return;
  }
  await client.query('SELECT pg_advisory_xact_lock(71652201)');
  const cmv = await applyInventory(client, order);
  await applyFinancialEntries(client, order, cmv);
  await setOrderReservationsStatus(client,order.id,'consumed');
  await applyLoyaltyCredit(client, order);
  await client.query('UPDATE orders SET effects_applied_at=clock_timestamp() WHERE id=$1', [order.id]);
}

async function reverseEffects(client, order) {
  await client.query('SELECT pg_advisory_xact_lock(71652201)');
  if (!order.effects_applied_at || order.effects_reversed_at) {
    await setOrderReservationsStatus(client,order.id,'released');
    return;
  }
  if (isTestOrder(order)) {
    await client.query('UPDATE orders SET effects_reversed_at=now() WHERE id=$1',[order.id]);
    await setOrderReservationsStatus(client,order.id,'released');
    return;
  }
  await reverseLoyaltyCredit(client, order);
  const { rows: movements } = await client.query(`
    SELECT ingredient_id,product_id,quantity,unit
    FROM stock_movements
    WHERE reference=$1 AND movement_type='Saída'
    FOR UPDATE
  `, [order.id]);
  for (const movement of movements) {
    if (movement.ingredient_id) {
      await client.query('UPDATE ingredients SET current_stock=current_stock+$1,updated_at=now() WHERE id=$2', [movement.quantity, movement.ingredient_id]);
    } else {
      await client.query('UPDATE products SET current_stock=current_stock+$1,updated_at=now() WHERE id=$2', [movement.quantity, movement.product_id]);
    }
    await insertMovement(client, {
      order,
      ingredientId: movement.ingredient_id,
      productId: movement.product_id,
      type: 'Estorno',
      quantity: movement.quantity,
      unit: movement.unit,
      reason: `Estorno automático do pedido #${order.order_number}`,
    });
  }
  const cmv = await client.query("SELECT abs(amount) AS amount FROM financial_entries WHERE effect_key=$1", [`order:${order.id}:cmv`]);
  await client.query(`
    INSERT INTO financial_entries
      (id,entry_date,description,category,entry_type,amount,reference_type,reference_id,created_by,effect_key)
    VALUES ($1,current_date,$2,'Estorno de vendas','Saída',$3,'order',$4,$5,$6)
    ON CONFLICT (effect_key) WHERE effect_key IS NOT NULL DO NOTHING
  `, [randomUUID(), `Estorno do pedido #${order.order_number}`, -Math.abs(Number(order.total)), order.id, order.created_by, `order:${order.id}:sale-reversal`]);
  if (cmv.rowCount) {
    await client.query(`
      INSERT INTO financial_entries
        (id,entry_date,description,category,entry_type,amount,reference_type,reference_id,created_by,effect_key)
      VALUES ($1,current_date,$2,'Estorno de CMV','Entrada',$3,'order',$4,$5,$6)
      ON CONFLICT (effect_key) WHERE effect_key IS NOT NULL DO NOTHING
    `, [randomUUID(), `Estorno de CMV do pedido #${order.order_number}`, Number(cmv.rows[0].amount), order.id, order.created_by, `order:${order.id}:cmv-reversal`]);
  }
  await client.query('UPDATE orders SET effects_reversed_at=now() WHERE id=$1', [order.id]);
  await setOrderReservationsStatus(client,order.id,'released');
}

export async function transitionOrderStatus(client, { orderId, nextStatus, userId = null, ip = null, external = false }) {
  const result = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
  if (!result.rowCount) throw businessError('order_not_found', 404);
  const order = result.rows[0];
  if (!canTransitionOrder(order.status, nextStatus, { external })) {
    if (external) return order;
    throw businessError('invalid_status_transition', 409, { from: order.status, to: nextStatus });
  }
  if (order.status === nextStatus) return order;

  if (isCompletedStatus(nextStatus)) await applyEffects(client, order);
  if (nextStatus === 'Cancelado') await reverseEffects(client, order);
  const updated = await client.query('UPDATE orders SET status=$1,updated_at=now() WHERE id=$2 RETURNING *', [nextStatus, orderId]);
  await client.query(`
    INSERT INTO audit_logs (user_id,action,entity_type,entity_id,metadata,ip)
    VALUES ($1,'order.status','order',$2,$3,$4)
  `, [userId, orderId, { from: order.status, to: nextStatus, external }, ip]);
  await client.query(`
    INSERT INTO order_status_history (order_id,status,previous_status,changed_by,source,metadata)
    VALUES ($1,$2,$3,$4,$5,$6)
  `, [orderId, nextStatus, order.status, userId, external ? 'external' : 'admin', { external }]);
  return updated.rows[0];
}
