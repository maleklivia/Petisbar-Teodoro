import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';

const purchaseItemSchema = z.object({
  ingredienteId: z.string().min(1).max(100),
  nome: z.string().min(1).max(200).optional(),
  quantidade: z.number().positive(),
  unidade: z.string().min(1).max(20),
  custoUnitario: z.number().nonnegative(),
});

const purchaseSchema = z.object({
  fornecedorId: z.string().max(100).optional().nullable(),
  fornecedorNome: z.string().max(200).default(''),
  tipo: z.enum(['manual', 'automatico']).default('manual'),
  status: z.enum(['Rascunho', 'Aprovado', 'Pedido']).default('Aprovado'),
  observacoes: z.string().max(2000).default(''),
  dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notaFiscal: z.string().max(100).default(''),
  formaPagamento: z.string().max(200).default(''),
  itens: z.array(purchaseItemSchema).min(1),
}).superRefine((purchase, ctx) => {
  const seen = new Set();
  for (let index = 0; index < purchase.itens.length; index += 1) {
    const ingredientId = purchase.itens[index].ingredienteId;
    if (seen.has(ingredientId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ingrediente duplicado na compra',
        path: ['itens', index, 'ingredienteId'],
      });
    }
    seen.add(ingredientId);
  }
});

const statusSchema = z.object({
  status: z.enum(['Rascunho', 'Aprovado', 'Pedido', 'Recebido', 'Cancelado']),
});

function number(value) {
  return Number(value || 0);
}

function mapPurchase(row) {
  return {
    id: row.id,
    numeroPedidoCompra: Number(row.purchase_number),
    fornecedorId: row.supplier_id || '',
    fornecedorNome: row.supplier_name,
    status: row.status,
    tipo: row.purchase_type || 'manual',
    itens: (row.items || []).map(item => ({
      id: item.id,
      ingredienteId: item.ingredientId,
      nome: item.name,
      quantidade: Number(item.quantity),
      unidade: item.unit,
      custoUnitario: Number(item.unitCost),
      subtotal: Number(item.subtotal),
    })),
    total: number(row.total),
    observacoes: row.notes,
    dataCompra: row.purchased_at ? String(row.purchased_at).slice(0, 10) : '',
    dataRecebimento: row.received_at ? String(row.received_at).slice(0, 10) : '',
    notaFiscal: row.invoice_number,
    formaPagamento: row.payment_method,
    criadoEm: row.created_at,
  };
}

async function fetchPurchase(client, id) {
  const { rows } = await client.query(`
    SELECT p.*,
      COALESCE(json_agg(json_build_object(
        'id', pi.id,
        'ingredientId', pi.ingredient_id,
        'name', pi.name,
        'quantity', pi.quantity,
        'unit', pi.unit,
        'unitCost', pi.unit_cost,
        'subtotal', pi.subtotal
      ) ORDER BY pi.name) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS items
    FROM purchases p
    LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
    WHERE p.id=$1
    GROUP BY p.id
  `, [id]);
  return rows[0] ? mapPurchase(rows[0]) : null;
}

async function insertPurchaseItems(client, purchaseId, items) {
  for (const item of items) {
    const ingredient = await client.query('SELECT name, unit FROM ingredients WHERE id=$1', [item.ingredienteId]);
    const name = item.nome || ingredient.rows[0]?.name || 'Ingrediente';
    const subtotal = item.quantidade * item.custoUnitario;
    await client.query(`
      INSERT INTO purchase_items (purchase_id, ingredient_id, name, quantity, unit, unit_cost, subtotal)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [purchaseId, item.ingredienteId, name, item.quantidade, item.unidade, item.custoUnitario, subtotal]);
  }
}

async function applyReceipt(client, purchase, userId) {
  if (purchase.status === 'Recebido' && purchase.dataRecebimento) return;
  const receivedAt = new Date().toISOString().slice(0, 10);
  const items = await client.query('SELECT * FROM purchase_items WHERE purchase_id=$1', [purchase.id]);

  for (const item of items.rows) {
    const ingredient = await client.query('SELECT * FROM ingredients WHERE id=$1 FOR UPDATE', [item.ingredient_id]);
    if (!ingredient.rowCount) continue;
    const nextStock = number(ingredient.rows[0].current_stock) + number(item.quantity);
    await client.query(`
      UPDATE ingredients
      SET current_stock=$2, unit_cost=$3, updated_at=now()
      WHERE id=$1
    `, [item.ingredient_id, nextStock, item.unit_cost]);
    await client.query(`
      INSERT INTO stock_movements (id, ingredient_id, movement_type, quantity, unit, reason, reference, movement_date, created_by)
      VALUES ($1,$2,'entrada',$3,$4,'compra',$5,$6,$7)
      ON CONFLICT (id) DO NOTHING
    `, [`mov-purchase-${purchase.id}-${item.ingredient_id}`, item.ingredient_id, item.quantity, item.unit, purchase.id, receivedAt, userId]);
  }

  await client.query(`
    INSERT INTO financial_entries (id, entry_date, description, category, entry_type, amount, reference_type, reference_id, effect_key, created_by)
    VALUES ($1,$2,$3,'Fornecedores','Saída',$4,'purchase',$5,$6,$7)
    ON CONFLICT (effect_key) WHERE effect_key IS NOT NULL DO NOTHING
  `, [
    `fin-purchase-${purchase.id}`,
    receivedAt,
    `Compra #${purchase.numeroPedidoCompra} · ${purchase.fornecedorNome}`,
    -Math.abs(purchase.total),
    purchase.id,
    `purchase:${purchase.id}:expense`,
    userId,
  ]);

  await client.query('UPDATE purchases SET status=$2, received_at=$3 WHERE id=$1', [purchase.id, 'Recebido', receivedAt]);
}

export default async function purchasesRoutes(app) {
  app.get('/purchases', { preHandler: requirePermission('purchases.manage') }, async () => {
    const { rows } = await app.db.query(`
      SELECT p.*,
        COALESCE(json_agg(json_build_object(
          'id', pi.id,
          'ingredientId', pi.ingredient_id,
          'name', pi.name,
          'quantity', pi.quantity,
          'unit', pi.unit,
          'unitCost', pi.unit_cost,
          'subtotal', pi.subtotal
        ) ORDER BY pi.name) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS items
      FROM purchases p
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    return { data: rows.map(mapPurchase) };
  });

  app.post('/purchases', { preHandler: requirePermission('purchases.manage') }, async (request, reply) => {
    const parsed = purchaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const data = parsed.data;
    const total = data.itens.reduce((sum, item) => sum + item.quantidade * item.custoUnitario, 0);
    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const numberResult = await client.query('SELECT COALESCE(max(purchase_number), 0) + 1 AS next FROM purchases');
      const id = `cmp-${randomUUID()}`;
      await client.query(`
        INSERT INTO purchases (id, purchase_number, supplier_id, supplier_name, status, total, notes, purchased_at,
          invoice_number, payment_method, created_by, purchase_type)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        id,
        Number(numberResult.rows[0].next),
        data.fornecedorId || null,
        data.fornecedorNome,
        data.status,
        total,
        data.observacoes,
        data.dataCompra || new Date().toISOString().slice(0, 10),
        data.notaFiscal,
        data.formaPagamento,
        request.user.id,
        data.tipo,
      ]);
      await insertPurchaseItems(client, id, data.itens);
      const purchase = await fetchPurchase(client, id);
      await client.query('COMMIT');
      return reply.code(201).send({ data: purchase });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/purchases/:id/status', { preHandler: requirePermission('purchases.manage') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const parsed = statusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const current = await fetchPurchase(client, id);
      if (!current) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'purchase_not_found' });
      }
      if (current.status === 'Recebido' && parsed.data.status !== 'Recebido') {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'received_purchase_locked' });
      }
      if (parsed.data.status === 'Recebido') await applyReceipt(client, current, request.user.id);
      else await client.query('UPDATE purchases SET status=$2 WHERE id=$1', [id, parsed.data.status]);
      const updated = await fetchPurchase(client, id);
      await client.query('COMMIT');
      return { data: updated };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
