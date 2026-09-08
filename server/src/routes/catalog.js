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

const ingredientSchema = z.object({
  id: z.string().min(1).max(100),
  sku: z.string().max(50).nullable().optional(),
  nome: z.string().min(1).max(200),
  categoria: z.string().min(1).max(100),
  unidade: z.string().min(1).max(20),
  estoqueAtual: z.number().nonnegative(),
  estoqueMinimo: z.number().nonnegative(),
  consumoMedioDiario: z.number().nonnegative().default(0),
  prazoReposicaoDias: z.number().int().nonnegative().default(0),
  quantidadePacote: z.number().positive().default(1),
  custoUnitario: z.number().nonnegative(),
  fornecedor: z.string().max(200).default(''),
  ativo: z.boolean().default(true),
});

const technicalSheetSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  rendimento: z.number().positive().default(1),
  itens: z.array(z.object({
    ingredienteId: z.string().min(1).max(100),
    quantidade: z.number().positive(),
    unidade: z.string().min(1).max(20),
  })).default([]),
});

function sheetRows(rows) {
  return rows.map(row => ({
    id: row.id,
    productId: row.product_id,
    rendimento: Number(row.yield),
    updatedAt: row.updated_at,
    items: row.items || [],
  }));
}

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

  app.delete('/products/:id', { preHandler: requirePermission('catalog.write') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const { rows } = await app.db.query('UPDATE products SET active=false, updated_at=now() WHERE id=$1 RETURNING *', [id]);
    if (!rows[0]) return reply.code(404).send({ error: 'product_not_found' });
    return { data: rows[0] };
  });

  app.get('/ingredients', { preHandler: requirePermission('stock.read') }, async () => {
    const { rows } = await app.db.query(`
      SELECT *, GREATEST(minimum_stock, average_daily_use * lead_time_days) AS reorder_point
      FROM ingredients ORDER BY category, name
    `);
    return { data: rows };
  });

  app.post('/ingredients', { preHandler: requirePermission('stock.write') }, async (request, reply) => {
    const parsed = ingredientSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const i = parsed.data;
    const { rows } = await app.db.query(`
      INSERT INTO ingredients (id, sku, name, category, unit, current_stock, minimum_stock, average_daily_use,
        lead_time_days, package_quantity, unit_cost, supplier_name, active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku, name=EXCLUDED.name, category=EXCLUDED.category,
        unit=EXCLUDED.unit, current_stock=EXCLUDED.current_stock, minimum_stock=EXCLUDED.minimum_stock,
        average_daily_use=EXCLUDED.average_daily_use, lead_time_days=EXCLUDED.lead_time_days,
        package_quantity=EXCLUDED.package_quantity, unit_cost=EXCLUDED.unit_cost,
        supplier_name=EXCLUDED.supplier_name, active=EXCLUDED.active, updated_at=now()
      RETURNING *, GREATEST(minimum_stock, average_daily_use * lead_time_days) AS reorder_point
    `, [
      i.id, i.sku || null, i.nome, i.categoria, i.unidade, i.estoqueAtual, i.estoqueMinimo,
      i.consumoMedioDiario, i.prazoReposicaoDias, i.quantidadePacote, i.custoUnitario,
      i.fornecedor, i.ativo,
    ]);
    return reply.code(201).send({ data: rows[0] });
  });

  app.delete('/ingredients/:id', { preHandler: requirePermission('stock.write') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const { rows } = await app.db.query(`
      UPDATE ingredients SET active=false, updated_at=now()
      WHERE id=$1
      RETURNING *, GREATEST(minimum_stock, average_daily_use * lead_time_days) AS reorder_point
    `, [id]);
    if (!rows[0]) return reply.code(404).send({ error: 'ingredient_not_found' });
    return { data: rows[0] };
  });

  app.get('/technical-sheets', { preHandler: requirePermission('catalog.read') }, async () => {
    const { rows } = await app.db.query(`
      SELECT ts.id, ts.product_id, ts.yield, ts.updated_at,
        COALESCE(json_agg(json_build_object(
          'ingredientId', tsi.ingredient_id,
          'quantity', tsi.quantity,
          'unit', tsi.unit
        ) ORDER BY i.name) FILTER (WHERE tsi.ingredient_id IS NOT NULL), '[]'::json) AS items
      FROM technical_sheets ts
      LEFT JOIN technical_sheet_items tsi ON tsi.sheet_id = ts.id
      LEFT JOIN ingredients i ON i.id = tsi.ingredient_id
      GROUP BY ts.id
      ORDER BY ts.product_id
    `);
    return { data: sheetRows(rows) };
  });

  app.put('/technical-sheets/:productId', { preHandler: requirePermission('catalog.write') }, async (request, reply) => {
    const productId = z.string().min(1).max(100).parse(request.params.productId);
    const parsed = technicalSheetSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });

    const uniqueIngredientIds = new Set();
    for (const item of parsed.data.itens) {
      if (uniqueIngredientIds.has(item.ingredienteId)) {
        return reply.code(400).send({ error: 'duplicate_ingredient' });
      }
      uniqueIngredientIds.add(item.ingredienteId);
    }

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const product = await client.query('SELECT id FROM products WHERE id=$1', [productId]);
      if (!product.rowCount) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'product_not_found' });
      }

      if (uniqueIngredientIds.size) {
        const ingredients = await client.query('SELECT id FROM ingredients WHERE id = ANY($1::text[])', [[...uniqueIngredientIds]]);
        if (ingredients.rowCount !== uniqueIngredientIds.size) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: 'ingredient_not_found' });
        }
      }

      const sheetId = parsed.data.id || `ts-${productId}`;
      const sheet = await client.query(`
        INSERT INTO technical_sheets (id, product_id, yield, updated_at)
        VALUES ($1,$2,$3,now())
        ON CONFLICT (product_id) DO UPDATE SET yield=EXCLUDED.yield, updated_at=now()
        RETURNING id
      `, [sheetId, productId, parsed.data.rendimento]);

      await client.query('DELETE FROM technical_sheet_items WHERE sheet_id=$1', [sheet.rows[0].id]);
      for (const item of parsed.data.itens) {
        await client.query(`
          INSERT INTO technical_sheet_items (sheet_id, ingredient_id, quantity, unit)
          VALUES ($1,$2,$3,$4)
        `, [sheet.rows[0].id, item.ingredienteId, item.quantidade, item.unidade]);
      }

      const { rows } = await client.query(`
        SELECT ts.id, ts.product_id, ts.yield, ts.updated_at,
          COALESCE(json_agg(json_build_object(
            'ingredientId', tsi.ingredient_id,
            'quantity', tsi.quantity,
            'unit', tsi.unit
          ) ORDER BY i.name) FILTER (WHERE tsi.ingredient_id IS NOT NULL), '[]'::json) AS items
        FROM technical_sheets ts
        LEFT JOIN technical_sheet_items tsi ON tsi.sheet_id = ts.id
        LEFT JOIN ingredients i ON i.id = tsi.ingredient_id
        WHERE ts.product_id=$1
        GROUP BY ts.id
      `, [productId]);
      await client.query('COMMIT');
      return { data: sheetRows(rows)[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
