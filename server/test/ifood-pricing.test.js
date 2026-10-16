import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIfoodPrice, suggestedIfoodPrice } from '../src/domain/ifood-pricing.js';

test('sugere preço de iFood com a taxa configurada e arredonda para cima', () => {
  assert.equal(suggestedIfoodPrice(19.90, 26.2), 26.97);
  assert.equal(suggestedIfoodPrice(25, 26.2), 33.88);
});

test('recalcula preço automático mesmo quando uma aba antiga envia o valor anterior', () => {
  assert.equal(resolveIfoodPrice({
    newSalePrice: 25,
    submittedIfoodPrice: 26.97,
    currentSalePrice: 19.90,
    currentIfoodPrice: 26.97,
  }, 26.2), 33.88);
});

test('preserva preço de iFood que já foi definido manualmente', () => {
  assert.equal(resolveIfoodPrice({
    newSalePrice: 25,
    currentSalePrice: 19.90,
    currentIfoodPrice: 30,
  }, 26.2), 30);
  assert.equal(resolveIfoodPrice({
    newSalePrice: 25,
    submittedIfoodPrice: 35.5,
    currentSalePrice: 19.90,
    currentIfoodPrice: 30,
  }, 26.2), 35.5);
});

test('calcula preço de iFood ao cadastrar produto novo', () => {
  assert.equal(resolveIfoodPrice({ newSalePrice: 25 }, 26.2), 33.88);
});
