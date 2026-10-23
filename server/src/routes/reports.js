import { requirePermission } from '../middleware/auth.js';
import { convertQuantity } from '../domain/orders.js';
import { calculateTechnicalSheetCost } from '../domain/technical-sheet-costs.js';
import { loadCourseRecipeCosts } from '../services/course-recipe-costs.js';

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
    const [finance, delivered, products, ingredients, sheets, clients, promotions, preparationCosts] = await Promise.all([
      app.db.query(`
        SELECT id, entry_date, description, category, entry_type, amount
        FROM financial_entries
        ORDER BY entry_date DESC, created_at DESC
      `),
      app.db.query(`
        SELECT id, client_id, client_name, total, created_at
        FROM orders
        WHERE status = ANY($1::text[]) AND source NOT LIKE '%(Teste)'
      `, [completedStatuses]),
      app.db.query('SELECT id, name, category, sale_price, active FROM products ORDER BY category, name'),
      app.db.query('SELECT id, name, unit, unit_cost, current_stock, minimum_stock, category, active FROM ingredients ORDER BY category, name'),
      app.db.query(`
        SELECT ts.product_id,ts.yield AS sheet_yield,tsi.ingredient_id,tsi.preparation_id,tsi.quantity,tsi.unit,
          COALESCE(i.name,rc.name) AS name
        FROM technical_sheets ts
        JOIN technical_sheet_items tsi ON tsi.sheet_id = ts.id
        LEFT JOIN ingredients i ON i.id=tsi.ingredient_id
        LEFT JOIN recipe_cards rc ON rc.id=tsi.preparation_id
      `),
      app.db.query('SELECT id, name, phone FROM clients WHERE active=true ORDER BY name'),
      app.db.query(`SELECT code,name,rule_type AS "ruleType",COUNT(DISTINCT pa.order_id)::int AS orders,
        SUM(discount_amount)::numeric(12,2) AS discount,SUM(applied_subtotal)::numeric(12,2) AS promoted_sales
        FROM promotion_applications pa JOIN orders o ON o.id=pa.order_id
        WHERE o.status=ANY($1::text[]) AND o.source NOT LIKE '%(Teste)' GROUP BY code,name,rule_type ORDER BY SUM(discount_amount) DESC,code`,[completedStatuses]),
      loadCourseRecipeCosts(app.db),
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
        const items=sheetItemsByProduct.get(product.id)||[];
        const calculated=items.length?calculateTechnicalSheetCost({
          sheet:{yield:items[0].sheet_yield},
          items:items.map(item=>({ingredientId:item.ingredient_id,preparationId:item.preparation_id,quantity:Number(item.quantity),unit:item.unit,name:item.name})),
          ingredients:new Map(ingredients.rows.map(row=>[row.id,{id:row.id,name:row.name,unit:row.unit,unitCost:row.unit_cost===null?null:Number(row.unit_cost),active:Boolean(row.active)}])),
          preparations:preparationCosts,
        }):{total:0,partialTotal:0,complete:false,notes:['Ficha técnica sem itens.']};
        const cost=calculated.total;
        const salePrice = Number(product.sale_price || 0);
        return {
          id: product.id,
          nome: product.name,
          categoria: product.category,
          precoVenda: salePrice,
          custo: cost,
          custoParcial:calculated.partialTotal,
          custoCompleto:calculated.complete,
          pendencias:calculated.notes,
          cmvPct: salePrice > 0 && cost!==null ? (cost / salePrice) * 100 : null,
        };
      })
      .sort((a, b) => (b.cmvPct ?? -1) - (a.cmvPct ?? -1));

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
        deliveredOrderDates: delivered.rows.map(order=>dateOnly(order.created_at)),
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
        promotionPerformance: promotions.rows.map(promotion=>({...promotion,orders:Number(promotion.orders),discount:Number(promotion.discount),promotedSales:Number(promotion.promoted_sales)})),
      },
    };
  });
}
