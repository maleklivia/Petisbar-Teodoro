import { authenticateCustomer } from '../middleware/customer-auth.js';

export default async function customerOrderRoutes(app) {
  app.get('/customer/loyalty', { preHandler: authenticateCustomer }, async request => {
    const result = await app.db.query(`SELECT COALESCE(SUM(CASE WHEN entry_type IN ('credito','ajuste') THEN amount ELSE -amount END),0) AS balance
      FROM cashback_ledger WHERE customer_account_id=$1 AND (expires_at IS NULL OR expires_at>now())`, [request.customer.id]);
    const setting = await app.db.query('SELECT active,cashback_percent,expires_in_days FROM loyalty_settings WHERE id=true');
    return { data: { active: Boolean(setting.rows[0]?.active), balance: Number(result.rows[0]?.balance || 0), cashbackPercent: Number(setting.rows[0]?.cashback_percent || 5), expiresInDays: Number(setting.rows[0]?.expires_in_days || 30) } };
  });
  app.get('/customer/reorder-shortcuts', { preHandler: authenticateCustomer }, async request => {
    const orders=await app.db.query(`SELECT id,order_number,created_at,total FROM orders
      WHERE customer_account_id=$1 ORDER BY created_at DESC LIMIT 3`,[request.customer.id]);
    if(!orders.rowCount)return {data:[]};
    const ids=orders.rows.map(order=>order.id);
    const [items,promotions]=await Promise.all([
      app.db.query(`SELECT order_id,product_id,name,quantity,options-'_stockEffects' AS options,promotion_application_id,combo_group_id,combo_group_name
        FROM order_items WHERE order_id=ANY($1::text[]) ORDER BY order_id,id`,[ids]),
      app.db.query(`SELECT id,order_id,promotion_id,code,name,rule_type,item_snapshot FROM promotion_applications
        WHERE order_id=ANY($1::text[]) ORDER BY order_id,created_at,id`,[ids]),
    ]);
    const itemsByOrder=new Map(),promosByOrder=new Map();
    for(const item of items.rows){const rows=itemsByOrder.get(item.order_id)||[];rows.push(item);itemsByOrder.set(item.order_id,rows);}
    for(const promotion of promotions.rows){const rows=promosByOrder.get(promotion.order_id)||[];rows.push(promotion);promosByOrder.set(promotion.order_id,rows);}
    return {data:orders.rows.map(order=>({
      id:order.id,orderNumber:order.order_number,createdAt:order.created_at,total:Number(order.total),
      items:itemsByOrder.get(order.id)||[],promotions:promosByOrder.get(order.id)||[],
    }))};
  });

  app.get('/customer/orders', { preHandler: authenticateCustomer }, async request => {
    const orders = await app.db.query(`
      SELECT id, order_number, status, created_at, subtotal, delivery_fee, discount, total,
             payment_method, fulfillment_type
      FROM orders WHERE customer_account_id=$1 ORDER BY created_at DESC LIMIT 100
    `, [request.customer.id]);
    return { data: orders.rows };
  });

  app.get('/customer/orders/:id', { preHandler: authenticateCustomer }, async (request, reply) => {
    const order = await app.db.query(`
      SELECT id, order_number, status, created_at, subtotal, delivery_fee, discount, total,
             payment_method, fulfillment_type, notes
      FROM orders WHERE id=$1 AND customer_account_id=$2
    `, [request.params.id, request.customer.id]);
    if (!order.rowCount) return reply.code(404).send({ error: 'order_not_found' });
    const [items, history, promotions] = await Promise.all([
      app.db.query("SELECT product_id,name,quantity,unit_price,subtotal,options-'_stockEffects' AS options,promotion_application_id,combo_group_id,combo_group_name FROM order_items WHERE order_id=$1 ORDER BY id", [request.params.id]),
      app.db.query('SELECT status,previous_status,created_at,source FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id', [request.params.id]),
      app.db.query('SELECT id,promotion_id,code,name,rule_type,item_snapshot FROM promotion_applications WHERE order_id=$1 ORDER BY created_at,id',[request.params.id]),
    ]);
    return { data: { ...order.rows[0], items: items.rows, history: history.rows, promotions:promotions.rows } };
  });
}
