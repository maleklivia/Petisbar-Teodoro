import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionOrder, convertQuantity, isCompletedStatus } from '../src/domain/orders.js';

test('converte unidades de massa e volume', () => {
  assert.equal(convertQuantity(100, 'g', 'kg'), 0.1);
  assert.equal(convertQuantity(2, 'kg', 'g'), 2000);
  assert.equal(convertQuantity(250, 'ml', 'L'), 0.25);
  assert.equal(convertQuantity(3, 'un', 'un'), 3);
});

test('rejeita unidades incompatíveis', () => {
  assert.throws(() => convertQuantity(1, 'un', 'kg'), error => error.code === 'incompatible_units');
});

test('aplica o fluxo administrativo de status', () => {
  assert.equal(canTransitionOrder('Novo', 'Pago'), true);
  assert.equal(canTransitionOrder('Pago', 'Entregue'), false);
  assert.equal(canTransitionOrder('Pago', 'Em Produção'), true);
  assert.equal(canTransitionOrder('Entregue', 'Cancelado'), true);
  assert.equal(canTransitionOrder('Cancelado', 'Novo'), false);
  assert.equal(canTransitionOrder('Novo', 'Concluído', { external: true }), true);
  assert.equal(canTransitionOrder('Pronto', 'Confirmado', { external: true }), false);
  assert.equal(isCompletedStatus('Entregue'), true);
  assert.equal(isCompletedStatus('Concluído'), true);
});
