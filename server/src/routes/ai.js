import { z } from 'zod';
import { config } from '../config.js';
import { requirePermission } from '../middleware/auth.js';
import { askOpenAI } from '../services/openai-client.js';

const questionSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

async function operationalSnapshot(db) {
  const [orders, finance, stock, catalog, purchases] = await Promise.all([
    db.query(`
      SELECT
        count(*) FILTER (WHERE created_at::date = current_date) AS today,
        count(*) FILTER (WHERE status = ANY($1::text[])) AS pending,
        count(*) FILTER (WHERE source = 'iFood' AND created_at >= date_trunc('month', now())) AS ifood_month
      FROM orders
    `, [['Novo', 'Aguardando Pagamento', 'Pago', 'Em Produção', 'Pronto']]),
    db.query(`
      SELECT
        COALESCE(sum(amount) FILTER (WHERE entry_type = 'Entrada'), 0) AS income,
        COALESCE(sum(abs(amount)) FILTER (WHERE entry_type = 'Saída'), 0) AS expense
      FROM financial_entries
      WHERE entry_date >= date_trunc('month', current_date)::date
    `),
    db.query(`
      SELECT name, unit, current_stock, minimum_stock, average_daily_use, lead_time_days,
        GREATEST(minimum_stock, average_daily_use * lead_time_days) AS reorder_point
      FROM ingredients
      WHERE active = true
        AND current_stock <= GREATEST(minimum_stock, average_daily_use * lead_time_days)
      ORDER BY
        CASE WHEN average_daily_use > 0 THEN current_stock / average_daily_use ELSE 999999 END,
        name
      LIMIT 20
    `),
    db.query(`
      SELECT
        count(*) FILTER (WHERE active = true) AS active_products,
        count(*) FILTER (WHERE active = true AND ts.id IS NULL) AS products_without_sheet,
        count(*) FILTER (WHERE active = true AND purchase_cost IS NULL) AS products_without_cost
      FROM products p
      LEFT JOIN technical_sheets ts ON ts.product_id = p.id
    `),
    db.query(`
      SELECT count(*) AS pending
      FROM purchases
      WHERE status <> ALL($1::text[])
    `, [['Recebido', 'Cancelado']]),
  ]);

  const income = Number(finance.rows[0].income);
  const expense = Number(finance.rows[0].expense);
  return {
    generatedAt: new Date().toISOString(),
    orders: {
      today: Number(orders.rows[0].today),
      pending: Number(orders.rows[0].pending),
      ifoodThisMonth: Number(orders.rows[0].ifood_month),
    },
    financeThisMonth: { income, expense, result: income - expense },
    criticalStock: stock.rows.map(item => ({
      name: item.name,
      unit: item.unit,
      current: Number(item.current_stock),
      minimum: Number(item.minimum_stock),
      averageDailyUse: Number(item.average_daily_use),
      leadTimeDays: Number(item.lead_time_days),
      reorderPoint: Number(item.reorder_point),
    })),
    catalog: {
      activeProducts: Number(catalog.rows[0].active_products),
      productsWithoutTechnicalSheet: Number(catalog.rows[0].products_without_sheet),
      productsWithoutCost: Number(catalog.rows[0].products_without_cost),
    },
    purchases: { pending: Number(purchases.rows[0].pending) },
  };
}

export default async function aiRoutes(app) {
  app.get('/ai/status', { preHandler: requirePermission('reports.read') }, async () => ({
    data: { enabled: config.AI_ENABLED, model: config.OPENAI_MODEL, approvalRequired: true },
  }));

  app.post('/ai/ask', {
    preHandler: requirePermission('reports.read'),
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (!config.AI_ENABLED) return reply.code(503).send({ error: 'ai_not_configured' });
    const parsed = questionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error' });
    const snapshot = await operationalSnapshot(app.db);
    const result = await askOpenAI({
      question: parsed.data.question,
      snapshot,
      userId: request.user.id,
    });
    await app.db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, metadata, ip)
      VALUES ($1, 'ai.question', 'ai_center', $2, $3)
    `, [request.user.id, { responseId: result.responseId, model: result.model }, request.ip]);
    return { data: { answer: result.answer, model: result.model } };
  });
}
