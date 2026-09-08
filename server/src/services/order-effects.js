import { randomUUID } from 'node:crypto';
import { canTransitionOrder, convertQuantity, isCompletedStatus } from '../domain/orders.js';

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundStock = value => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;

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
    SELECT oi.product_id,oi.quantity,oi.options,p.name,p.current_stock,p.purchase_cost,
      ts.id AS sheet_id,ts.yield
    FROM order_items oi
    LEFT JOIN products p ON p.id=oi.product_id
    LEFT JOIN technical_sheets ts ON ts.product_id=oi.product_id
    WHERE oi.order_id=$1
    ORDER BY oi.id
  `, [order.id]);

  let cmv = 0;
  for (const item of items) {
    const orderQuantity = Number(item.quantity);
    if (item.sheet_id) {
      const { rows: ingredients } = await client.query(`
        SELECT i.id,i.name,i.unit,i.current_stock,i.unit_cost,
          tsi.quantity AS recipe_quantity,tsi.unit AS recipe_unit
        FROM technical_sheet_items tsi
        JOIN ingredients i ON i.id=tsi.ingredient_id
        WHERE tsi.sheet_id=$1
        ORDER BY i.id
        FOR UPDATE OF i
      `, [item.sheet_id]);
      for (const ingredient of ingredients) {
        const recipeQuantity = Number(ingredient.recipe_quantity) * orderQuantity / Number(item.yield || 1);
        const required = convertQuantity(recipeQuantity, ingredient.recipe_unit, ingredient.unit);
        cmv += await consumeIngredient(client, order, ingredient, required);
      }

      if (item.options?.flavoredIce) {
        const flavoredIce = await client.query("SELECT id,name,unit,current_stock,unit_cost FROM ingredients WHERE id='i-029' FOR UPDATE");
        if (flavoredIce.rowCount) cmv += await consumeIngredient(client, order, flavoredIce.rows[0], orderQuantity);
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
  return roundMoney(cmv);
}

async function applyFinancialEntries(client, order, cmv) {
  await client.query(`
    INSERT INTO financial_entries
      (id,entry_date,description,category,entry_type,amount,reference_type,reference_id,created_by,effect_key)
    VALUES ($1,current_date,$2,'Vendas','Entrada',$3,'order',$4,$5,$6)
    ON CONFLICT (effect_key) DO NOTHING
  `, [randomUUID(), `Pedido #${order.order_number} · ${order.source}`, order.total, order.id, order.created_by, `order:${order.id}:sale`]);
  if (cmv > 0) {
    await client.query(`
      INSERT INTO financial_entries
        (id,entry_date,description,category,entry_type,amount,reference_type,reference_id,created_by,effect_key)
      VALUES ($1,current_date,$2,'CMV','Saída',$3,'order',$4,$5,$6)
      ON CONFLICT (effect_key) DO NOTHING
    `, [randomUUID(), `CMV do pedido #${order.order_number}`, -Math.abs(cmv), order.id, order.created_by, `order:${order.id}:cmv`]);
  }
}

async function applyEffects(client, order) {
  if (order.effects_applied_at && !order.effects_reversed_at) return;
  if (order.effects_reversed_at) throw businessError('order_effects_already_reversed');
  const cmv = await applyInventory(client, order);
  await applyFinancialEntries(client, order, cmv);
  await client.query('UPDATE orders SET effects_applied_at=now() WHERE id=$1', [order.id]);
}

async function reverseEffects(client, order) {
  if (!order.effects_applied_at || order.effects_reversed_at) return;
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
    ON CONFLICT (effect_key) DO NOTHING
  `, [randomUUID(), `Estorno do pedido #${order.order_number}`, -Math.abs(Number(order.total)), order.id, order.created_by, `order:${order.id}:sale-reversal`]);
  if (cmv.rowCount) {
    await client.query(`
      INSERT INTO financial_entries
        (id,entry_date,description,category,entry_type,amount,reference_type,reference_id,created_by,effect_key)
      VALUES ($1,current_date,$2,'Estorno de CMV','Entrada',$3,'order',$4,$5,$6)
      ON CONFLICT (effect_key) DO NOTHING
    `, [randomUUID(), `Estorno de CMV do pedido #${order.order_number}`, Number(cmv.rows[0].amount), order.id, order.created_by, `order:${order.id}:cmv-reversal`]);
  }
  await client.query('UPDATE orders SET effects_reversed_at=now() WHERE id=$1', [order.id]);
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
  return updated.rows[0];
}
