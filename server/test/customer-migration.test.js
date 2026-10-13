import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../database/migrations');
const withoutTransaction = source => source
  .replace(/^\s*BEGIN;\s*/i, '')
  .replace(/\s*COMMIT;\s*$/i, '')
  .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;?/gi, '');

test('reproduz todas as migrações, verifica integridade e repete 017 sem duplicar dados', { skip: !databaseUrl }, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    const extension = await client.query("SELECT 1 FROM pg_extension WHERE extname='pgcrypto'");
    if (!extension.rowCount) {
      try { await client.query('CREATE EXTENSION pgcrypto SCHEMA public'); }
      catch (error) { if (error.code !== '23505') throw error; }
    }
    const files = (await readdir(migrationsDir)).filter(name => name.endsWith('.sql')).sort();
    for (const file of files) {
      // The production catalog already owns this soda SKU; the empty migration
      // schema needs a fixture so the combo migration can reference that row.
      if (file === '023_combo_duas_batatas_refrigerante.sql') {
        await client.query(`INSERT INTO ${schema}.products(id,sku,name,category,description,sale_price,active)
          VALUES('p-ref001','REF001','Refrigerante lata','Refrigerantes','Refrigerante lata 350ml',5.00,true)`);
      }
      await client.query(withoutTransaction(await readFile(join(migrationsDir, file), 'utf8')));
    }

    const legacy = await client.query(`
      SELECT o.id, o.status, oi.name AS item_name, p.name AS product_name, c.name AS client_name
      FROM ${schema}.orders o
      LEFT JOIN ${schema}.order_items oi ON oi.order_id=o.id
      LEFT JOIN ${schema}.products p ON p.id=oi.product_id
      LEFT JOIN ${schema}.clients c ON c.id=o.client_id
      LIMIT 1
    `);
    assert.ok(legacy.rows.length >= 0);

    const potatoCombo = await client.query(`
      SELECT p.name,p.combo_price,
        g.code,g.required_quantity,g.max_quantity,g.allow_same_product,
        count(gp.product_id) FILTER (WHERE pr.active=true)::int AS active_products
      FROM ${schema}.promotions p
      JOIN ${schema}.promotion_groups g ON g.promotion_id=p.id AND g.active=true
      LEFT JOIN ${schema}.promotion_group_products gp ON gp.group_id=g.id
      LEFT JOIN ${schema}.products pr ON pr.id=gp.product_id
      WHERE p.code='COMBO-BATATA-RECHEADA'
      GROUP BY p.id,g.id ORDER BY g.code
    `);
    assert.equal(potatoCombo.rowCount, 2);
    const potatoGroup = potatoCombo.rows.find(row => row.code === 'batata');
    assert.equal(potatoGroup.required_quantity, 2);
    assert.equal(potatoGroup.max_quantity, 2);
    assert.equal(potatoGroup.allow_same_product, true);
    assert.equal(potatoGroup.active_products, 5);
    const sodaGroup = potatoCombo.rows.find(row => row.code === 'refrigerante');
    assert.equal(sodaGroup.required_quantity, 1);
    assert.equal(sodaGroup.max_quantity, 1);
    assert.equal(sodaGroup.active_products, 1);
    assert.equal(Number(potatoGroup.combo_price), 57.76);
    const minimumNormal = await client.query(`
      SELECT 2*MIN(sale_price) FILTER (WHERE category='BATATAS RECHEADAS')
        + MIN(sale_price) FILTER (WHERE category='Refrigerantes') AS normal_price
      FROM ${schema}.products WHERE active=true
    `);
    assert.equal(Number(minimumNormal.rows[0].normal_price), 60.8);
    assert.equal(Math.round(Number(minimumNormal.rows[0].normal_price) * 0.95 * 100) / 100, 57.76);

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema=$1 AND table_name = ANY($2::text[])
    `, [schema, ['customer_accounts', 'customer_sessions', 'customer_addresses', 'customer_data_requests', 'order_status_history', 'order_tracking_tokens', 'order_idempotency_keys']]);
    assert.equal(tables.rows.length, 7);
    const fk = await client.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
      WHERE tc.table_schema=$1 AND tc.constraint_type='FOREIGN KEY'
        AND ((tc.table_name='orders' AND kcu.column_name='customer_account_id')
          OR (tc.table_name='customer_sessions' AND kcu.column_name='customer_account_id')
          OR (tc.table_name='order_tracking_tokens' AND kcu.column_name='order_id'))
    `, [schema]);
    assert.equal(fk.rows.length, 3);

    const statusBefore = await client.query(`SELECT count(*)::int AS count FROM ${schema}.order_status_history`);
    await client.query(withoutTransaction(await readFile(join(migrationsDir, '017_customer_accounts_orders.sql'), 'utf8')));
    const statusAfter = await client.query(`SELECT count(*)::int AS count FROM ${schema}.order_status_history`);
    assert.equal(statusAfter.rows[0].count, statusBefore.rows[0].count);

    await client.query('BEGIN');
    await client.query(`CREATE TABLE ${schema}.rollback_probe (id integer)`);
    await assert.rejects(() => client.query(`CREATE TABLE ${schema}.rollback_probe (id integer)`));
    await client.query('ROLLBACK');
    const probe = await client.query('SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2', [schema, 'rollback_probe']);
    assert.equal(probe.rowCount, 0);

    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    const removed = await client.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema]);
    assert.equal(removed.rowCount, 0);
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await client.end();
  }
});
