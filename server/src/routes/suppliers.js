import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';

const supplierSchema = z.object({
  nome: z.string().min(1).max(200),
  cnpj: z.string().max(50).default(''),
  telefone: z.string().max(50).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  contato: z.string().max(200).default(''),
  categoria: z.string().max(100).default(''),
  prazoEntrega: z.number().int().nonnegative().default(0),
  condicoesPagamento: z.string().max(200).default(''),
  observacoes: z.string().max(2000).default(''),
  ativo: z.boolean().default(true),
});

function mapSupplier(row) {
  return {
    id: row.id,
    nome: row.name,
    cnpj: row.tax_id,
    telefone: row.phone,
    email: row.email,
    contato: row.contact_name,
    categoria: row.category,
    prazoEntrega: Number(row.lead_time_days || 0),
    condicoesPagamento: row.payment_terms,
    observacoes: row.notes,
    ativo: Boolean(row.active),
    dataCadastro: row.created_at,
  };
}

export default async function suppliersRoutes(app) {
  app.get('/suppliers', { preHandler: requirePermission('purchases.manage') }, async () => {
    const { rows } = await app.db.query('SELECT * FROM suppliers ORDER BY active DESC, name');
    return { data: rows.map(mapSupplier) };
  });

  app.post('/suppliers', { preHandler: requirePermission('purchases.manage') }, async (request, reply) => {
    const parsed = supplierSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const data = parsed.data;
    const { rows } = await app.db.query(`
      INSERT INTO suppliers (id, name, tax_id, phone, email, contact_name, category, lead_time_days, payment_terms, notes, active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      `for-${randomUUID()}`, data.nome, data.cnpj, data.telefone, data.email, data.contato,
      data.categoria, data.prazoEntrega, data.condicoesPagamento, data.observacoes, data.ativo,
    ]);
    return reply.code(201).send({ data: mapSupplier(rows[0]) });
  });

  app.put('/suppliers/:id', { preHandler: requirePermission('purchases.manage') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const parsed = supplierSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const data = parsed.data;
    const { rows } = await app.db.query(`
      UPDATE suppliers
      SET name=$2, tax_id=$3, phone=$4, email=$5, contact_name=$6, category=$7,
        lead_time_days=$8, payment_terms=$9, notes=$10, active=$11
      WHERE id=$1
      RETURNING *
    `, [
      id, data.nome, data.cnpj, data.telefone, data.email, data.contato,
      data.categoria, data.prazoEntrega, data.condicoesPagamento, data.observacoes, data.ativo,
    ]);
    if (!rows[0]) return reply.code(404).send({ error: 'supplier_not_found' });
    return { data: mapSupplier(rows[0]) };
  });

  app.delete('/suppliers/:id', { preHandler: requirePermission('purchases.manage') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const { rows } = await app.db.query('UPDATE suppliers SET active=false WHERE id=$1 RETURNING *', [id]);
    if (!rows[0]) return reply.code(404).send({ error: 'supplier_not_found' });
    return { data: mapSupplier(rows[0]) };
  });
}
