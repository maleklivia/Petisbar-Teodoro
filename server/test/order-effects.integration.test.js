import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { transitionOrderStatus } from '../src/services/order-effects.js';
import { reserveOrderStock } from '../src/services/order-stock-reservations.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function migrate(client) {
  const directory = resolve(root, 'database', 'migrations');
  const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();
  try { await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto'); } catch (error) { if (error.code !== '23505') throw error; }
  for (const file of files) {
    const source = (await readFile(resolve(directory, file), 'utf8')).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;?/gi, '');
    await client.query(source);
  }
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

    await client.query(`
      INSERT INTO products (id,name,category,sale_price,current_stock,active) VALUES
        ('p-drk001','Caipirinha','Drinks',15.90,null,true),
        ('p-drk002','Caipirinha Morango','Drinks',16.90,null,false),
        ('p-drk003','Caipirinha Maracujá','Drinks',17.90,null,false)
    `);
    await client.query(`
      INSERT INTO ingredients (id,name,category,unit,current_stock,minimum_stock,unit_cost) VALUES
        ('ingredient-lemon','Limão','Teste','kg',1,0,10),
        ('ingredient-strawberry','Morango','Teste','kg',1,0,20),
        ('ingredient-passionfruit','Maracujá','Teste','kg',1,0,30)
    `);
    await client.query(`
      INSERT INTO technical_sheets (id,product_id,yield) VALUES
        ('sheet-lemon','p-drk001',1),
        ('sheet-strawberry','p-drk002',1),
        ('sheet-passionfruit','p-drk003',1)
    `);
    await client.query(`
      INSERT INTO technical_sheet_items (sheet_id,ingredient_id,quantity,unit) VALUES
        ('sheet-lemon','ingredient-lemon',100,'g'),
        ('sheet-strawberry','ingredient-strawberry',100,'g'),
        ('sheet-passionfruit','ingredient-passionfruit',100,'g')
    `);
    await client.query(`
      INSERT INTO orders (id,order_number,source,client_name,status,subtotal,total)
      VALUES ('order-flavors',900002,'Teste','Cliente teste','Pronto',50.70,50.70)
    `);
    for (const [flavor, price] of [['natural',15.9],['morango',16.9],['maracuja',17.9]]) {
      await client.query(`
        INSERT INTO order_items (id,order_id,product_id,name,quantity,unit_price,subtotal,options)
        VALUES ($1,'order-flavors','p-drk001','Caipirinha',1,$2,$2,$3)
      `, [randomUUID(), price, { flavor }]);
    }
    await client.query('BEGIN');
    await transitionOrderStatus(client, { orderId: 'order-flavors', nextStatus: 'Entregue' });
    await client.query('COMMIT');
    const flavorStocks = await client.query("SELECT id,current_stock FROM ingredients WHERE id LIKE 'ingredient-%' ORDER BY id");
    assert.deepEqual(flavorStocks.rows.map(row => [row.id, Number(row.current_stock)]), [
      ['ingredient-lemon',0.9],['ingredient-passionfruit',0.9],['ingredient-strawberry',0.9],['ingredient-test',1],
    ]);

    const historical=await client.query("SELECT unit_price,subtotal,list_unit_price FROM order_items WHERE order_id='order-test'");
    assert.deepEqual(historical.rows.map(row=>[Number(row.unit_price),Number(row.subtotal),row.list_unit_price]),[[20,20,null]]);

    await client.query(`INSERT INTO ingredients(id,name,category,unit,current_stock,minimum_stock,unit_cost)
      VALUES('ingredient-reserve','Ingrediente reserva','Teste','kg',1,0,10)`);
    await client.query(`INSERT INTO products(id,name,category,sale_price,current_stock) VALUES
      ('product-reserve','Produto com ficha','Teste',20,NULL),('product-direct','Produto controlado','Teste',5,1)`);
    await client.query(`INSERT INTO technical_sheets(id,product_id,yield) VALUES('sheet-reserve','product-reserve',1)`);
    await client.query(`INSERT INTO technical_sheet_items(sheet_id,ingredient_id,quantity,unit) VALUES('sheet-reserve','ingredient-reserve',600,'g')`);
    for(const [id,number] of [['reserve-a',900003],['reserve-b',900004]])await client.query(`INSERT INTO orders(id,order_number,source,client_name,status,subtotal,total) VALUES($1,$2,'Teste','Reserva','Pronto',20,20)`,[id,number]);
    for(const id of ['reserve-a','reserve-b'])await client.query(`INSERT INTO order_items(order_id,product_id,name,quantity,unit_price,subtotal,options) VALUES($1,'product-reserve','Produto com ficha',1,20,20,'{}')`,[id]);
    const reservationItems=[{productId:'product-reserve',name:'Produto com ficha',quantity:1,currentStock:null,options:{}}];
    const first=new pg.Client({connectionString:databaseUrl});const second=new pg.Client({connectionString:databaseUrl});
    await first.connect();await second.connect();
    try{
      await first.query('BEGIN');await second.query('BEGIN');
      const accepted=await reserveOrderStock(first,{orderId:'reserve-a',items:reservationItems});
      assert.equal(accepted.reserved,true);
      const competing=reserveOrderStock(second,{orderId:'reserve-b',items:reservationItems});
      await first.query('COMMIT');
      const rejected=await competing;
      assert.equal(rejected.error,'insufficient_ingredient_stock');
      await second.query('ROLLBACK');
      await client.query('BEGIN');
      await transitionOrderStatus(client,{orderId:'reserve-a',nextStatus:'Cancelado'});
      await client.query('COMMIT');
      await client.query('BEGIN');
      const afterRelease=await reserveOrderStock(client,{orderId:'reserve-b',items:reservationItems});
      assert.equal(afterRelease.reserved,true);
      await transitionOrderStatus(client,{orderId:'reserve-b',nextStatus:'Entregue'});
      await client.query('COMMIT');
      const consumed=await client.query("SELECT status FROM order_stock_reservations WHERE order_id='reserve-b' AND ingredient_id='ingredient-reserve'");
      assert.equal(consumed.rows[0].status,'consumed');
      const rawStock=await client.query("SELECT current_stock FROM ingredients WHERE id='ingredient-reserve'");
      assert.equal(Number(rawStock.rows[0].current_stock),0.4);
    }finally{await first.end();await second.end();}

    await client.query(`INSERT INTO orders(id,order_number,source,client_name,status,subtotal,total) VALUES('reserve-product',900005,'Teste','Reserva','Novo',5,5)`);
    const productClient=new pg.Client({connectionString:databaseUrl});await productClient.connect();
    try{
      await productClient.query('BEGIN');
      const productReserved=await reserveOrderStock(productClient,{orderId:'reserve-product',items:[{productId:'product-direct',name:'Produto controlado',quantity:1,currentStock:1,options:{}}]});
      assert.equal(productReserved.reserved,true);await productClient.query('COMMIT');
      const other=await client.query(`INSERT INTO orders(id,order_number,source,client_name,status,subtotal,total) VALUES('reserve-product-2',900006,'Teste','Reserva','Novo',5,5)`);
      assert.equal(other.rowCount,1);
      await productClient.query('BEGIN');
      const soldOut=await reserveOrderStock(productClient,{orderId:'reserve-product-2',items:[{productId:'product-direct',name:'Produto controlado',quantity:1,currentStock:1,options:{}}]});
      assert.equal(soldOut.error,'insufficient_stock');await productClient.query('ROLLBACK');
    }finally{await productClient.end();}

    await client.query(`INSERT INTO orders(id,order_number,source,client_name,status,subtotal,total) VALUES('cardapio-teste',900007,'Cardápio Digital (Teste)','Teste','Pronto',5,5)`);
    await client.query(`INSERT INTO order_items(order_id,product_id,name,quantity,unit_price,subtotal,options) VALUES('cardapio-teste','product-direct','Produto controlado',1,5,5,'{}')`);
    await client.query('BEGIN');
    await transitionOrderStatus(client,{orderId:'cardapio-teste',nextStatus:'Entregue'});
    await client.query('COMMIT');
    const testStock=await client.query("SELECT current_stock FROM products WHERE id='product-direct'");
    assert.equal(Number(testStock.rows[0].current_stock),1);
    const testEffects=await client.query("SELECT count(*) FROM stock_movements WHERE reference='cardapio-teste'");
    assert.equal(Number(testEffects.rows[0].count),0);
    const testFinance=await client.query("SELECT count(*) FROM financial_entries WHERE reference_id='cardapio-teste'");
    assert.equal(Number(testFinance.rows[0].count),0);
  } finally {
    await client.end();
  }
});
