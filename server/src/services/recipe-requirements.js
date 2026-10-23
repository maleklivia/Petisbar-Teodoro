import {expandProductTechnicalSheet} from './technical-sheet-components.js';
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
  const expanded=await expandProductTechnicalSheet(db,productId,quantity);
  if(expanded===null)return null;
  if(expanded.error||!expanded.items.length)throw invalid(expanded.error||'stock_recipe_incomplete');
  return expanded.items.map(i=>({ingredient_id:i.ingredientId,name:i.name,unit:i.unit,quantity:i.quantity}));
}
