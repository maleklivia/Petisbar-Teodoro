import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1/test';
process.env.APP_ORIGIN ||= 'http://localhost:3000';
process.env.COOKIE_SECRET ||= 'test-only-cookie-secret-that-is-at-least-32-chars';
const { default: catalogRoutes, parseProductPhoto } = await import('../src/routes/catalog.js');
const jpeg = await readFile(new URL('../../assets/products/beer.jpg', import.meta.url));
const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

test('aceita somente JPEG válido de até 1 MB para foto do produto', () => {
  const parsed = parseProductPhoto(dataUrl);
  assert.deepEqual(parsed.bytes, jpeg);
  assert.equal(parseProductPhoto('data:image/svg+xml;base64,PHN2Zz4=').error, 'product_photo_invalid');
  const oversized = Buffer.alloc(1_000_001);
  oversized.set([0xff, 0xd8, 0xff]);
  oversized.set([0xff, 0xd9], oversized.length - 2);
  assert.equal(parseProductPhoto(`data:image/jpeg;base64,${oversized.toString('base64')}`).error, 'product_photo_invalid');
});

test('salva a foto junto do produto, entrega o JPEG público e remove a foto ao limpar', async () => {
  const products = new Map();
  const photos = new Map();
  const routes = new Map();
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push(sql);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id FROM products WHERE id=ANY')) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT sale_price,ifood_price FROM products WHERE id=$1')) {
        const current = products.get(params[0]);
        return { rows: current ? [{ sale_price: current.sale_price, ifood_price: current.ifood_price }] : [], rowCount: current ? 1 : 0 };
      }
      if (sql.includes('INSERT INTO products')) {
        const product = { id: params[0], sale_price: params[5], photo_url: params[11], ifood_price: params[12] };
        product.option_groups = params[14];
        products.set(product.id, product);
        return { rows: [product], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO product_photo_assets')) {
        photos.set(params[0], { image_bytes: params[1], sha256: params[2] });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM product_photo_assets')) {
        photos.delete(params[0]);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
    release() {},
  };
  const app = {
    get(path, options, handler) { routes.set(`GET ${path}`, { options, handler }); },
    post(path, options, handler) { routes.set(`POST ${path}`, { options, handler }); },
    put(path, options, handler) { routes.set(`PUT ${path}`, { options, handler }); },
    delete(path, options, handler) { routes.set(`DELETE ${path}`, { options, handler }); },
    db: {
      async connect() { return client; },
      async query(sql, params) {
        if (sql.startsWith('SELECT image_bytes,sha256')) return { rows: [photos.get(params[0])].filter(Boolean), rowCount: photos.has(params[0]) ? 1 : 0 };
        throw new Error(`Consulta do pool inesperada: ${sql}`);
      },
    },
  };
  await catalogRoutes(app);

  const save = routes.get('POST /products');
  assert.equal(typeof save.options.preHandler, 'function');
  assert.equal(save.options.bodyLimit, 2 * 1024 * 1024);
  let statusCode = 200;
  const reply = { code(code) { statusCode = code; return this; }, send(body) { return body; } };
  const product = { id: 'p-photo-test', nome: 'Produto teste', categoria: 'Petiscos', precoVenda: 10, foto: dataUrl, optionGroups: [] };
  const saved = await save.handler({ body: product }, reply);
  assert.equal(statusCode, 201);
  assert.equal(saved.data.option_groups, '[]', 'optionGroups vazio deve chegar como JSON array ao PostgreSQL');
  assert.equal(saved.data.photo_url, `/api/v1/public/products/${product.id}/photo?v=${photos.get(product.id).sha256}`);
  assert.deepEqual(photos.get(product.id).image_bytes, jpeg);
  const productInsert = calls.findIndex(sql => sql.includes('INSERT INTO products'));
  const photoInsert = calls.findIndex(sql => sql.includes('INSERT INTO product_photo_assets'));
  assert.ok(photoInsert > productInsert && calls.indexOf('COMMIT') > photoInsert);

  const publicPhoto = routes.get('GET /public/products/:id/photo');
  assert.equal(publicPhoto.options.preHandler, undefined);
  const response = {
    headers: {},
    header(name, value) { this.headers[name] = value; return this; },
    type(value) { this.contentType = value; return this; },
    code(value) { this.statusCode = value; return this; },
    send(value) { return value; },
  };
  const image = await publicPhoto.handler({ params: { id: product.id }, headers: {} }, response);
  assert.deepEqual(image, jpeg);
  assert.equal(response.contentType, 'image/jpeg');
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');

  product.foto = null;
  const cleared = await save.handler({ body: product }, reply);
  assert.equal(cleared.data.photo_url, null);
  assert.equal(photos.has(product.id), false);
});
