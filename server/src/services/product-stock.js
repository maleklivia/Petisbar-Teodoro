import { expandProductTechnicalSheet } from './technical-sheet-components.js';

/**
 * Returns the quantity that can actually be sold for one product.
 * A product with a technical sheet is limited by its scarcest ingredient;
 * an incomplete sheet is deliberately treated as unavailable (zero).
 */
export async function sellableProductStock(client, product) {
  if (product.current_stock !== null && product.current_stock !== undefined) {
    return Math.max(0, Math.floor(Number(product.current_stock)));
  }
  const expanded = await expandProductTechnicalSheet(client, product.id, 1);
  if (!expanded || expanded.error || !expanded.items?.length) return 0;
  const ids = expanded.items.map(item => item.ingredientId);
  const { rows } = await client.query(
    'SELECT id,current_stock,active FROM ingredients WHERE id=ANY($1::text[])',
    [ids],
  );
  const ingredients = new Map(rows.map(row => [row.id, row]));
  let available = Number.POSITIVE_INFINITY;
  for (const item of expanded.items) {
    const ingredient = ingredients.get(item.ingredientId);
    if (!ingredient?.active || !(Number(item.quantity) > 0)) return 0;
    available = Math.min(available, Math.floor(Number(ingredient.current_stock) / Number(item.quantity)));
  }
  return Number.isFinite(available) ? Math.max(0, available) : 0;
}

export async function withSellableProductStock(client, products) {
  return Promise.all(products.map(async product => ({
    ...product,
    current_stock: await sellableProductStock(client, product),
  })));
}
