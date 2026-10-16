import { randomUUID } from 'node:crypto';
import { canTransitionOrder, isCompletedStatus } from '../domain/orders.js';
import { setOrderReservationsStatus } from './order-stock-reservations.js';
import { expandProductTechnicalSheet } from './technical-sheet-components.js';

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundStock = value => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
const isTestOrder = order => String(order.notes || '').startsWith('[TESTE SEM ESTOQUE]');

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
  const { rows: items } = await client.query(`
    WITH components AS (
      SELECT oi.id,oi.quantity,oi.options,
        COALESCE((SELECT effect->>'productId' FROM jsonb_array_elements(COALESCE(oi.options->'_stockEffects','[]'::jsonb)) effect WHERE effect->>'mode'='replace' LIMIT 1),oi.product_id) AS stock_product_id,
        oi.product_id AS order_product_id,true AS is_main
      FROM order_items oi WHERE oi.order_id=$1
      UNION ALL
      SELECT oi.id,oi.quantity,'{}'::jsonb,effect->>'productId',oi.product_id,false
      FROM order_items oi CROSS JOIN LATERAL jsonb_array_elements(COALESCE(oi.options->'_stockEffects','[]'::jsonb)) effect
      WHERE oi.order_id=$1 AND effect->>'mode'='add'
    )
    SELECT c.order_product_id,c.stock_product_id AS product_id,c.quantity,CASE WHEN c.is_main THEN c.options ELSE '{}'::jsonb END AS options,p.name,p.current_stock,p.purchase_cost,
      ts.id AS sheet_id,ts.product_id AS sheet_product_id,ts.yield
    FROM components c
    LEFT JOIN products p ON p.id=c.stock_product_id
    LEFT JOIN technical_sheets ts ON ts.product_id=CASE
      WHEN c.stock_product_id<>c.order_product_id THEN c.stock_product_id
      WHEN c.order_product_id='p-drk001' AND c.options->>'flavor'='morango' THEN 'p-drk002'
      WHEN c.order_product_id='p-drk001' AND c.options->>'flavor'='maracuja' THEN 'p-drk003'
      ELSE c.stock_product_id END
    ORDER BY c.id,c.is_main DESC
  `, [order.id]);

  let cmv = 0;
  const ingredientTotals=new Map();
  for (const item of items) {
    const orderQuantity = Number(item.quantity);
    if (item.sheet_id) {
      const expanded=await expandProductTechnicalSheet(client,item.sheet_product_id,orderQuantity);
      if(expanded?.error)throw businessError(expanded.error,409,{item:expanded.item});
      if(!expanded)throw businessError('stock_recipe_incomplete',409,{item:item.name});
      for (const component of expanded.items) {
        const current=ingredientTotals.get(component.ingredientId)||{name:component.name,unit:component.unit,quantity:0};
        current.quantity+=component.quantity;ingredientTotals.set(component.ingredientId,current);
      }

      if (item.options?.flavoredIce) {
        const flavoredIce = await client.query("SELECT id,name,unit,active FROM ingredients WHERE id='i-029'");
        if (!flavoredIce.rowCount || !flavoredIce.rows[0].active)throw businessError('stock_recipe_incomplete',409,{item:'Gelo saborizado'});
        const ice=flavoredIce.rows[0],current=ingredientTotals.get(ice.id)||{name:ice.name,unit:ice.unit,quantity:0};
        current.quantity+=orderQuantity;ingredientTotals.set(ice.id,current);
      }
      continue;
    }

    if (!item.product_id || item.current_stock === null) {
      if (item.purchase_cost !== null) cmv += Number(item.purchase_cost) * orderQuantity;
      continue;
    }
    const updated = await client.query(`
      UPDATE products SET current_stock=current_stock-$1,updated_at=now()
      WHERE id=$2 AND current_stock >= $1 RETURNING id
    `, [orderQuantity, item.product_id]);
    if (!updated.rowCount) {
      throw businessError('insufficient_stock', 409, {
        item: item.name,
        required: orderQuantity,
        available: Number(item.current_stock),
        unit: 'un',
      });
    }
    await insertMovement(client, {
      order,
      productId: item.product_id,
      type: 'Saída',
      quantity: orderQuantity,
      unit: 'un',
      reason: `Baixa automática do pedido #${order.order_number}`,
    });
    if (item.purchase_cost !== null) cmv += Number(item.purchase_cost) * orderQuantity;
  }

  const ingredientIds=[...ingredientTotals.keys()].sort();
  if(ingredientIds.length){
    const locked=await client.query('SELECT id,name,unit,current_stock,unit_cost,active FROM ingredients WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[ingredientIds]);
    if(locked.rowCount!==ingredientIds.length)throw businessError('stock_recipe_incomplete',409);
    for(const ingredient of locked.rows){
      if(!ingredient.active)throw businessError('stock_recipe_incomplete',409,{item:ingredient.name});
      cmv+=await consumeIngredient(client,order,ingredient,ingredientTotals.get(ingredient.id).quantity);
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
  if (isTestOrder(order) || order.source?.includes('(Teste)')) {
    await setOrderReservationsStatus(client,order.id,'released');
    await client.query('UPDATE orders SET effects_applied_at=now() WHERE id=$1',[order.id]);
    return;
  }
  const cmv = await applyInventory(client, order);
  await applyFinancialEntries(client, order, cmv);
  await setOrderReservationsStatus(client,order.id,'consumed');
  await client.query('UPDATE orders SET effects_applied_at=now() WHERE id=$1', [order.id]);
}

async function reverseEffects(client, order) {
  if (!order.effects_applied_at || order.effects_reversed_at) {
    await setOrderReservationsStatus(client,order.id,'released');
    return;
  }
  if (isTestOrder(order) || order.source?.includes('(Teste)')) {
    await client.query('UPDATE orders SET effects_reversed_at=now() WHERE id=$1',[order.id]);
    await setOrderReservationsStatus(client,order.id,'released');
    return;
  }
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
