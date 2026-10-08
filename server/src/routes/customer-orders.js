import { authenticateCustomer } from '../middleware/customer-auth.js';

export default async function customerOrderRoutes(app) {
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
    const [items, history] = await Promise.all([
      app.db.query('SELECT product_id,name,quantity,unit_price,subtotal,options FROM order_items WHERE order_id=$1 ORDER BY id', [request.params.id]),
      app.db.query('SELECT status,previous_status,created_at,source FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id', [request.params.id]),
    ]);
    return { data: { ...order.rows[0], items: items.rows, history: history.rows } };
  });
}
