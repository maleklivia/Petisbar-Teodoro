import { convertQuantity } from '../domain/orders.js';

const roundStock=value=>Math.round((Number(value)+Number.EPSILON)*1000)/1000;

function sheetProductId(item){
  if(item.productId==='p-drk001'&&item.options?.flavor==='morango')return 'p-drk002';
  if(item.productId==='p-drk001'&&item.options?.flavor==='maracuja')return 'p-drk003';
  if(item.productId==='p-pet001'&&item.options?.size==='G')return 'p-pet006';
  if(item.productId==='p-pet002'&&item.options?.size==='G')return 'p-pet007';
  if(item.productId==='p-drk010'&&item.options?.size==='700ml')return 'p-drk011';
  return item.productId;
}

export async function reserveOrderStock(client,{orderId,items,allowWithoutStock=false}){
  if(allowWithoutStock)return {reserved:false,testMode:true};
  const productTotals=new Map();
  for(const item of items){
    const current=productTotals.get(item.productId)||{name:item.name,quantity:0,currentStock:item.currentStock};
    current.quantity+=Number(item.quantity);productTotals.set(item.productId,current);
  }
  for(const [productId,item] of productTotals){
    if(item.currentStock===null)continue;
    const reserved=await client.query("SELECT COALESCE(SUM(quantity),0) AS quantity FROM order_stock_reservations WHERE product_id=$1 AND status='reserved'",[productId]);
    const available=Number(item.currentStock)-Number(reserved.rows[0].quantity);
    if(available<item.quantity)return {error:'insufficient_stock',item:item.name,required:item.quantity,available};
  }
  const ingredientTotals=new Map();
  for(const item of items){
    const productId=sheetProductId(item);
    const sheet=await client.query(`SELECT ts.id,ts.yield FROM technical_sheets ts WHERE ts.product_id=$1`,[productId]);
    if(sheet.rowCount){
      const recipe=await client.query(`SELECT tsi.ingredient_id,tsi.quantity,tsi.unit,i.name,i.unit AS stock_unit,i.active
        FROM technical_sheet_items tsi JOIN ingredients i ON i.id=tsi.ingredient_id WHERE tsi.sheet_id=$1 ORDER BY i.id`,[sheet.rows[0].id]);
      for(const ingredient of recipe.rows){
        if(!ingredient.active)return {error:'stock_recipe_incomplete',item:ingredient.name};
        let quantity;
        try{quantity=convertQuantity(Number(ingredient.quantity)*Number(item.quantity)/Number(sheet.rows[0].yield||1),ingredient.unit,ingredient.stock_unit)}
        catch{return {error:'stock_recipe_unit_invalid',item:ingredient.name};}
        const current=ingredientTotals.get(ingredient.ingredient_id)||{name:ingredient.name,unit:ingredient.stock_unit,quantity:0};
        current.quantity+=quantity;ingredientTotals.set(ingredient.ingredient_id,current);
      }
    }
    if(item.options?.flavoredIce){
      const ice=await client.query("SELECT id,name,unit,active FROM ingredients WHERE id='i-029'");
      if(!ice.rowCount||!ice.rows[0].active)return {error:'stock_recipe_incomplete',item:'Gelo saborizado'};
      const current=ingredientTotals.get('i-029')||{name:ice.rows[0].name,unit:ice.rows[0].unit,quantity:0};
      current.quantity+=Number(item.quantity);ingredientTotals.set('i-029',current);
    }
  }
  const ingredientIds=[...ingredientTotals.keys()].sort();
  if(ingredientIds.length){
    const locked=await client.query('SELECT id,name,unit,current_stock,active FROM ingredients WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[ingredientIds]);
    if(locked.rowCount!==ingredientIds.length)return {error:'stock_recipe_incomplete'};
    for(const ingredient of locked.rows){
      if(!ingredient.active)return {error:'stock_recipe_incomplete',item:ingredient.name};
      const needed=roundStock(ingredientTotals.get(ingredient.id).quantity);
      const reserved=await client.query("SELECT COALESCE(SUM(quantity),0) AS quantity FROM order_stock_reservations WHERE ingredient_id=$1 AND status='reserved'",[ingredient.id]);
      const available=Number(ingredient.current_stock)-Number(reserved.rows[0].quantity);
      if(available<needed)return {error:'insufficient_ingredient_stock',item:ingredient.name,required:needed,available,unit:ingredient.unit};
    }
  }
  for(const [productId,item] of productTotals){
    if(item.currentStock===null)continue;
    await client.query(`INSERT INTO order_stock_reservations(order_id,product_id,quantity,unit) VALUES($1,$2,$3,'un')`,[orderId,productId,item.quantity]);
  }
  for(const [ingredientId,item] of ingredientTotals){
    await client.query(`INSERT INTO order_stock_reservations(order_id,ingredient_id,quantity,unit) VALUES($1,$2,$3,$4)`,[orderId,ingredientId,roundStock(item.quantity),item.unit]);
  }
  return {reserved:true,products:productTotals.size,ingredients:ingredientTotals.size};
}

export async function setOrderReservationsStatus(client,orderId,status){
  await client.query("UPDATE order_stock_reservations SET status=$2,updated_at=now() WHERE order_id=$1 AND status='reserved'",[orderId,status]);
}
