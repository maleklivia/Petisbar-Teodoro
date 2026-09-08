import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { transitionOrderStatus } from '../src/services/order-effects.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function migrate(client) {
  const directory = resolve(root, 'database', 'migrations');
  const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();
  for (const file of files) await client.query(await readFile(resolve(directory, file), 'utf8'));
}

integrationTest('conclusão e cancelamento são atômicos e idempotentes', async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await migrate(client);
    await client.query(`
      INSERT INTO ingredients
        (id,name,category,unit,current_stock,minimum_stock,unit_cost)
      VALUES ('ingredient-test','Ingrediente teste','Teste','kg',1,0,10)
    `);
    await client.query(`
      INSERT INTO products (id,name,category,sale_price,current_stock)
      VALUES ('product-test','Produto teste','Teste',20,null)
    `);
    await client.query(`INSERT INTO technical_sheets (id,product_id,yield) VALUES ('sheet-test','product-test',1)`);
    await client.query(`
      INSERT INTO technical_sheet_items (sheet_id,ingredient_id,quantity,unit)
      VALUES ('sheet-test','ingredient-test',100,'g')
    `);
    await client.query(`
      INSERT INTO orders (id,order_number,source,client_name,status,subtotal,total)
      VALUES ('order-test',900001,'Teste','Cliente teste','Pronto',20,20)
    `);
    await client.query(`
      INSERT INTO order_items (id,order_id,product_id,name,quantity,unit_price,subtotal)
      VALUES ($1,'order-test','product-test','Produto teste',1,20,20)
    `, [randomUUID()]);

    await client.query('BEGIN');
    await transitionOrderStatus(client, { orderId: 'order-test', nextStatus: 'Entregue' });
    await client.query('COMMIT');

    let stock = await client.query("SELECT current_stock FROM ingredients WHERE id='ingredient-test'");
    assert.equal(Number(stock.rows[0].current_stock), 0.9);
    let entries = await client.query("SELECT category,amount FROM financial_entries WHERE reference_id='order-test' ORDER BY category");
    assert.deepEqual(entries.rows.map(row => [row.category, Number(row.amount)]), [['CMV', -1], ['Vendas', 20]]);

    await client.query('BEGIN');
    await transitionOrderStatus(client, { orderId: 'order-test', nextStatus: 'Entregue' });
    await client.query('COMMIT');
    entries = await client.query("SELECT count(*) FROM financial_entries WHERE reference_id='order-test'");
    assert.equal(Number(entries.rows[0].count), 2);

    await client.query('BEGIN');
    await transitionOrderStatus(client, { orderId: 'order-test', nextStatus: 'Cancelado' });
    await client.query('COMMIT');
    stock = await client.query("SELECT current_stock FROM ingredients WHERE id='ingredient-test'");
    assert.equal(Number(stock.rows[0].current_stock), 1);
    entries = await client.query("SELECT count(*) FROM financial_entries WHERE reference_id='order-test'");
    assert.equal(Number(entries.rows[0].count), 4);
    const movements = await client.query("SELECT movement_type,quantity FROM stock_movements WHERE reference='order-test' ORDER BY movement_type");
    assert.deepEqual(movements.rows.map(row => [row.movement_type, Number(row.quantity)]), [['Estorno', 0.1], ['Saída', 0.1]]);
  } finally {
    await client.end();
  }
});
