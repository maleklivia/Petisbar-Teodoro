import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';

const productSchema = z.object({
  id: z.string().min(1).max(100),
  sku: z.string().max(50).nullable().optional(),
  nome: z.string().min(1).max(200),
  categoria: z.string().min(1).max(100),
  descricao: z.string().max(2000).default(''),
  precoVenda: z.number().nonnegative(),
  precoIfood: z.number().nonnegative().nullable().optional(),
  ativoIfood: z.boolean().default(false),
  custoCompra: z.number().nonnegative().nullable().optional(),
  ativo: z.boolean().default(true),
  tempoPreparo: z.number().int().nonnegative().default(0),
  estoqueAtual: z.number().nonnegative().nullable().optional(),
  estoqueMinimo: z.number().nonnegative().nullable().optional(),
  foto: z.string().max(500).nullable().optional(),
});

export default async function catalogRoutes(app) {
  app.get('/products', { preHandler: requirePermission('catalog.read') }, async () => {
    const { rows } = await app.db.query('SELECT * FROM products ORDER BY category, name');
    return { data: rows };
  });

  app.post('/products', { preHandler: requirePermission('catalog.write') }, async (request, reply) => {
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const p = parsed.data;
    const { rows } = await app.db.query(`
      INSERT INTO products (id, sku, name, category, description, sale_price, purchase_cost, active,
        preparation_minutes, current_stock, minimum_stock, photo_url, ifood_price, ifood_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku, name=EXCLUDED.name, category=EXCLUDED.category,
        description=EXCLUDED.description, sale_price=EXCLUDED.sale_price, purchase_cost=EXCLUDED.purchase_cost,
        active=EXCLUDED.active, preparation_minutes=EXCLUDED.preparation_minutes,
        current_stock=EXCLUDED.current_stock, minimum_stock=EXCLUDED.minimum_stock,
        photo_url=EXCLUDED.photo_url, ifood_price=EXCLUDED.ifood_price, ifood_active=EXCLUDED.ifood_active, updated_at=now()
      RETURNING *
    `, [p.id,p.sku||null,p.nome,p.categoria,p.descricao,p.precoVenda,p.custoCompra??null,p.ativo,
      p.tempoPreparo,p.estoqueAtual??null,p.estoqueMinimo??null,p.foto??null,p.precoIfood??null,p.ativoIfood]);
    return reply.code(201).send({ data: rows[0] });
  });

  app.get('/ingredients', { preHandler: requirePermission('stock.read') }, async () => {
    const { rows } = await app.db.query(`
      SELECT *, GREATEST(minimum_stock, average_daily_use * lead_time_days) AS reorder_point
      FROM ingredients WHERE active = true ORDER BY category, name
    `);
    return { data: rows };
  });
}
