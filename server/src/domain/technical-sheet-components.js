import { convertQuantity } from './orders.js';

export function expandTechnicalSheetComponents({ sheet, recipes, ingredients, quantity = 1 }) {
  const totals = new Map();
  const cards = recipes instanceof Map ? recipes : new Map(recipes.map(recipe => [recipe.id, recipe]));
  const stock = ingredients instanceof Map ? ingredients : new Map(ingredients.map(ingredient => [ingredient.id, ingredient]));

  function addIngredient(ingredientId, amount, unit) {
    const ingredient = stock.get(ingredientId);
    if (!ingredient || !ingredient.active) return { error: 'stock_recipe_incomplete', item: ingredient?.name };
    let converted;
    try { converted = convertQuantity(amount, unit, ingredient.unit); }
    catch { return { error: 'stock_recipe_unit_invalid', item: ingredient.name }; }
    const row = totals.get(ingredientId) || { ingredientId, name: ingredient.name, unit: ingredient.unit, quantity: 0 };
    row.quantity += converted;
    totals.set(ingredientId, row);
    return null;
  }

  function expandPreparation(preparationId, amount, unit, stack = new Set()) {
    if (stack.has(preparationId)) return { error: 'stock_recipe_incomplete', item: 'Ciclo entre preparações' };
    const preparation = cards.get(preparationId);
    if (!preparation || preparation.recipeType !== 'preparation' || preparation.status !== 'ready'
      || !(Number(preparation.outputYield) > 0) || !preparation.outputUnit || !preparation.items?.length) {
      return { error: 'stock_recipe_incomplete', item: preparation?.name || 'Preparação sem ficha completa' };
    }
    let fraction;
    try { fraction = convertQuantity(amount, unit, preparation.outputUnit) / Number(preparation.outputYield); }
    catch { return { error: 'stock_recipe_unit_invalid', item: preparation.name }; }
    const next = new Set(stack).add(preparationId);
    for (const item of preparation.items) {
      if (item.isPackaging) continue;
      if (item.pendingNote?.trim()) return { error: 'stock_recipe_incomplete', item: item.itemName };
      if (!(Number(item.quantity) > 0) || !item.unit) return { error: 'stock_recipe_incomplete', item: item.itemName };
      const nestedAmount = Number(item.quantity) * fraction;
      if (item.ingredientId && !item.preparationId) {
        const error = addIngredient(item.ingredientId, nestedAmount, item.unit);
        if (error) return error;
      } else if (item.preparationId && !item.ingredientId) {
        const error = expandPreparation(item.preparationId, nestedAmount, item.unit, next);
        if (error) return error;
      } else {
        return { error: 'stock_recipe_incomplete', item: item.itemName || preparation.name };
      }
    }
    return null;
  }

  const sheetYield = Number(sheet?.yield || 1);
  if (!(sheetYield > 0)) return { error: 'stock_recipe_incomplete' };
  for (const item of sheet.items || []) {
    if (!(Number(item.quantity) > 0) || !item.unit) return { error: 'stock_recipe_incomplete', item: item.name };
    const amount = Number(item.quantity) * Number(quantity) / sheetYield;
    if (item.ingredientId && !item.preparationId) {
      const error = addIngredient(item.ingredientId, amount, item.unit);
      if (error) return error;
    } else if (item.preparationId && !item.ingredientId) {
      const error = expandPreparation(item.preparationId, amount, item.unit);
      if (error) return error;
    } else {
      return { error: 'stock_recipe_incomplete', item: item.name };
    }
  }
  return { items: [...totals.values()] };
}
