/* ============================================================
   Petisbar Teodoro — App
   Inicialização, roteamento de páginas e módulos de cada view.
   Quando uma view crescer o suficiente, extraia para js/pages/<view>.js
   e importe aqui.
   ============================================================ */

const PAGE_TITLES = {
  dashboard:    'Dashboard',
  financeiro:   'Financeiro',
  pedidos:      'Pedidos',
  producao:     'Produção',
  produtos:     'Produtos',
  estoque:      'Estoque',
  compras:      'Compras',
  fornecedores: 'Fornecedores',
  clientes:     'Clientes',
  marketing:    'Marketing',
  documentos:   'Documentos',
  relatorios:   'Relatórios',
  configuracoes:'Configurações',
};

/* ── App Controller ──────────────────────────────────────────── */
const App = {
  state: null,

  async init(page) {
    this.state = Storage.getState();

    // Load shared components
    await Promise.all([UI.loadSidebar(), UI.loadHeader()]);

    // Set UI state
    UI.setActiveNav(page);
    UI.setHeaderTitle(PAGE_TITLES[page] || page);
    UI.setHeaderDate();
    UI.setUserInfo('Administrador');

    // Run page-specific module
    if (Modules[page]) {
      await Modules[page].init(this.state);
    }
  },

  refresh() {
    this.state = Storage.getState();
  },
};

/* ── Page Modules ────────────────────────────────────────────── */
const Modules = {

  /* ── Dashboard ─────────────────────────────────────────────── */
  dashboard: {
    async init(state) {
      const currentState = this._buildCurrentState(state);
      this._renderKpis(currentState);
      this._renderOrderStats();
      this._renderCatalogStats();
      this._renderRecentOrders(currentState);
      this._renderTopProducts(currentState);
      this._renderStockAlerts(currentState);
      this._renderAlertasCusto();
    },

    _buildCurrentState(state) {
      if (typeof Stores === 'undefined') return state;
      const pedidos = Stores.pedidos.get();
      const soldByProduct = new Map();
      pedidos.filter(p => p.status === 'Entregue').forEach(pedido => {
        pedido.itens.forEach(item => {
          soldByProduct.set(item.produtoId, (soldByProduct.get(item.produtoId) || 0) + item.qty);
        });
      });

      return {
        ...state,
        products: Stores.produtos.get().filter(p => p.ativo).map(p => ({
          id: p.id, name: p.nome, sold: soldByProduct.get(p.id) || 0,
        })),
        stock: Stores.ingredientes.get().filter(i => i.ativo).map(i => ({
          id: i.id,
          name: i.nome,
          unit: i.unidade,
          quantity: i.estoqueAtual,
          min: Math.max(Number(i.estoqueMinimo) || 0, (Number(i.consumoMedioDiario) || 0) * (Number(i.prazoReposicaoDias) || 0)),
        })),
        orders: pedidos.map(p => ({
          id: `#${String(p.numeroPedido).padStart(3, '0')}`,
          product: p.itens.map(i => i.nome).join(', '),
          qty: p.itens.reduce((sum, i) => sum + i.qty, 0),
          total: p.total,
          client: p.clienteNome,
          status: p.status,
          date: p.dataCriacao?.slice(0, 10),
        })),
      };
    },

    _calcKpis(state) {
      const month = Utils.currentMonth();
      const finMonth = state.finance.filter(f => (f.date || '').startsWith(month));

      const revenue = finMonth
        .filter(f => f.type === 'Entrada' && f.category === 'Vendas')
        .reduce((s, f) => s + (f.value || 0), 0);

      const cmvTotal = finMonth
        .filter(f => f.category === 'CMV')
        .reduce((s, f) => s + Math.abs(f.value || 0), 0);

      const expenses = finMonth
        .filter(f => f.type === 'Saída')
        .reduce((s, f) => s + Math.abs(f.value || 0), 0);

      const profit      = revenue - expenses;
      const ordersMonth = state.orders.filter(o => (o.date || '').startsWith(month)).length;
      const ticket      = ordersMonth > 0 ? revenue / ordersMonth : 0;
      const cmvPct      = Utils.cmvPercent(cmvTotal, revenue);
      const lowStock    = state.stock.filter(s => s.quantity <= s.min).length;
      const cmvGoal     = state.settings?.cmvGoal || 35;

      return { revenue, profit, ordersMonth, ticket, cmvPct, cmvGoal, lowStock };
    },

    _renderKpis(state) {
      const el = document.getElementById('kpi-row');
      if (!el) return;

      const { revenue, profit, ordersMonth, ticket, cmvPct, cmvGoal, lowStock } = this._calcKpis(state);

      const cards = [
        { label: 'Faturamento',   value: Utils.currency(revenue),  sub: 'este mês',              cls: '' },
        { label: 'Lucro Est.',    value: Utils.currency(profit),   sub: Utils.pct(profit / (revenue || 1)) + ' margem', cls: profit < 0 ? 'kpi-card--warn' : '' },
        { label: 'Pedidos',       value: ordersMonth,              sub: 'este mês',              cls: '' },
        { label: 'Ticket Médio',  value: Utils.currency(ticket),   sub: 'por pedido',            cls: '' },
        { label: 'CMV',           value: cmvPct + '%',             sub: `meta ${cmvGoal}%`,      cls: cmvPct > cmvGoal ? 'kpi-card--warn' : 'kpi-card--ok' },
        { label: 'Estoque Baixo', value: lowStock,                 sub: lowStock ? 'itens críticos' : 'tudo ok', cls: lowStock > 0 ? 'kpi-card--warn' : 'kpi-card--ok' },
      ];

      el.innerHTML = cards.map(c => `
        <article class="kpi-card ${c.cls}">
          <span class="kpi-card__label">${c.label}</span>
          <strong class="kpi-card__value">${c.value}</strong>
          <small class="kpi-card__sub">${c.sub}</small>
        </article>
      `).join('');
    },

    _renderCatalogStats() {
      const el = document.getElementById('catalog-bar');
      if (!el) return;

      if (typeof Stores === 'undefined') { el.style.display = 'none'; return; }

      const produtos     = Stores.produtos.get();
      const ingredientes = Stores.ingredientes.get();
      const fichas       = Stores.fichas.get();
      const ativos       = produtos.filter(p => p.ativo).length;

      const stats = [
        { label: 'Produtos',    value: produtos.length,     sub: `${ativos} ativos` },
        { label: 'Ingredientes',value: ingredientes.length,  sub: 'cadastrados' },
        { label: 'Fichas',      value: fichas.length,        sub: 'técnicas' },
        { label: 'Categorias',  value: [...new Set(produtos.map(p => p.categoria))].length, sub: 'de produto' },
      ];

      el.innerHTML = stats.map(s => `
        <div class="catalog-stat">
          <span class="catalog-stat__label">${s.label}</span>
          <span class="catalog-stat__value">${s.value}</span>
          <span class="catalog-stat__sub">${s.sub}</span>
        </div>
      `).join('');
    },

    _renderOrderStats() {
      const el = document.getElementById('order-stats-bar');
      if (!el || typeof Stores === 'undefined') return;

      const today   = Utils.today();
      const pedidos = Stores.pedidos.get();

      const hoje     = pedidos.filter(p => p.dataCriacao?.startsWith(today)).length;
      const pendentes= pedidos.filter(p => ['Novo', 'Aguardando Pagamento', 'Pago'].includes(p.status)).length;
      const emProd   = pedidos.filter(p => p.status === 'Em Produção').length;
      const entregues= pedidos.filter(p => p.status === 'Entregue' && p.dataCriacao?.startsWith(today)).length;

      const stats = [
        { label: 'Pedidos Hoje',  value: hoje,      sub: 'criados hoje'    },
        { label: 'Pendentes',     value: pendentes,  sub: 'aguardando ação' },
        { label: 'Em Produção',   value: emProd,     sub: 'na cozinha'      },
        { label: 'Entregues Hoje',value: entregues,  sub: 'finalizados'     },
      ];

      el.innerHTML = stats.map(s => `
        <div class="order-stat">
          <span class="order-stat__label">${s.label}</span>
          <span class="order-stat__value">${s.value}</span>
          <span class="order-stat__sub">${s.sub}</span>
        </div>
      `).join('');
    },

    _renderRecentOrders(state) {
      const el = document.getElementById('recent-orders');
      if (!el) return;

      const recent = state.orders.slice(0, 8);
      if (!recent.length) {
        el.innerHTML = '<div class="empty-state"><p>Nenhum pedido ainda.</p></div>';
        return;
      }

      const statusClass = {
        'Aguardando pagamento': 'aguardando',
        'Em produção':          'producao',
        'Saiu para entrega':    'entrega',
        'Pedido finalizado':    'finalizado',
      };

      el.innerHTML = recent.map(o => `
        <div class="order-row">
          <span class="order-row__id">${o.id}</span>
          <div class="order-row__info">
            <div class="order-row__product">${o.product}${o.qty > 1 ? ' \xD7' + o.qty : ''}</div>
            <div class="order-row__client">${o.client || '—'} \xB7 ${Utils.formatShortDate(o.date)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="order-row__value">${Utils.currency(o.total)}</span>
            <span class="status-pill status-pill--${statusClass[o.status] || 'finalizado'}">${o.status}</span>
          </div>
        </div>
      `).join('');
    },

    _renderTopProducts(state) {
      const el = document.getElementById('top-products');
      if (!el) return;

      const sorted = [...state.products]
        .filter(p => p.sold > 0)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 5);

      if (!sorted.length) {
        el.innerHTML = '<div class="empty-state"><p>Sem vendas registradas.</p></div>';
        return;
      }

      el.innerHTML = sorted.map((p, i) => `
        <div class="product-rank">
          <span class="product-rank__pos ${i === 0 ? 'top' : ''}">${i + 1}</span>
          <span class="product-rank__name">${p.name}</span>
          <span class="product-rank__sold">${p.sold} vendas</span>
        </div>
      `).join('');
    },

    _renderAlertasCusto() {
      const el = document.getElementById('custo-alerts');
      const panel = document.getElementById('custo-alerts-panel');
      if (!el || typeof Stores === 'undefined') return;

      const ings    = Stores.ingredientes.get();
      const fichas  = Stores.fichas.get();
      const produtos = Stores.produtos.get();

      const comAlta   = ings.filter(i => i._alertaCusto);
      const comStreak = ings.filter(i => (i._streakBarata || 0) >= 3);

      if (!comAlta.length && !comStreak.length) {
        if (panel) panel.style.display = 'none';
        return;
      }

      if (panel) panel.style.display = '';

      const calcProdutosAfetados = (ingId) => {
        return fichas
          .filter(f => f.itens.some(i => i.ingredienteId === ingId))
          .map(f => produtos.find(p => p.id === f.produtoId)?.nome)
          .filter(Boolean);
      };

      const linhasAlta = comAlta.map(ing => {
        const a = ing._alertaCusto;
        const prods = calcProdutosAfetados(ing.id);
        return `
          <div class="stock-alert" style="border-left:3px solid var(--color-danger);padding-left:8px">
            <span class="stock-alert__icon" style="color:var(--color-danger)">🚨</span>
            <div class="stock-alert__info">
              <div class="stock-alert__item" style="font-weight:700">${Utils.escapeHtml(ing.nome)}</div>
              <div class="stock-alert__qty">
                +${Math.round(a.variacao * 100)}% desde ${Utils.formatShortDate(a.data)}
                · ${Utils.currency(a.custoAnterior)} → ${Utils.currency(a.custoNovo)}/${Utils.escapeHtml(ing.unidade)}
              </div>
              ${prods.length ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">Afeta: ${prods.join(', ')}</div>` : ''}
            </div>
          </div>
        `;
      });

      const linhasStreak = comStreak.map(ing => {
        const prods = calcProdutosAfetados(ing.id);
        return `
          <div class="stock-alert" style="border-left:3px solid var(--color-success);padding-left:8px">
            <span class="stock-alert__icon" style="color:var(--color-success)">💡</span>
            <div class="stock-alert__info">
              <div class="stock-alert__item">${Utils.escapeHtml(ing.nome)}</div>
              <div class="stock-alert__qty">
                ${ing._streakBarata}x mais barato que o custo cadastrado (${Utils.currency(ing.custoUnitario)}/${Utils.escapeHtml(ing.unidade)})
              </div>
              ${prods.length ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">Pode reduzir CMV de: ${prods.join(', ')}</div>` : ''}
            </div>
          </div>
        `;
      });

      el.innerHTML = [...linhasAlta, ...linhasStreak].join('');
    },

    _renderStockAlerts(state) {
      const el = document.getElementById('stock-alerts');
      if (!el) return;

      const alerts = state.stock.filter(s => s.quantity <= s.min);

      if (!alerts.length) {
        el.innerHTML = '<div class="empty-state" style="padding:16px 0"><p>Estoque OK ✓</p></div>';
        return;
      }

      el.innerHTML = alerts.map(s => `
        <div class="stock-alert">
          <span class="stock-alert__icon">⚠</span>
          <div class="stock-alert__info">
            <div class="stock-alert__item">${s.name}</div>
            <div class="stock-alert__qty">${s.quantity}${s.unit} \xB7 m\xEDn. ${s.min}${s.unit}</div>
          </div>
        </div>
      `).join('');
    },
  },

  financeiro:   { async init() { if (typeof FinanceiroModule   !== 'undefined') FinanceiroModule.init();   } },
  pedidos:      { async init() { if (typeof PedidosModule      !== 'undefined') PedidosModule.init();      } },
  producao:     { async init() { if (typeof ProducaoModule     !== 'undefined') ProducaoModule.init();     } },
  produtos:     { async init() { if (typeof ProdutosModule     !== 'undefined') ProdutosModule.init();     } },
  clientes:     { async init() { if (typeof ClientesModule     !== 'undefined') ClientesModule.init();     } },
  estoque:      { async init() { if (typeof EstoqueModule      !== 'undefined') EstoqueModule.init();      } },
  compras:      { async init() { if (typeof ComprasModule      !== 'undefined') ComprasModule.init();      } },
  fornecedores: { async init() { if (typeof FornecedoresModule !== 'undefined') FornecedoresModule.init(); } },
  marketing:    { async init() { if (typeof MarketingModule    !== 'undefined') MarketingModule.init();    } },
  documentos:   { async init() { if (typeof DocumentosModule   !== 'undefined') DocumentosModule.init();   } },
  relatorios:   { async init() { if (typeof RelatoriosModule   !== 'undefined') RelatoriosModule.init();   } },
  configuracoes:{ async init() { if (typeof ConfiguracoesModule!== 'undefined') ConfiguracoesModule.init();} },
};

/* ── Auto-init via data-page attribute ───────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page) App.init(page);
});
