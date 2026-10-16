import assert from 'node:assert/strict';
import test from 'node:test';
import { expandTechnicalSheetComponents } from '../src/domain/technical-sheet-components.js';

const ingredients = [
  { id: 'potato', name: 'Batata', unit: 'kg', active: true },
  { id: 'butter', name: 'Manteiga', unit: 'kg', active: true },
  { id: 'chicken', name: 'Frango', unit: 'kg', active: true },
];
const recipes = [
  { id: 'potato-base', recipeType: 'preparation', name: 'Batata amassada', status: 'ready', outputYield: 800, outputUnit: 'g', items: [
    { itemName: 'Batata', ingredientId: 'potato', quantity: 1000, unit: 'g' },
    { itemName: 'Manteiga', ingredientId: 'butter', quantity: 100, unit: 'g' },
  ] },
  { id: 'chicken-base', recipeType: 'preparation', name: 'Frango cremoso', status: 'ready', outputYield: 1000, outputUnit: 'g', items: [
    { itemName: 'Frango', ingredientId: 'chicken', quantity: 1000, unit: 'g' },
  ] },
];

test('expande preparações em ingredientes crus uma única vez e converte g para kg', () => {
  const result = expandTechnicalSheetComponents({
    sheet: { yield: 1, items: [
      { preparationId: 'potato-base', quantity: 200, unit: 'g' },
      { preparationId: 'chicken-base', quantity: 150, unit: 'g' },
      { ingredientId: 'butter', quantity: 10, unit: 'g' },
    ] },
    recipes, ingredients,
  });
  assert.deepEqual(result.items.map(row => [row.ingredientId, row.quantity]).sort(([a],[b])=>a.localeCompare(b)), [
    ['butter', 0.035], ['chicken', 0.15], ['potato', 0.25],
  ]);
});

test('recusa preparação incompleta para impedir baixa parcial de estoque', () => {
  const result = expandTechnicalSheetComponents({
    sheet: { yield: 1, items: [{ preparationId: 'potato-base', quantity: 200, unit: 'g' }] },
    recipes: recipes.map(recipe => recipe.id === 'potato-base' ? { ...recipe, status: 'draft' } : recipe), ingredients,
  });
  assert.equal(result.error, 'stock_recipe_incomplete');
  assert.equal(result.items, undefined);
});

test('recusa baixa quando uma linha da preparação ainda tem pendência registrada', () => {
  const result = expandTechnicalSheetComponents({
    sheet: { yield: 1, items: [{ preparationId: 'potato-base', quantity: 200, unit: 'g' }] },
    recipes: recipes.map(recipe => recipe.id === 'potato-base' ? { ...recipe, items: [
      { itemName: 'Batata', ingredientId: 'potato', quantity: 1000, unit: 'g', pendingNote: 'Pesar o rendimento pronto.' },
    ] } : recipe), ingredients,
  });
  assert.equal(result.error, 'stock_recipe_incomplete');
});

test('falha de unidade não converte ml em g', () => {
  const result = expandTechnicalSheetComponents({
    sheet: { yield: 1, items: [{ preparationId: 'potato-base', quantity: 50, unit: 'ml' }] },
    recipes, ingredients,
  });
  assert.equal(result.error, 'stock_recipe_unit_invalid');
});

test('detecta ciclo de referências entre preparações', () => {
  const cyclic = [...recipes, { id: 'cycle', recipeType: 'preparation', name: 'Ciclo', status: 'ready', outputYield: 1, outputUnit: 'g', items: [
    { itemName: 'Batata amassada', preparationId: 'cycle', quantity: 1, unit: 'g' },
  ] }];
  const result = expandTechnicalSheetComponents({
    sheet: { yield: 1, items: [{ preparationId: 'cycle', quantity: 1, unit: 'g' }] },
    recipes: cyclic, ingredients,
  });
  assert.equal(result.error, 'stock_recipe_incomplete');
  assert.equal(result.item, 'Ciclo entre preparações');
});
