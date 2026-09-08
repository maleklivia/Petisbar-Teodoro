import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';

const movementSchema = z.object({
  tipo: z.enum(['entrada', 'saída', 'saida', 'ajuste', 'perda']),
  ingredienteId: z.string().min(1).max(100),
  quantidade: z.number().positive(),
  unidade: z.string().min(1).max(20).optional(),
  motivo: z.string().max(500).default(''),
  referencia: z.string().max(200).default(''),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function mapMovement(row) {
  return {
    id: row.id,
    tipo: row.movement_type,
    ingredienteId: row.ingredient_id,
    ingredienteNome: row.ingredient_name || '',
    quantidade: Number(row.quantity),
    unidade: row.unit,
    motivo: row.reason,
    referencia: row.reference,
    data: row.movement_date,
    usuario: row.user_name || 'sistema',
    criadoEm: row.created_at,
  };
}

async function fetchMovement(client, id) {
  const { rows } = await client.query(`
    SELECT sm.*, i.name AS ingredient_name, u.name AS user_name
    FROM stock_movements sm
    LEFT JOIN ingredients i ON i.id = sm.ingredient_id
    LEFT JOIN users u ON u.id = sm.created_by
    WHERE sm.id=$1
  `, [id]);
  return rows[0] ? mapMovement(rows[0]) : null;
}

export default async function stockRoutes(app) {
  app.get('/stock/movements', { preHandler: requirePermission('stock.read') }, async () => {
    const { rows } = await app.db.query(`
      SELECT sm.*, i.name AS ingredient_name, u.name AS user_name
      FROM stock_movements sm
      LEFT JOIN ingredients i ON i.id = sm.ingredient_id
      LEFT JOIN users u ON u.id = sm.created_by
      ORDER BY sm.movement_date DESC, sm.created_at DESC
      LIMIT 500
    `);
    return { data: rows.map(mapMovement) };
  });

  app.post('/stock/movements', { preHandler: requirePermission('stock.write') }, async (request, reply) => {
    const parsed = movementSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const data = parsed.data;
    const tipo = data.tipo === 'saida' ? 'saída' : data.tipo;

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const ingredient = await client.query('SELECT * FROM ingredients WHERE id=$1 AND active=true FOR UPDATE', [data.ingredienteId]);
      if (!ingredient.rowCount) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'ingredient_not_found' });
      }

      const currentStock = Number(ingredient.rows[0].current_stock);
      const nextStock = ['saída', 'perda'].includes(tipo)
        ? Math.max(0, currentStock - data.quantidade)
        : currentStock + data.quantidade;

      await client.query('UPDATE ingredients SET current_stock=$2, updated_at=now() WHERE id=$1', [data.ingredienteId, nextStock]);
      const id = `mov-${randomUUID()}`;
      await client.query(`
        INSERT INTO stock_movements (id, ingredient_id, movement_type, quantity, unit, reason, reference, movement_date, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        id,
        data.ingredienteId,
        tipo,
        data.quantidade,
        data.unidade || ingredient.rows[0].unit,
        data.motivo || tipo,
        data.referencia || '',
        data.data,
        request.user.id,
      ]);
      const movement = await fetchMovement(client, id);
      await client.query('COMMIT');
      return reply.code(201).send({ data: movement });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
