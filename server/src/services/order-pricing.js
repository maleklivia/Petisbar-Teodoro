import { stockComponents } from './recipe-requirements.js';
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function pricesMatch(requested, priced) {
  const optionsKey=value=>JSON.stringify(Object.fromEntries(Object.entries(value||{}).filter(([key,option])=>option!==false&&!key.startsWith('_'))));
  return requested.every((item,index) => Number.isFinite(item.expectedUnitPrice) && priced.items.some((line,lineIndex) =>
    (item.productId ? line.productId===item.productId && optionsKey(line.options)===optionsKey(item.options) : lineIndex===index) &&
    roundMoney(item.expectedUnitPrice)===(line.listUnitPrice??line.unitPrice)));
}

export function stockAllowsOrder(items, allowWithoutStock = false) {
  if (allowWithoutStock) return true;
  const required = new Map();
  for (const item of items) {
    const effects=item.options?._stockEffects||[];
    const replacement=effects.find(effect=>effect.mode==='replace');
    const components=[
      {productId:replacement?.productId||item.productId,currentStock:replacement?replacement.currentStock:item.currentStock},
      ...effects.filter(effect=>effect.mode==='add').map(effect=>({productId:effect.productId,currentStock:effect.currentStock})),
    ];
    for(const component of components){
      if (component.currentStock === null) continue;
      const entry=required.get(component.productId)||{currentStock:Number(component.currentStock),quantity:0};
      entry.quantity+=Number(item.quantity);required.set(component.productId,entry);
    }
  }
  return [...required.values()].every(item=>item.currentStock>=item.quantity);
}

export async function priceOrderItems(client, requested, { lock = false } = {}) {
  const ids = [...new Set(requested.map(item => item.productId))];
  let result = await client.query(`
    SELECT id,name,category,sale_price,current_stock,option_groups
    FROM products
    WHERE id=ANY($1::text[]) AND active=true
    ORDER BY id
  `, [ids]);
  if (result.rows.length !== ids.length) return null;

  let products = new Map(result.rows.map(product => [product.id, product]));
  const optionErrors=[];
  const configuredPriceIds=new Set();
  for(const item of requested){
    const product=products.get(item.productId), groups=Array.isArray(product.option_groups)?product.option_groups:[];
    const selected=item.options||{};
    if(groups.length){
      const keys=new Set(groups.map(group=>group.key));
      if(Object.keys(selected).some(key=>!keys.has(key)&&key!=='flavoredIce')){optionErrors.push('product_options_invalid');continue;}
      for(const group of groups){
        const value=selected[group.key], values=Array.isArray(value)?value:value===undefined?[]:[value];
        if(group.required&&!values.length){optionErrors.push('product_options_required');continue;}
        if(group.type==='radio'&&values.length>1){optionErrors.push('product_options_invalid');continue;}
        if(new Set(values).size!==values.length){optionErrors.push('product_options_invalid');continue;}
        for(const choice of values){const option=group.options?.find(entry=>entry.value===choice);if(!option){optionErrors.push('product_options_invalid');continue;}if(option.priceProductId)configuredPriceIds.add(option.priceProductId);}
      }
    } else {
      const legacyAllowed={
        'p-aca001':['flavor','complement'],'p-ref001':['sodaFlavor'],
        'p-drk001':['flavor'],'p-drk004':['flavor'],'p-drk005':['flavor'],'p-drk006':['flavor'],
        'p-drk010':['size','beverage','iceFlavor'],'p-drk011':['size','beverage','iceFlavor'],
        'p-pet001':['size'],'p-pet002':['size','drink'],
      };
      const allowed=legacyAllowed[item.productId]||['note'];
      if(selected.note!==undefined&&(typeof selected.note!=='string'||selected.note.length>500))optionErrors.push('product_options_invalid');
      const required={
        'p-aca001':['flavor'],'p-ref001':['sodaFlavor'],
        'p-drk001':['flavor'],'p-drk002':['flavor'],'p-drk003':['flavor'],'p-drk004':['flavor'],'p-drk005':['flavor'],'p-drk006':['flavor'],
        'p-drk010':['size','beverage','iceFlavor'],'p-drk011':['size','beverage','iceFlavor'],
        'p-pet001':['size'],'p-pet002':['size'],'p-pet006':['size'],'p-pet007':['size'],
      }[item.productId]||[];
      if(Object.keys(selected).some(key=>!allowed.includes(key)&&key!=='flavoredIce'))optionErrors.push('product_options_invalid');
      if(required.some(key=>!selected[key]))optionErrors.push('product_options_required');
      if(item.productId==='p-drk010'&&selected.size&&!['500ml','700ml'].includes(selected.size))optionErrors.push('product_options_invalid');
      if(['p-pet001','p-pet002','p-pet006','p-pet007'].includes(item.productId)&&selected.size&&!['P','G'].includes(selected.size))optionErrors.push('product_options_invalid');
      if(selected.flavor&&!['natural','morango','maracuja'].includes(selected.flavor))optionErrors.push('product_options_invalid');
      if(selected.sodaFlavor&&!['coca-cola','guarana','sprite'].includes(selected.sodaFlavor))optionErrors.push('product_options_invalid');
      if(selected.beverage&&!['vodka','whisky'].includes(selected.beverage))optionErrors.push('product_options_invalid');
      if(selected.iceFlavor&&!['coco','maracuja'].includes(selected.iceFlavor))optionErrors.push('product_options_invalid');
      if(selected.drink&&!['none','coca-cola','guarana','agua'].includes(selected.drink))optionErrors.push('product_options_invalid');
      if(selected.complement&&(!Array.isArray(selected.complement)||selected.complement.some(value=>!['leite-condensado','leite-em-po','granola','pacoca'].includes(value))))optionErrors.push('product_options_invalid');
    }
  }
  if(optionErrors.length)return {error:optionErrors.includes('product_options_required')?'product_options_required':'product_options_invalid'};
  const drinkIds = { 'coca-cola': 'p-ref005', guarana: 'p-ref002', agua: 'p-agu001' };
  const sodaIds = { 'coca-cola': 'p-ref005', guarana: 'p-ref002', sprite: 'p-ref003' };
  const priceIds = [...new Set([...configuredPriceIds,...requested.flatMap(item => [
    ...(item.productId === 'p-drk001' && item.options?.flavor === 'morango' ? ['p-drk002'] : []),
    ...(item.productId === 'p-drk001' && item.options?.flavor === 'maracuja' ? ['p-drk003'] : []),
    ...(item.productId === 'p-pet001' && item.options?.size === 'G' ? ['p-pet006'] : []),
    ...(item.productId === 'p-pet002' && item.options?.size === 'G' ? ['p-pet007'] : []),
    ...(['p-drk010', 'p-drk011'].includes(item.productId) && item.options?.size === '700ml' ? ['p-drk011'] : []),
    ...(item.productId === 'p-pet002' && drinkIds[item.options?.drink] ? [drinkIds[item.options.drink]] : []),
    ...(item.productId === 'p-ref001' && sodaIds[item.options?.sodaFlavor] ? [sodaIds[item.options.sodaFlavor]] : []),
  ])])];
  if(lock){const lockIds=[...new Set([...ids,...priceIds])].sort();await client.query('SELECT id FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[lockIds]);result=await client.query(`SELECT id,name,category,sale_price,current_stock,option_groups FROM products WHERE id=ANY($1::text[]) AND active=true ORDER BY id`,[ids]);if(result.rows.length!==ids.length)return null;products=new Map(result.rows.map(product=>[product.id,product]));}
  const priceResult = priceIds.length
    ? await client.query(`SELECT id,sale_price,current_stock FROM products WHERE id=ANY($1::text[]) ORDER BY id`, [priceIds])
    : { rows: [] };
  if (priceResult.rows.length !== priceIds.length) return null;
  const optionPrices = new Map(priceResult.rows.map(row => [row.id, Number(row.sale_price)]));
  const priceProducts = new Map(priceResult.rows.map(row=>[row.id,row]));
  const items = requested.map(item => {
    const product = products.get(item.productId);
    let unitPrice = Number(product.sale_price);
    const groups=Array.isArray(product.option_groups)?product.option_groups:[];
    if(groups.length){
      for(const group of groups){
        const selected=item.options?.[group.key], values=Array.isArray(selected)?selected:selected===undefined?[]:[selected];
        for(const value of values){const option=group.options.find(entry=>entry.value===value);if(!option)continue;const linked=option.priceProductId?optionPrices.get(option.priceProductId):null;
          if(option.priceMode==='replace')unitPrice=linked;
          else if(option.priceMode==='add')unitPrice+=linked;
        }
      }
    }
    if (!groups.length && product.id === 'p-drk001' && item.options?.flavor === 'morango') unitPrice = optionPrices.get('p-drk002');
    if (!groups.length && product.id === 'p-drk001' && item.options?.flavor === 'maracuja') unitPrice = optionPrices.get('p-drk003');
    if (!groups.length && product.id === 'p-pet001' && item.options?.size === 'G') unitPrice = optionPrices.get('p-pet006');
    if (!groups.length && product.id === 'p-pet002' && item.options?.size === 'G') unitPrice = optionPrices.get('p-pet007');
    if (!groups.length && ['p-drk010', 'p-drk011'].includes(product.id) && item.options?.size === '700ml') unitPrice = optionPrices.get('p-drk011');
    if (!groups.length && product.id === 'p-pet002' && drinkIds[item.options?.drink]) unitPrice += optionPrices.get(drinkIds[item.options.drink]);
    if (!groups.length && product.id === 'p-ref001' && sodaIds[item.options?.sodaFlavor]) unitPrice = optionPrices.get(sodaIds[item.options.sodaFlavor]);
    unitPrice = roundMoney(unitPrice);
    const canAddFlavoredIce = ['p-drk010', 'p-drk011'].includes(product.id);
    const options = { ...(item.options || {}) };
    if(groups.length){const effects=[];for(const group of groups){const selected=item.options?.[group.key],values=Array.isArray(selected)?selected:selected===undefined?[]:[selected];for(const value of values){const choice=group.options.find(entry=>entry.value===value);if(choice?.priceProductId&&choice.stockMode&&choice.stockMode!=='none'){const linked=priceProducts.get(choice.priceProductId);effects.push({productId:choice.priceProductId,mode:choice.stockMode,currentStock:linked?.current_stock??null});}}}if(effects.length)options._stockEffects=effects;}
    if(!groups.length){const components=stockComponents({productId:product.id,quantity:item.quantity,options});const effects=components.flatMap((component,index)=>component.productId!==product.id||index>0?[{productId:component.productId,mode:index===0?'replace':'add',currentStock:priceProducts.get(component.productId)?.current_stock??null}]:[]);if(effects.length)options._stockEffects=effects;}
    options.flavoredIce = canAddFlavoredIce && Boolean(item.flavoredIce ?? options.flavoredIce);
    const caipirinhaFlavors = { natural: 'Limão', morango: 'Morango', maracuja: 'Maracujá' };
    const name = product.id === 'p-drk001' && caipirinhaFlavors[options.flavor]
      ? `${product.name} ${caipirinhaFlavors[options.flavor]}` : product.name;
    return {
      productId: product.id,
      name,
      category: product.category,
      currentStock: product.current_stock,
      quantity: item.quantity,
      unitPrice,
      subtotal: roundMoney(unitPrice * item.quantity),
      options,
    };
  });
  return { items, subtotal: roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0)),
    basePrices: new Map(result.rows.map(product=>[product.id,Number(product.sale_price)])) };
}

export { roundMoney };
