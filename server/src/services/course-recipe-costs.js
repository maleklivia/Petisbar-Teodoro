import { calculateRecipeCardCosts } from '../domain/course-potato-recipes.js';

export async function loadCourseRecipeCosts(db) {
  const [cardsResult,itemsResult]=await Promise.all([
    db.query(`SELECT id,code,recipe_type AS "recipeType",name,status,output_yield AS "outputYield",output_unit AS "outputUnit" FROM recipe_cards ORDER BY id`),
    db.query(`SELECT ri.recipe_id AS "recipeId",ri.item_name AS "itemName",ri.ingredient_id AS "ingredientId",
      ri.preparation_id AS "preparationId",ri.quantity,ri.unit,ri.is_packaging AS "isPackaging",ri.pending_note AS "pendingNote",
      i.unit AS "ingredientUnit",i.unit_cost AS "ingredientUnitCost",i.active AS "ingredientActive",i.name AS "ingredientName"
      FROM recipe_card_items ri LEFT JOIN ingredients i ON i.id=ri.ingredient_id ORDER BY ri.recipe_id,ri.sort_order`),
  ]);
  const ingredientsById=new Map();
  const cards=cardsResult.rows.map(row=>({
    ...row,
    outputYield:row.outputYield===null?null:Number(row.outputYield),
    items:[],
    ingredientsById,
  }));
  const byId=new Map(cards.map(card=>[card.id,card]));
  for(const row of itemsResult.rows){
    const card=byId.get(row.recipeId);if(!card)continue;
    if(row.ingredientId)ingredientsById.set(row.ingredientId,{id:row.ingredientId,name:row.ingredientName,unit:row.ingredientUnit,unitCost:row.ingredientUnitCost===null?null:Number(row.ingredientUnitCost),active:Boolean(row.ingredientActive)});
    card.items.push({...row,quantity:row.quantity===null?null:Number(row.quantity)});
  }
  return new Map(calculateRecipeCardCosts(cards).map(card=>[card.id,card]));
}
