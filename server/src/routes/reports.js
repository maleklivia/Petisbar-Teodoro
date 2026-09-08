import { requirePermission } from '../middleware/auth.js';
import { convertQuantity } from '../domain/orders.js';

const completedStatuses = ['Entregue', 'Concluído'];
const dateOnly = value => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value || '').slice(0, 10);

function entry(row) {
  return {
    id: row.id,
    date: dateOnly(row.entry_date),
    description: row.description,
    category: row.category,
    type: row.entry_type,
    value: Number(row.amount),
  };
}

export default async function reportsRoutes(app) {
  app.get('/reports/overview', { preHandler: requirePermission('reports.read') }, async () => {
    const [finance, delivered, products, ingredients, sheets, clients] = await Promise.all([
      app.db.query(`
        SELECT id, entry_date, description, category, entry_type, amount
        FROM financial_entries
        ORDER BY entry_date DESC, created_at DESC
        LIMIT 1000
      `),
      app.db.query(`
        SELECT id, client_id, client_name, total, created_at
        FROM orders
        WHERE status = ANY($1::text[])
      `, [completedStatuses]),
      app.db.query('SELECT id, name, category, sale_price, active FROM products ORDER BY category, name'),
      app.db.query('SELECT id, name, unit, unit_cost, current_stock, minimum_stock, category, active FROM ingredients ORDER BY category, name'),
      app.db.query(`
        SELECT ts.product_id, tsi.ingredient_id, tsi.quantity, tsi.unit
        FROM technical_sheets ts
        JOIN technical_sheet_items tsi ON tsi.sheet_id = ts.id
      `),
      app.db.query('SELECT id, name, phone FROM clients WHERE active=true ORDER BY name'),
    ]);

    const ingredientsById = new Map(ingredients.rows.map(item => [item.id, item]));
    const sheetItemsByProduct = new Map();
    for (const item of sheets.rows) {
      const list = sheetItemsByProduct.get(item.product_id) || [];
      list.push(item);
      sheetItemsByProduct.set(item.product_id, list);
    }

    const productCmv = products.rows
      .filter(product => product.active)
      .map(product => {
        let cost = 0;
        for (const item of sheetItemsByProduct.get(product.id) || []) {
          const ingredient = ingredientsById.get(item.ingredient_id);
          if (!ingredient) continue;
          let stockQuantity = Number(item.quantity);
          try {
            stockQuantity = convertQuantity(Number(item.quantity), item.unit, ingredient.unit);
          } catch {
            stockQuantity = 0;
          }
          cost += stockQuantity * Number(ingredient.unit_cost || 0);
        }
        const salePrice = Number(product.sale_price || 0);
        return {
          id: product.id,
          nome: product.name,
          categoria: product.category,
          precoVenda: salePrice,
          custo: cost,
          cmvPct: salePrice > 0 ? (cost / salePrice) * 100 : 0,
        };
      })
      .sort((a, b) => b.cmvPct - a.cmvPct);

    const clientsById = new Map(clients.rows.map(client => [client.id, client]));
    const rankingByKey = new Map();
    for (const order of delivered.rows) {
      const key = order.client_id || `walkin:${order.client_name || 'Balcão'}`;
      const client = clientsById.get(order.client_id);
      const row = rankingByKey.get(key) || {
        id: order.client_id,
        nome: client?.name || order.client_name || 'Balcão',
        telefone: client?.phone || '',
        pedidos: 0,
        total: 0,
        ultimo: null,
      };
      row.pedidos += 1;
      row.total += Number(order.total || 0);
      const date = dateOnly(order.created_at);
      if (!row.ultimo || date > row.ultimo) row.ultimo = date;
      rankingByKey.set(key, row);
    }

    return {
      data: {
        finance: finance.rows.map(entry),
        deliveredOrders: delivered.rowCount,
        productCmv,
        stock: ingredients.rows.filter(item => item.active).map(item => ({
          id: item.id,
          nome: item.name,
          categoria: item.category,
          unidade: item.unit,
          estoqueAtual: Number(item.current_stock || 0),
          estoqueMinimo: Number(item.minimum_stock || 0),
          custoUnitario: Number(item.unit_cost || 0),
        })),
        clients: [...rankingByKey.values()]
          .map(client => ({ ...client, ticketMedio: client.pedidos ? client.total / client.pedidos : 0 }))
          .sort((a, b) => b.total - a.total),
      },
    };
  });
}
