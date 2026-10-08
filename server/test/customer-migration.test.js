import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('migração de clientes e pedidos cria o modelo isolado e pode ser revertida', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE users (id uuid PRIMARY KEY);
      CREATE TABLE orders (id text PRIMARY KEY, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO users (id) VALUES ('00000000-0000-0000-0000-000000000001');
      INSERT INTO orders (id, status) VALUES ('ord-test', 'Novo');
    `);

    const source = await readFile(new URL('../../database/migrations/017_customer_accounts_orders.sql', import.meta.url), 'utf8');
    await client.query(source.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, ''));

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema=$1 AND table_name = ANY($2::text[])
      ORDER BY table_name
    `, [schema, ['customer_accounts', 'customer_sessions', 'customer_addresses', 'order_status_history', 'order_tracking_tokens', 'order_idempotency_keys']]);
    assert.equal(tables.rows.length, 6);
    const history = await client.query(`SELECT order_id, status, source FROM ${schema}.order_status_history`);
    assert.deepEqual(history.rows, [{ order_id: 'ord-test', status: 'Novo', source: 'migration' }]);
    const orderColumn = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name='orders' AND column_name='customer_account_id'`, [schema]);
    assert.equal(orderColumn.rowCount, 1);

    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    const removed = await client.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema]);
    assert.equal(removed.rowCount, 0);
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await client.end();
  }
});
