import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ORDER_STATUSES } from '../domain/orders.js';
import { requirePermission } from '../middleware/auth.js';
import { transitionOrderStatus } from '../services/order-effects.js';
import { priceOrderItems, roundMoney } from '../services/order-pricing.js';

const listSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const idSchema = z.string().min(1).max(200);
const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });
const createSchema = z.object({
  clientId: z.string().max(100).nullable().optional(),
  clientName: z.string().trim().min(1).max(120).default('Balcão'),
  source: z.enum(['WhatsApp', 'iFood', 'Site', 'Instagram', 'Balcão', 'Telefone']).default('Balcão'),
  paymentMethod: z.enum(['Dinheiro', 'Cartão Débito', 'Cartão Crédito', 'PIX', 'iFood', 'Fiado']),
  notes: z.string().trim().max(500).default(''),
  deliveryFee: z.number().nonnegative().max(10000).default(0),
  discount: z.number().nonnegative().max(10000).default(0),
  items: z.array(z.object({
    productId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(100),
    options: z.record(z.string(), z.unknown()).default({}),
  })).min(1).max(50),
});

function serializeOrder(row) {
  return {
    id: row.id,
    orderNumber: Number(row.order_number),
    source: row.source,
    clientId: row.client_id,
    clientName: row.client_name,
    customerPhone: row.customer_phone,
    status: row.status,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    discount: Number(row.discount),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    notes: row.notes,
    fulfillmentType: row.fulfillment_type,
    deliveryAddress: row.delivery_address,
    effectsAppliedAt: row.effects_applied_at,
    effectsReversedAt: row.effects_reversed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.items || [],
  };
}

const orderSelect = `
  SELECT o.*,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id',oi.id,'productId',oi.product_id,'name',oi.name,'quantity',oi.quantity,
      'unitPrice',oi.unit_price,'subtotal',oi.subtotal,'options',oi.options
    ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL),'[]'::jsonb) AS items
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id=o.id
`;

export default async function orderRoutes(app) {
  app.post('/orders', { preHandler: requirePermission('orders.write') }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const input = parsed.data;
    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const priced = await priceOrderItems(client, input.items, { lock: true });
      if (!priced) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'product_unavailable' });
      }
      if (priced.items.some(item => item.currentStock !== null && Number(item.currentStock) < item.quantity)) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'insufficient_stock' });
      }
      if (input.discount > priced.subtotal + input.deliveryFee) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'invalid_discount' });
      }
      let clientId = input.clientId || null;
      let clientName = input.clientName;
      if (clientId) {
        const customer = await client.query('SELECT id,name FROM clients WHERE id=$1 AND active=true', [clientId]);
        if (!customer.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'client_not_found' });
        }
        clientName = customer.rows[0].name;
      }
      const id = `pos-${randomUUID()}`;
      const numberResult = await client.query("SELECT nextval('order_number_seq') AS number");
      const orderNumber = Number(numberResult.rows[0].number);
      const total = roundMoney(priced.subtotal + input.deliveryFee - input.discount);
      await client.query(`
        INSERT INTO orders
          (id,order_number,source,client_id,client_name,status,subtotal,delivery_fee,discount,total,
           payment_method,notes,fulfillment_type,created_by)
        VALUES ($1,$2,$3,$4,$5,'Novo',$6,$7,$8,$9,$10,$11,$12,$13)
      `, [id,orderNumber,input.source,clientId,clientName,priced.subtotal,input.deliveryFee,input.discount,total,
        input.paymentMethod,input.notes,input.deliveryFee > 0 ? 'entrega' : 'retirada',request.user.id]);
      for (const item of priced.items) {
        await client.query(`
          INSERT INTO order_items (order_id,product_id,name,quantity,unit_price,subtotal,options)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [id,item.productId,item.name,item.quantity,item.unitPrice,item.subtotal,item.options]);
      }
      await client.query(`
        INSERT INTO audit_logs (user_id,action,entity_type,entity_id,metadata,ip)
        VALUES ($1,'order.create','order',$2,$3,$4)
      `, [request.user.id,id,{ source: input.source, total },request.ip]);
      const current = await client.query(`${orderSelect} WHERE o.id=$1 GROUP BY o.id`, [id]);
      await client.query('COMMIT');
      return reply.code(201).send({ data: serializeOrder(current.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/orders', { preHandler: requirePermission('orders.read') }, async (request, reply) => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error' });
    const { status, limit, offset } = parsed.data;
    const result = await app.db.query(`${orderSelect}
      WHERE ($1::text IS NULL OR o.status=$1)
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT $2 OFFSET $3
    `, [status || null, limit, offset]);
    return { data: result.rows.map(serializeOrder), pagination: { limit, offset } };
  });

  app.get('/orders/:id', { preHandler: requirePermission('orders.read') }, async (request, reply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'validation_error' });
    const result = await app.db.query(`${orderSelect} WHERE o.id=$1 GROUP BY o.id`, [id.data]);
    if (!result.rowCount) return reply.code(404).send({ error: 'order_not_found' });
    return { data: serializeOrder(result.rows[0]) };
  });

  app.patch('/orders/:id/status', { preHandler: requirePermission('orders.write') }, async (request, reply) => {
    const id = idSchema.safeParse(request.params.id);
    const body = statusSchema.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: 'validation_error' });
    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const order = await transitionOrderStatus(client, {
        orderId: id.data,
        nextStatus: body.data.status,
        userId: request.user.id,
        ip: request.ip,
      });
      const current = await client.query(`${orderSelect} WHERE o.id=$1 GROUP BY o.id`, [order.id]);
      await client.query('COMMIT');
      return { data: serializeOrder(current.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
