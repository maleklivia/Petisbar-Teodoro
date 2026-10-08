import { requirePermission } from '../middleware/auth.js';
import { calculateRecipeCardCosts } from '../domain/course-potato-recipes.js';

export default async function recipeCardRoutes(app) {
  app.get('/recipe-cards', { preHandler: requirePermission('catalog.read') }, async () => {
    const [cardsResult, itemsResult] = await Promise.all([
      app.db.query(`
        SELECT rc.id,rc.code,rc.recipe_type,rc.name,rc.product_id,rc.status,rc.output_yield,rc.output_unit,
          rc.packaging_capacity,rc.packaging_capacity_unit,rc.preparation_method,rc.pending_notes,rc.source,
          p.name AS linked_product_name
        FROM recipe_cards rc LEFT JOIN products p ON p.id=rc.product_id
        ORDER BY CASE rc.recipe_type WHEN 'preparation' THEN 0 ELSE 1 END,rc.code
      `),
      app.db.query(`
        SELECT ri.id,ri.recipe_id,ri.sort_order,ri.item_name,ri.ingredient_id,ri.preparation_id,
          ri.quantity,ri.unit,ri.is_packaging,ri.pending_note,
          i.name AS ingredient_name,i.unit AS ingredient_unit,i.unit_cost AS ingredient_unit_cost,
          p.name AS preparation_name
        FROM recipe_card_items ri
        LEFT JOIN ingredients i ON i.id=ri.ingredient_id
        LEFT JOIN recipe_cards p ON p.id=ri.preparation_id
        ORDER BY ri.recipe_id,ri.sort_order
      `),
    ]);
    const ingredientsById=new Map();
    const cards=cardsResult.rows.map(row=>{
      const card={
        id:row.id,code:row.code,recipeType:row.recipe_type,name:row.name,productId:row.product_id,
        linkedProductName:row.linked_product_name,status:row.status,
        outputYield:row.output_yield===null?null:Number(row.output_yield),outputUnit:row.output_unit,
        packagingCapacity:row.packaging_capacity===null?null:Number(row.packaging_capacity),
        packagingCapacityUnit:row.packaging_capacity_unit,preparationMethod:row.preparation_method,
        pendingNotes:row.pending_notes,source:row.source,items:[],ingredientsById,
      };
      return card;
    });
    const byId=new Map(cards.map(card=>[card.id,card]));
    for(const row of itemsResult.rows){
      const card=byId.get(row.recipe_id);if(!card)continue;
      if(row.ingredient_id)ingredientsById.set(row.ingredient_id,{id:row.ingredient_id,name:row.ingredient_name,unit:row.ingredient_unit,unitCost:Number(row.ingredient_unit_cost||0)});
      card.items.push({
        id:row.id,itemName:row.item_name,ingredientId:row.ingredient_id,preparationId:row.preparation_id,
        preparationName:row.preparation_name,quantity:row.quantity===null?null:Number(row.quantity),unit:row.unit,
        isPackaging:row.is_packaging,pendingNote:row.pending_note,
      });
    }
    const priced=calculateRecipeCardCosts(cards);
    return {data:priced.map(({ingredientsById:_,...card})=>card)};
  });
}
