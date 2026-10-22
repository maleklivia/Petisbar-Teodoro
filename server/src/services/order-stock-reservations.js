import { recipeRequirements,stockComponents } from './recipe-requirements.js';
const round=q=>Math.round((Number(q)+Number.EPSILON)*1000)/1000;

export async function reserveOrderStock(client,{orderId,items,allowWithoutStock=false}){
  if(allowWithoutStock)return{reserved:false,testMode:true};
  const products=new Map(),ingredients=new Map();
  for(const item of items){
    for(const component of stockComponents(item))products.set(component.productId,(products.get(component.productId)||0)+component.quantity);
    if(item.options?.flavoredIce)ingredients.set('i-029',(ingredients.get('i-029')||0)+Number(item.quantity));
  }
  const ids=[...products.keys()].sort();
  const locked=await client.query('SELECT id,name,current_stock FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[ids]);
  if(locked.rowCount!==ids.length)return{error:'product_unavailable'};
  for(const p of locked.rows){
    const quantity=products.get(p.id);
    if(p.current_stock!==null){
      const reserved=await client.query("SELECT coalesce(sum(quantity),0) quantity FROM order_stock_reservations WHERE product_id=$1 AND status='reserved'",[p.id]);
      const available=Number(p.current_stock)-Number(reserved.rows[0].quantity);
      if(available<quantity)return{error:'insufficient_stock',item:p.name,required:quantity,available};
    }
    let recipe;try{recipe=await recipeRequirements(client,p.id,quantity);}catch(error){return{error:error.code||'stock_recipe_incomplete',item:p.name};}
    for(const i of recipe||[])ingredients.set(i.ingredient_id,(ingredients.get(i.ingredient_id)||0)+i.quantity);
  }
  const ingredientIds=[...ingredients.keys()].sort();
  const ingredientRows=ingredientIds.length?await client.query('SELECT id,name,unit,current_stock,active FROM ingredients WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[ingredientIds]):{rows:[],rowCount:0};
  if(ingredientRows.rowCount!==ingredientIds.length)return{error:'stock_recipe_incomplete'};
  for(const i of ingredientRows.rows){
    if(!i.active)return{error:'stock_recipe_incomplete',item:i.name};
    const reserved=await client.query("SELECT coalesce(sum(quantity),0) quantity FROM order_stock_reservations WHERE ingredient_id=$1 AND status='reserved'",[i.id]);
    const available=Number(i.current_stock)-Number(reserved.rows[0].quantity),needed=round(ingredients.get(i.id));
    if(available<needed)return{error:'insufficient_ingredient_stock',item:i.name,required:needed,available,unit:i.unit};
  }
  for(const p of locked.rows)if(p.current_stock!==null)await client.query("INSERT INTO order_stock_reservations(order_id,product_id,quantity,unit) VALUES($1,$2,$3,'un')",[orderId,p.id,products.get(p.id)]);
  for(const i of ingredientRows.rows)await client.query('INSERT INTO order_stock_reservations(order_id,ingredient_id,quantity,unit) VALUES($1,$2,$3,$4)',[orderId,i.id,round(ingredients.get(i.id)),i.unit]);
  return{reserved:true,products:ids.length,ingredients:ingredientIds.length};
}

export async function setOrderReservationsStatus(client,orderId,status){
  await client.query("UPDATE order_stock_reservations SET status=$2,updated_at=now() WHERE order_id=$1 AND status='reserved'",[orderId,status]);
}
