import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  type: z.enum(['Entrada', 'Saída', 'Saida']),
  value: z.number().positive(),
});

function mapEntry(row) {
  const amount = Number(row.amount);
  return {
    id: row.id,
    date: row.entry_date,
    description: row.description,
    category: row.category,
    type: row.entry_type,
    value: amount,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    effectKey: row.effect_key || null,
    createdAt: row.created_at,
  };
}

export default async function financeRoutes(app) {
  app.get('/finance/entries', { preHandler: requirePermission('finance.read') }, async () => {
    const { rows } = await app.db.query(`
      SELECT *
      FROM financial_entries
      ORDER BY entry_date DESC, created_at DESC
      LIMIT 1000
    `);
    return { data: rows.map(mapEntry) };
  });

  app.post('/finance/entries', { preHandler: requirePermission('finance.write') }, async (request, reply) => {
    const parsed = entrySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const data = parsed.data;
    const type = data.type === 'Saida' ? 'Saída' : data.type;
    const amount = type === 'Entrada' ? data.value : -data.value;
    const { rows } = await app.db.query(`
      INSERT INTO financial_entries (id, entry_date, description, category, entry_type, amount, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [`fin-${randomUUID()}`, data.date, data.description, data.category, type, amount, request.user.id]);
    return reply.code(201).send({ data: mapEntry(rows[0]) });
  });

  app.delete('/finance/entries/:id', { preHandler: requirePermission('finance.write') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const existing = await app.db.query('SELECT effect_key FROM financial_entries WHERE id=$1', [id]);
    if (!existing.rowCount) return reply.code(404).send({ error: 'entry_not_found' });
    if (existing.rows[0].effect_key) return reply.code(409).send({ error: 'system_entry_locked' });
    await app.db.query('DELETE FROM financial_entries WHERE id=$1', [id]);
    return reply.code(204).send();
  });
}
