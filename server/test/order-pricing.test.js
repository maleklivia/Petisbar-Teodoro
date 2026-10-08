import test from 'node:test';
import assert from 'node:assert/strict';
import { priceOrderItems, pricesMatch, roundMoney } from '../src/services/order-pricing.js';

test('recalcula preços no servidor e preserva somente opções permitidas', async () => {
  const client = {
    async query(sql, params) {
      assert.match(sql, /FROM products/);
      assert.deepEqual(params, [['drink', 'food']]);
      return { rows: [
        { id: 'drink', name: 'Drink', category: 'Drinks', sale_price: '12.50', current_stock: null },
        { id: 'food', name: 'Petisco', category: 'Petiscos', sale_price: '20.00', current_stock: '5' },
      ] };
    },
  };
  const priced = await priceOrderItems(client, [
    { productId: 'drink', quantity: 2, options: { note: 'sem açúcar' } },
    { productId: 'food', quantity: 1, options: { flavoredIce: true } },
  ]);
  assert.equal(priced.subtotal, 45);
  assert.equal(priced.items[0].subtotal, 25);
  assert.equal(priced.items[0].options.note, 'sem açúcar');
  assert.equal(priced.items[1].options.flavoredIce, false);
});

test('retorna nulo quando algum produto não está disponível', async () => {
  const client = { query: async () => ({ rows: [] }) };
  assert.equal(await priceOrderItems(client, [{ productId: 'missing', quantity: 1 }]), null);
  assert.equal(roundMoney(10.005), 10.01);
});

test('recusa preço antigo e aceita o preço atual do banco', () => {
  const priced = { items: [{ unitPrice: 21.9 }] };
  assert.equal(pricesMatch([{ expectedUnitPrice: 21.9 }], priced), true);
  assert.equal(pricesMatch([{ expectedUnitPrice: 19.9 }], priced), false);
  assert.equal(pricesMatch([{ productId: 'legado' }], priced), false);
});

test('preço da variante e bebida acompanha o cadastro de produtos', async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [{ id: 'p-pet002', name: 'Batata', category: 'Petiscos', sale_price: '27.90', current_stock: 2 }] };
    return { rows: [
      { id: 'p-pet007', sale_price: '42.00' },
      { id: 'p-ref005', sale_price: '7.50' },
    ] };
  } };
  const priced = await priceOrderItems(client, [{ productId: 'p-pet002', quantity: 1, options: { size: 'G', drink: 'coca-cola' } }], { lock: true });
  assert.equal(priced.items[0].unitPrice, 49.5);
  assert.deepEqual(calls[1].params, [['p-pet007', 'p-ref005']]);
  assert.match(calls[1].sql, /FOR SHARE/);
  assert.equal(pricesMatch([{ expectedUnitPrice: 45.9 }], priced), false);
  assert.equal(pricesMatch([{ expectedUnitPrice: 49.5 }], priced), true);
});

test('sabor do refrigerante usa preço de variante cadastrado', async () => {
  const client = { async query(sql) {
    return sql.includes('active=true')
      ? { rows: [{ id: 'p-ref001', name: 'Refrigerante lata', category: 'Refrigerantes', sale_price: '5.00', current_stock: null }] }
      : { rows: [{ id: 'p-ref005', sale_price: '6.50' }] };
  } };
  const priced = await priceOrderItems(client, [{ productId: 'p-ref001', quantity: 2, options: { sodaFlavor: 'coca-cola' } }]);
  assert.equal(priced.items[0].unitPrice, 6.5);
  assert.equal(priced.subtotal, 13);
});

test('soma centavos de adicionais sem criar divergência de ponto flutuante', async () => {
  const client = { async query(sql) {
    return sql.includes('active=true')
      ? { rows: [{ id: 'p-pet002', name: 'Batata', category: 'Petiscos', sale_price: '19.99', current_stock: null }] }
      : { rows: [{ id: 'p-agu001', sale_price: '4.99' }] };
  } };
  const priced = await priceOrderItems(client, [{ productId: 'p-pet002', quantity: 1, options: { size: 'P', drink: 'agua' } }]);
  assert.equal(priced.items[0].unitPrice, 24.98);
  assert.equal(pricesMatch([{ expectedUnitPrice: 24.98 }], priced), true);
});
