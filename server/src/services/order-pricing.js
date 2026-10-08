const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function pricesMatch(requested, priced) {
  const optionsKey=value=>JSON.stringify(Object.fromEntries(Object.entries(value||{}).filter(([,option])=>option!==false)));
  return requested.every((item,index) => Number.isFinite(item.expectedUnitPrice) && priced.items.some((line,lineIndex) =>
    (item.productId ? line.productId===item.productId && optionsKey(line.options)===optionsKey(item.options) : lineIndex===index) &&
    roundMoney(item.expectedUnitPrice)===(line.listUnitPrice??line.unitPrice)));
}

export function stockAllowsOrder(items, allowWithoutStock = false) {
  if (allowWithoutStock) return true;
  const required = new Map();
  for (const item of items) {
    if (item.currentStock === null) continue;
    const entry=required.get(item.productId)||{currentStock:Number(item.currentStock),quantity:0};
    entry.quantity+=Number(item.quantity);required.set(item.productId,entry);
  }
  return [...required.values()].every(item=>item.currentStock>=item.quantity);
}

export async function priceOrderItems(client, requested, { lock = false } = {}) {
  const ids = [...new Set(requested.map(item => item.productId))];
  const result = await client.query(`
    SELECT id,name,category,sale_price,current_stock
    FROM products
    WHERE id=ANY($1::text[]) AND active=true
    ORDER BY id
    ${lock ? 'FOR UPDATE' : ''}
  `, [ids]);
  if (result.rows.length !== ids.length) return null;

  const products = new Map(result.rows.map(product => [product.id, product]));
  const drinkIds = { 'coca-cola': 'p-ref005', guarana: 'p-ref002', agua: 'p-agu001' };
  const sodaIds = { 'coca-cola': 'p-ref005', guarana: 'p-ref002', sprite: 'p-ref003' };
  const priceIds = [...new Set(requested.flatMap(item => [
    ...(item.productId === 'p-drk001' && item.options?.flavor === 'morango' ? ['p-drk002'] : []),
    ...(item.productId === 'p-drk001' && item.options?.flavor === 'maracuja' ? ['p-drk003'] : []),
    ...(item.productId === 'p-pet001' && item.options?.size === 'G' ? ['p-pet006'] : []),
    ...(item.productId === 'p-pet002' && item.options?.size === 'G' ? ['p-pet007'] : []),
    ...(['p-drk010', 'p-drk011'].includes(item.productId) && item.options?.size === '700ml' ? ['p-drk011'] : []),
    ...(item.productId === 'p-pet002' && drinkIds[item.options?.drink] ? [drinkIds[item.options.drink]] : []),
    ...(item.productId === 'p-ref001' && sodaIds[item.options?.sodaFlavor] ? [sodaIds[item.options.sodaFlavor]] : []),
  ]))];
  const priceResult = priceIds.length
    ? await client.query(`SELECT id,sale_price FROM products WHERE id=ANY($1::text[]) ORDER BY id ${lock ? 'FOR SHARE' : ''}`, [priceIds])
    : { rows: [] };
  if (priceResult.rows.length !== priceIds.length) return null;
  const optionPrices = new Map(priceResult.rows.map(row => [row.id, Number(row.sale_price)]));
  const items = requested.map(item => {
    const product = products.get(item.productId);
    let unitPrice = Number(product.sale_price);
    if (product.id === 'p-drk001' && item.options?.flavor === 'morango') unitPrice = optionPrices.get('p-drk002');
    if (product.id === 'p-drk001' && item.options?.flavor === 'maracuja') unitPrice = optionPrices.get('p-drk003');
    if (product.id === 'p-pet001' && item.options?.size === 'G') unitPrice = optionPrices.get('p-pet006');
    if (product.id === 'p-pet002' && item.options?.size === 'G') unitPrice = optionPrices.get('p-pet007');
    if (['p-drk010', 'p-drk011'].includes(product.id) && item.options?.size === '700ml') unitPrice = optionPrices.get('p-drk011');
    if (product.id === 'p-pet002' && drinkIds[item.options?.drink]) unitPrice += optionPrices.get(drinkIds[item.options.drink]);
    if (product.id === 'p-ref001' && sodaIds[item.options?.sodaFlavor]) unitPrice = optionPrices.get(sodaIds[item.options.sodaFlavor]);
    unitPrice = roundMoney(unitPrice);
    const canAddFlavoredIce = ['p-drk010', 'p-drk011'].includes(product.id);
    const options = { ...(item.options || {}) };
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
