import { convertQuantity } from '../domain/orders.js';
const invalid=(message='stock_recipe_incomplete')=>Object.assign(new Error(message),{code:message,statusCode:409});

export function stockComponents(item){
  const effects=item.options?._stockEffects||[],replacement=effects.find(e=>e.mode==='replace');
  let id=replacement?.productId||item.productId;
  if(!replacement){
    if(id==='p-drk001'&&item.options?.flavor==='morango')id='p-drk002';
    if(id==='p-drk001'&&item.options?.flavor==='maracuja')id='p-drk003';
    if(id==='p-pet001'&&item.options?.size==='G')id='p-pet006';
    if(id==='p-pet002'&&item.options?.size==='G')id='p-pet007';
    if(id==='p-drk010'&&item.options?.size==='700ml')id='p-drk011';
    if(id==='p-ref001'&&item.options?.sodaFlavor)id=({'coca-cola':'p-ref005',guarana:'p-ref002',sprite:'p-ref003'})[item.options.sodaFlavor]||id;
  }
  const result=[{productId:id,quantity:Number(item.quantity)}];
  for(const effect of effects.filter(e=>e.mode==='add'))result.push({productId:effect.productId,quantity:Number(item.quantity)});
  if(item.productId==='p-pet002'&&item.options?.drink&&item.options.drink!=='none'){
    const drink=({'coca-cola':'p-ref005',guarana:'p-ref002',agua:'p-agu001'})[item.options.drink];
    if(drink&&!effects.some(e=>e.mode==='add'&&e.productId===drink))result.push({productId:drink,quantity:Number(item.quantity)});
  }
  return result;
}

export async function recipeRequirements(db,productId,quantity=1){
  const sheets=await db.query('SELECT id,yield FROM technical_sheets WHERE product_id=$1',[productId]);
  if(!sheets.rowCount)return null;
  const result=[];
  const expand=async(items,factor,path)=>{
    for(const item of items){
      if(!(Number(item.quantity)>0))throw invalid();
      if(item.ingredient_id){
        const ingredient=await db.query('SELECT id,name,unit,active FROM ingredients WHERE id=$1',[item.ingredient_id]);
        if(!ingredient.rowCount||!ingredient.rows[0].active)throw invalid();
        const i=ingredient.rows[0];
        result.push({ingredient_id:i.id,name:i.name,unit:i.unit,quantity:convertQuantity(Number(item.quantity)*factor,item.unit,i.unit)});
      }else if(item.preparation_id){
        if(path.includes(item.preparation_id)||path.length>20)throw invalid('recipe_cycle');
        const preparation=await db.query("SELECT id,status,output_yield,output_unit FROM recipe_cards WHERE id=$1 AND recipe_type='preparation'",[item.preparation_id]);
        const p=preparation.rows[0];if(!p||p.status!=='ready'||!(Number(p.output_yield)>0))throw invalid();
        const children=await db.query('SELECT ingredient_id,preparation_id,quantity,unit FROM recipe_card_items WHERE recipe_id=$1 ORDER BY sort_order',[p.id]);
        if(!children.rowCount)throw invalid();
        await expand(children.rows,convertQuantity(Number(item.quantity)*factor,item.unit,p.output_unit)/Number(p.output_yield),[...path,p.id]);
      }else throw invalid();
    }
  };
  const items=await db.query('SELECT ingredient_id,preparation_id,quantity,unit FROM technical_sheet_items WHERE sheet_id=$1',[sheets.rows[0].id]);
  if(!items.rowCount)throw invalid();
  await expand(items.rows,Number(quantity)/Number(sheets.rows[0].yield||1),[]);
  return result;
}
