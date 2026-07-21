import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';

const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(8).max(24),
  }),
  fulfillmentType: z.enum(['retirada', 'entrega']),
  address: z.object({
    street: z.string().trim().max(160).default(''),
    number: z.string().trim().max(30).default(''),
    district: z.string().trim().max(100).default(''),
    complement: z.string().trim().max(120).default(''),
    reference: z.string().trim().max(180).default(''),
  }).default({}),
  paymentMethod: z.enum(['Pix', 'Dinheiro', 'Cartão na entrega']),
  notes: z.string().trim().max(500).default(''),
  adultConfirmed: z.boolean().default(false),
  website: z.string().max(0).optional(),
  items: z.array(z.object({
    productId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(20),
  })).min(1).max(30),
});

export default async function publicOrderRoutes(app) {
  app.get('/public/catalog', async () => {
    const { rows } = await app.db.query(`
      SELECT id, name, category, description, sale_price, photo_url
      FROM products
      WHERE active = true AND (current_stock IS NULL OR current_stock > 0)
      ORDER BY category, name
    `);
    return { data: rows };
  });

  app.post('/public/orders', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = orderSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const input = parsed.data;
    if (input.website) return reply.code(400).send({ error: 'invalid_request' });
    if (input.fulfillmentType === 'entrega' && (!input.address.street || !input.address.number || !input.address.district)) {
      return reply.code(400).send({ error: 'delivery_address_required' });
    }

    const ids = [...new Set(input.items.map(item => item.productId))];
    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`
        SELECT id, name, category, sale_price, current_stock
        FROM products WHERE id = ANY($1::text[]) AND active = true
        FOR SHARE
      `, [ids]);
      if (result.rowCount !== ids.length) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'product_unavailable' });
      }

      const products = new Map(result.rows.map(product => [product.id, product]));
      const hasAlcohol = result.rows.some(product => ['Drinks', 'Cervejas'].includes(product.category));
      if (hasAlcohol && !input.adultConfirmed) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'adult_confirmation_required' });
      }

      const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
      const insufficientStock = input.items.some(item => {
        const stock = products.get(item.productId)?.current_stock;
        return stock !== null && Number(stock) < item.quantity;
      });
      if (insufficientStock) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'insufficient_stock' });
      }

      const items = input.items.map(item => {
        const product = products.get(item.productId);
        const unitPrice = Number(product.sale_price);
        return { ...item, name: product.name, unitPrice, subtotal: roundMoney(unitPrice * item.quantity) };
      });
      const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
      const deliveryFee = input.fulfillmentType === 'entrega' ? config.DEFAULT_DELIVERY_FEE : 0;
      const total = roundMoney(subtotal + deliveryFee);
      const id = `web-${randomUUID()}`;
      const numberResult = await client.query("SELECT nextval('order_number_seq') AS number");
      const orderNumber = Number(numberResult.rows[0].number);

      await client.query(`
        INSERT INTO orders (id, order_number, source, client_name, customer_phone, status,
          subtotal, delivery_fee, discount, total, payment_method, notes, fulfillment_type, delivery_address)
        VALUES ($1,$2,'Cardápio Digital',$3,$4,'Novo',$5,$6,0,$7,$8,$9,$10,$11)
      `, [id, orderNumber, input.customer.name, input.customer.phone, subtotal, deliveryFee, total,
        input.paymentMethod, input.notes, input.fulfillmentType, input.address]);

      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, name, quantity, unit_price, subtotal)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [id, item.productId, item.name, item.quantity, item.unitPrice, item.subtotal]);
      }
      await client.query('COMMIT');
      return reply.code(201).send({ data: { id, orderNumber, status: 'Novo', subtotal, deliveryFee, total } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
