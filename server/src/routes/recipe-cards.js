import { requirePermission } from '../middleware/auth.js';
import { calculateRecipeCardCosts } from '../domain/course-potato-recipes.js';
import { z } from 'zod';

const itemSchema=z.object({
  id:z.string().min(1).max(160).optional(),
  itemName:z.string().trim().min(1).max(200),
  ingredientId:z.string().min(1).max(100).nullable().optional(),
  preparationId:z.string().min(1).max(100).nullable().optional(),
  quantity:z.number().positive().nullable(),
  unit:z.string().trim().max(20).nullable().optional(),
  isPackaging:z.boolean().default(false),
  pendingNote:z.string().max(1000).default(''),
}).refine(item=>!(item.ingredientId&&item.preparationId),{message:'item_cannot_link_ingredient_and_preparation'}).refine(item=>item.quantity!==null||item.pendingNote.trim().length>0,{message:'pending_quantity_requires_note'});
const cardSchema=z.object({
  name:z.string().trim().min(1).max(200),
  productId:z.string().min(1).max(100).nullable().optional(),
  status:z.enum(['incomplete','draft','ready']),
  outputYield:z.number().positive().nullable(),
  outputUnit:z.string().trim().max(20).nullable().optional(),
  packagingCapacity:z.number().positive().nullable(),
  packagingCapacityUnit:z.string().trim().max(20).nullable().optional(),
  preparationMethod:z.string().max(10000),
  pendingNotes:z.string().max(5000),
  items:z.array(itemSchema).max(100),
});

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

  app.put('/recipe-cards/:id', { preHandler: requirePermission('catalog.write') }, async (request,reply) => {
    const id=z.string().min(1).max(100).parse(request.params.id);
    const parsed=cardSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'validation_error',details:parsed.error.flatten()});
    const card=parsed.data;
    const itemIds=card.items.map(item=>item.id).filter(Boolean);
    if(new Set(itemIds).size!==itemIds.length)return reply.code(400).send({error:'duplicate_item'});
    const client=await app.db.connect();
    try{
      await client.query('BEGIN');
      const lockIds=[...new Set([id,...card.items.map(item=>item.preparationId).filter(Boolean)])].sort();
      const locked=await client.query('SELECT id FROM recipe_cards WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[lockIds]);
      if(!locked.rows.some(row=>row.id===id)){await client.query('ROLLBACK');return reply.code(404).send({error:'recipe_card_not_found'});}
      if(card.productId){
        const product=await client.query('SELECT id FROM products WHERE id=$1',[card.productId]);
        if(!product.rowCount){await client.query('ROLLBACK');return reply.code(400).send({error:'product_not_found'});}
      }
      const ingredientIds=[...new Set(card.items.map(item=>item.ingredientId).filter(Boolean))];
      if(ingredientIds.length){
        const ingredients=await client.query('SELECT id FROM ingredients WHERE id=ANY($1::text[])', [ingredientIds]);
        if(ingredients.rowCount!==ingredientIds.length){await client.query('ROLLBACK');return reply.code(400).send({error:'ingredient_not_found'});}
      }
      const preparationIds=[...new Set(card.items.map(item=>item.preparationId).filter(Boolean))];
      if(preparationIds.length){
        const preparations=await client.query("SELECT id FROM recipe_cards WHERE id=ANY($1::text[]) AND recipe_type='preparation'", [preparationIds]);
        if(preparations.rowCount!==preparationIds.length){await client.query('ROLLBACK');return reply.code(400).send({error:'preparation_not_found'});}
        if(preparationIds.includes(id)){await client.query('ROLLBACK');return reply.code(400).send({error:'recipe_cycle'});}
        const cycle=await client.query(`
          WITH RECURSIVE dependency_path(id) AS (
            SELECT unnest($1::text[])
            UNION
            SELECT item.preparation_id FROM dependency_path path
            JOIN recipe_card_items item ON item.recipe_id=path.id
            WHERE item.preparation_id IS NOT NULL
          ) SELECT 1 FROM dependency_path WHERE id=$2 LIMIT 1
        `,[preparationIds,id]);
        if(cycle.rowCount){await client.query('ROLLBACK');return reply.code(400).send({error:'recipe_cycle'});}
      }
      const itemRows=await client.query('SELECT id FROM recipe_card_items WHERE recipe_id=$1',[id]);
      const existingIds=new Set(itemRows.rows.map(row=>row.id));
      if(itemIds.some(itemId=>!existingIds.has(itemId))){await client.query('ROLLBACK');return reply.code(400).send({error:'recipe_item_mismatch'});}
      const updated=await client.query(`
        UPDATE recipe_cards SET name=$2,product_id=$3,status=$4,output_yield=$5,output_unit=$6,
          packaging_capacity=$7,packaging_capacity_unit=$8,preparation_method=$9,pending_notes=$10,updated_at=now()
        WHERE id=$1 RETURNING id
      `,[id,card.name,card.productId||null,card.status,card.outputYield,card.outputUnit||null,
        card.packagingCapacity,card.packagingCapacityUnit||null,card.preparationMethod,card.pendingNotes]);
      await client.query('DELETE FROM recipe_card_items WHERE recipe_id=$1',[id]);
      for(let index=0;index<card.items.length;index++){
        const item=card.items[index];
        const itemId=item.id||`${id}-item-edit-${Date.now()}-${index}`;
        await client.query(`
          INSERT INTO recipe_card_items(id,recipe_id,sort_order,item_name,ingredient_id,preparation_id,quantity,unit,is_packaging,pending_note)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,[itemId,id,index+1,item.itemName,item.ingredientId||null,item.preparationId||null,item.quantity,item.unit||null,item.isPackaging,item.pendingNote]);
      }
      await client.query('COMMIT');
      return {data:{id:updated.rows[0].id,updated:true}};
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  });
}
