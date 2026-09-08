const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export async function priceOrderItems(client, requested, { lock = false } = {}) {
  const ids = [...new Set(requested.map(item => item.productId))];
  const result = await client.query(`
    SELECT id,name,category,sale_price,current_stock
    FROM products
    WHERE id=ANY($1::text[]) AND active=true
    ${lock ? 'FOR UPDATE' : ''}
  `, [ids]);
  if (result.rows.length !== ids.length) return null;

  const products = new Map(result.rows.map(product => [product.id, product]));
  const items = requested.map(item => {
    const product = products.get(item.productId);
    const unitPrice = Number(product.sale_price);
    const canAddFlavoredIce = ['p-drk010', 'p-drk011'].includes(product.id);
    const options = { ...(item.options || {}) };
    options.flavoredIce = canAddFlavoredIce && Boolean(item.flavoredIce ?? options.flavoredIce);
    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      currentStock: product.current_stock,
      quantity: item.quantity,
      unitPrice,
      subtotal: roundMoney(unitPrice * item.quantity),
      options,
    };
  });
  return { items, subtotal: roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0)) };
}

export { roundMoney };
