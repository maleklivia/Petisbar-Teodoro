import { requirePermission } from '../middleware/auth.js';

export default async function dashboardRoutes(app) {
  app.get('/dashboard', { preHandler: requirePermission('orders.read') }, async request => {
    const canFinance=request.user.permissions.includes('finance.read');
    const canStock=request.user.permissions.includes('stock.read');
    const [orders,catalog,stock,finance,top,stats]=await Promise.all([
      app.db.query(`SELECT o.id,o.order_number,o.client_name,o.status,o.total,o.source,o.created_at,
        COALESCE((SELECT string_agg(oi.name||' ×'||oi.quantity,', ') FROM order_items oi WHERE oi.order_id=o.id),'') AS summary
        FROM orders o ORDER BY o.created_at DESC LIMIT 8`),
      app.db.query(`SELECT (SELECT count(*) FROM products)::int AS products,
        (SELECT count(*) FROM products WHERE active)::int AS active,
        (SELECT count(DISTINCT category) FROM products WHERE active)::int AS categories,
        (SELECT count(*) FROM ingredients WHERE active)::int AS ingredients,
        (SELECT count(*) FROM technical_sheets)::int AS sheets`),
      canStock?app.db.query(`SELECT id,name,unit,current_stock,minimum_stock,average_daily_use,lead_time_days
        FROM ingredients WHERE active=true AND current_stock<=greatest(minimum_stock,average_daily_use*lead_time_days)
        ORDER BY current_stock,name`):Promise.resolve({rows:[]}),
      canFinance?app.db.query(`SELECT category,entry_type,SUM(amount)::numeric AS amount FROM financial_entries
        WHERE entry_date>=date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date GROUP BY category,entry_type`):Promise.resolve({rows:[]}),
      app.db.query(`SELECT oi.product_id AS id,oi.name,SUM(oi.quantity)::int AS sold FROM order_items oi
        JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('Entregue','Concluído')
        AND coalesce(o.source,'') NOT LIKE '%(Teste)'
        GROUP BY oi.product_id,oi.name ORDER BY sold DESC LIMIT 5`),
      app.db.query(`SELECT count(*) FILTER(WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date)::int today,
        count(*) FILTER(WHERE status IN ('Novo','Aguardando Pagamento','Pago','Confirmado'))::int pending,
        count(*) FILTER(WHERE status='Em Produção')::int production,
        count(*) FILTER(WHERE source LIKE '%(Teste)')::int tests,
        count(*) FILTER(WHERE source NOT LIKE '%(Teste)' AND status IN ('Entregue','Concluído') AND created_at>=date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')::int monthly,
        coalesce(sum(total) FILTER(WHERE source NOT LIKE '%(Teste)' AND status IN ('Entregue','Concluído') AND created_at>=date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'),0)::numeric monthly_sales
        FROM orders`),
    ]);
    const revenue=finance.rows.filter(x=>x.entry_type==='Entrada').reduce((s,x)=>s+Number(x.amount),0);
    const expenses=finance.rows.filter(x=>x.entry_type==='Saída').reduce((s,x)=>s+Math.abs(Number(x.amount)),0);
    return {data:{orders:orders.rows,stats:stats.rows[0],catalog:catalog.rows[0],stock:stock.rows,top:top.rows,
      finance:canFinance?{revenue:Number(stats.rows[0].monthly_sales),expenses,profit:revenue-expenses,cmv:finance.rows.filter(x=>x.category==='CMV'||x.category==='Estorno de CMV').reduce((s,x)=>s-Number(x.amount),0)}:null}};
  });
}
