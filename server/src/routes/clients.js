import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';

const addressSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  rua: z.string().max(300).default(''),
  numero: z.string().max(50).default(''),
  bairro: z.string().max(200).default(''),
  cidade: z.string().max(200).default(''),
  estado: z.string().max(2).default(''),
  cep: z.string().max(20).default(''),
  complemento: z.string().max(300).default(''),
});

const clientSchema = z.object({
  nome: z.string().min(1).max(200),
  telefone: z.string().max(50).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  cpf: z.string().max(50).default(''),
  observacoes: z.string().max(2000).default(''),
  ativo: z.boolean().default(true),
  enderecos: z.array(addressSchema).default([]),
});

function clientRows(rows) {
  return rows.map(row => ({
    id: row.id,
    nome: row.name,
    telefone: row.phone,
    email: row.email,
    cpf: row.tax_id,
    observacoes: row.notes,
    ativo: row.active,
    dataCadastro: row.created_at,
    dataAtualizacao: row.updated_at,
    enderecos: row.addresses || [],
  }));
}

async function fetchClient(client, id) {
  const { rows } = await client.query(`
    SELECT c.*,
      COALESCE(json_agg(json_build_object(
        'id', ca.id,
        'rua', ca.street,
        'numero', ca.number,
        'bairro', ca.district,
        'cidade', ca.city,
        'estado', ca.state,
        'cep', ca.postal_code,
        'complemento', ca.complement
      ) ORDER BY ca.id) FILTER (WHERE ca.id IS NOT NULL), '[]'::json) AS addresses
    FROM clients c
    LEFT JOIN client_addresses ca ON ca.client_id = c.id
    WHERE c.id = $1
    GROUP BY c.id
  `, [id]);
  return clientRows(rows)[0] || null;
}

async function saveAddresses(client, clientId, addresses) {
  await client.query('DELETE FROM client_addresses WHERE client_id=$1', [clientId]);
  for (const address of addresses) {
    if (!address.rua && !address.cidade) continue;
    await client.query(`
      INSERT INTO client_addresses (id, client_id, street, number, district, city, state, postal_code, complement)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      address.id || `end-${randomUUID()}`,
      clientId,
      address.rua,
      address.numero,
      address.bairro,
      address.cidade,
      address.estado.toUpperCase(),
      address.cep,
      address.complemento,
    ]);
  }
}

export default async function clientsRoutes(app) {
  app.get('/clients', { preHandler: requirePermission('clients.read') }, async () => {
    const { rows } = await app.db.query(`
      SELECT c.*,
        COALESCE(json_agg(json_build_object(
          'id', ca.id,
          'rua', ca.street,
          'numero', ca.number,
          'bairro', ca.district,
          'cidade', ca.city,
          'estado', ca.state,
          'cep', ca.postal_code,
          'complemento', ca.complement
        ) ORDER BY ca.id) FILTER (WHERE ca.id IS NOT NULL), '[]'::json) AS addresses
      FROM clients c
      LEFT JOIN client_addresses ca ON ca.client_id = c.id
      WHERE c.active = true
      GROUP BY c.id
      ORDER BY c.name
    `);
    return { data: clientRows(rows) };
  });

  app.post('/clients', { preHandler: requirePermission('clients.write') }, async (request, reply) => {
    const parsed = clientSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const data = parsed.data;
    const id = `cli-${randomUUID()}`;

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO clients (id, name, phone, email, tax_id, notes, active)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [id, data.nome, data.telefone, data.email, data.cpf, data.observacoes, data.ativo]);
      await saveAddresses(client, id, data.enderecos);
      const saved = await fetchClient(client, id);
      await client.query('COMMIT');
      return reply.code(201).send({ data: saved });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.put('/clients/:id', { preHandler: requirePermission('clients.write') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const parsed = clientSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', details: parsed.error.flatten() });
    const data = parsed.data;

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(`
        UPDATE clients
        SET name=$2, phone=$3, email=$4, tax_id=$5, notes=$6, active=$7, updated_at=now()
        WHERE id=$1
        RETURNING id
      `, [id, data.nome, data.telefone, data.email, data.cpf, data.observacoes, data.ativo]);
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'client_not_found' });
      }
      await saveAddresses(client, id, data.enderecos);
      const saved = await fetchClient(client, id);
      await client.query('COMMIT');
      return { data: saved };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.delete('/clients/:id', { preHandler: requirePermission('clients.write') }, async (request, reply) => {
    const id = z.string().min(1).max(100).parse(request.params.id);
    const { rows } = await app.db.query('UPDATE clients SET active=false, updated_at=now() WHERE id=$1 RETURNING *', [id]);
    if (!rows[0]) return reply.code(404).send({ error: 'client_not_found' });
    return { data: clientRows([{ ...rows[0], addresses: [] }])[0] };
  });
}
