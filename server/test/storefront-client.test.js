import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

function loadClient() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', innerHTML: '',
      classList: { add() {}, remove() {}, toggle() {} },
      querySelector: () => ({ textContent: '' }),
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { addEventListener() {}, getElementById: element },
    URLSearchParams, Intl, Map, Set, Number, JSON,
  });
  vm.runInContext(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'cardapio.js'), 'utf8'), context);
  const client = vm.runInContext('Cardapio', context);
  client.renderStorefront = () => {};
  client.renderCategories = () => {};
  client.renderCart = () => {};
  client.openCart = () => {};
  client.toast = () => {};
  client.escape = value => String(value);
  return { client, element };
}

test('falha de API retira catálogo antigo e bloqueia pedidos', async () => {
  const { client, element } = loadClient();
  client.apiActive = true;
  client.products = [{ id: 'old', name: 'Preço antigo' }];
  client.fetchPublic = async () => { throw new Error('offline'); };
  await client.refresh();
  assert.equal(client.apiActive, false);
  assert.equal(client.products.length, 0);
  assert.match(element('catalog').innerHTML, /temporariamente indisponível/);
  assert.match(element('service-notice').textContent, /Não é possível fazer pedidos/);
});

test('usa cadastro recebido do ERP sem substituir nome, foto ou disponibilidade', async () => {
  const { client, element } = loadClient();
  client.fetchPublic = async path => path.endsWith('storefront')
    ? { isOpen: true, minimumOrder: 20 }
    : [{ id: 'p-br003', name: 'Nome do ERP', category: 'BATATAS RECHEADAS', description: 'Descrição do ERP', sale_price: 29.9, photo_url: '../assets/products/batatas-recheadas-referencia.jpg', current_stock: 0 }];
  await client.refresh();
  assert.equal(client.apiActive, true);
  assert.match(element('catalog').innerHTML, /Nome do ERP/);
  assert.match(element('catalog').innerHTML, /assets\/products\/batatas-recheadas-referencia.jpg/);
  assert.match(element('catalog').innerHTML, /Indisponível/);
  assert.match(element('catalog').innerHTML, /disabled.*aria-label="Adicionar"/);
});

test('preço de opção usa valor retornado pelo ERP', async () => {
  const { client } = loadClient();
  const batata = { id: 'p-pet002', sale_price: '27.90', option_prices: { G: 42, drinks: { 'coca-cola': 7.5 } } };
  assert.equal(client.productUnitPrice(batata, { size: 'G', drink: 'coca-cola' }), 49.5);
  assert.equal(client.productUnitPrice(batata, { size: 'P' }), 27.9);
  assert.ok(Number.isNaN(client.productUnitPrice(batata, { size: 'G', drink: 'agua' })));
  const soda = { id: 'p-ref001', sale_price: '5.00', option_prices: { soda: { 'coca-cola': 6.5, guarana: 5 } } };
  assert.equal(client.productUnitPrice(soda, { sodaFlavor: 'coca-cola' }), 6.5);
  assert.equal(client.productUnitPrice({ id: 'p-pet002', sale_price: 19.99, option_prices: { drinks: { agua: 4.99 } } }, { size: 'P', drink: 'agua' }), 24.98);
});
