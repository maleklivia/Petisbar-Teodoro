import { convertQuantity } from './orders.js';

export function calculateTechnicalSheetCost({ sheet, items = [], ingredients = new Map(), preparations = new Map() }) {
  const yieldAmount = Number(sheet?.yield || 1);
  if (!(yieldAmount > 0)) return { total: null, partialTotal: 0, complete: false };
  let partialTotal = 0;
  let complete = items.length > 0;
  const notes = [];
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!(quantity > 0) || !item.unit) { complete = false; notes.push(`${item.name || 'Componente'}: quantidade ou unidade pendente.`); continue; }
    if (item.ingredientId && !item.preparationId) {
      const ingredient = ingredients.get(item.ingredientId);
      if (!ingredient || !ingredient.active || !(Number(ingredient.unitCost) > 0)) {
        complete = false; notes.push(`${item.name || ingredient?.name || 'Insumo'}: custo ou vínculo pendente.`); continue;
      }
      try {
        const stockQuantity = convertQuantity(quantity / yieldAmount, item.unit, ingredient.unit);
      partialTotal += stockQuantity * Number(ingredient.unitCost);
      } catch {
        complete = false; notes.push(`${item.name || ingredient.name}: unidade incompatível.`);
      }
      continue;
    }
    if (item.preparationId && !item.ingredientId) {
      const preparation = preparations.get(item.preparationId);
      if (!preparation || preparation.recipeType !== 'preparation' || preparation.status !== 'ready'
        || !preparation.cost?.complete || !(Number(preparation.cost.unit) >= 0) || !(Number(preparation.outputYield) > 0)) {
        complete = false; notes.push(`${item.name || preparation?.name || 'Preparação'}: ficha ou custo incompleto.`); continue;
      }
      try {
        const portion = convertQuantity(quantity / yieldAmount, item.unit, preparation.outputUnit);
        partialTotal += portion * Number(preparation.cost.unit);
      } catch {
        complete = false; notes.push(`${item.name || preparation.name}: unidade incompatível.`);
      }
      continue;
    }
    complete = false;
    notes.push(`${item.name || 'Componente'}: vínculo inválido.`);
  }
  return { total: complete ? partialTotal : null, partialTotal, complete, notes: [...new Set(notes)] };
}
