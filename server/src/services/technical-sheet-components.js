import { expandTechnicalSheetComponents } from '../domain/technical-sheet-components.js';

export async function expandProductTechnicalSheet(client, productId, quantity = 1) {
  const sheetResult = await client.query(`
    SELECT id,yield FROM technical_sheets WHERE product_id=$1 FOR SHARE
  `, [productId]);
  if (!sheetResult.rowCount) return null;
  const sheet = sheetResult.rows[0];
  const itemResult = await client.query(`
    SELECT tsi.ingredient_id AS "ingredientId",tsi.preparation_id AS "preparationId",
      tsi.quantity,tsi.unit,COALESCE(i.name,rc.name) AS name
    FROM technical_sheet_items tsi
    LEFT JOIN ingredients i ON i.id=tsi.ingredient_id
    LEFT JOIN recipe_cards rc ON rc.id=tsi.preparation_id
    WHERE tsi.sheet_id=$1 ORDER BY COALESCE(i.name,rc.name),tsi.ingredient_id,tsi.preparation_id
  `, [sheet.id]);
  const preparationRows = await client.query(`
    SELECT id,recipe_type AS "recipeType",name,status,output_yield AS "outputYield",output_unit AS "outputUnit"
    FROM recipe_cards WHERE recipe_type='preparation' ORDER BY id FOR SHARE
  `);
  const preparationIds = preparationRows.rows.map(row => row.id);
  const recipeItems = preparationIds.length ? await client.query(`
    SELECT recipe_id AS "recipeId",item_name AS "itemName",ingredient_id AS "ingredientId",
      preparation_id AS "preparationId",quantity,unit,is_packaging AS "isPackaging",pending_note AS "pendingNote"
    FROM recipe_card_items WHERE recipe_id=ANY($1::text[]) ORDER BY recipe_id,sort_order
  `, [preparationIds]) : { rows: [] };
  const ingredientsResult = await client.query('SELECT id,name,unit,active FROM ingredients ORDER BY id');
  const itemsByRecipe = new Map();
  for (const item of recipeItems.rows) {
    const items = itemsByRecipe.get(item.recipeId) || [];
    items.push({ ...item, quantity: item.quantity === null ? null : Number(item.quantity) });
    itemsByRecipe.set(item.recipeId, items);
  }
  const recipes = preparationRows.rows.map(row => ({
    ...row,
    outputYield: row.outputYield === null ? null : Number(row.outputYield),
    items: itemsByRecipe.get(row.id) || [],
  }));
  const ingredients = ingredientsResult.rows.map(row => ({ ...row, active: Boolean(row.active) }));
  return expandTechnicalSheetComponents({ sheet: { ...sheet, items: itemResult.rows }, recipes, ingredients, quantity });
}
