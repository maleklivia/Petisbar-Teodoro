import test from 'node:test';
import assert from 'node:assert/strict';
import { priceOrderItems, roundMoney } from '../src/services/order-pricing.js';

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
