/* ============================================================
   Petisbar Teodoro — ProducaoModule
   Quadro kanban da cozinha. Três colunas:
     Pendentes  → Novo | Aguardando Pagamento | Pago
     Em Produção→ Em Produção
     Prontos    → Pronto | Saiu para Entrega
   ============================================================ */

const ProducaoModule = {
  _serverMode: false,
  _orders: [],
  _canWrite: true,
  _search: '',
  _paused: false,
  _highDemand: false,

  async init() {
    this._serverMode = API.isServerMode();
    this._canWrite = !this._serverMode || API.hasPermission('orders.write');
    if (this._serverMode) {
      const board = document.getElementById('producao-board');
      if (board) board.innerHTML = '<div class="empty-state"><p>Carregando produção…</p></div>';
      try {
        const orders = await API.getServerOrders();
        this._orders = orders.map(order => this._mapServerOrder(order));
        const settings = await API.getServerSettings();
        this._paused = settings['storefront.isOpen'] === false;
        this._highDemand = settings['storefront.highDemand'] === true;
      } catch {
        UI.toast('Falha ao carregar a produção do servidor.', 'danger');
        this._orders = [];
      }
    }
    this._render();
    this._bindRefresh();
  },

  _mapServerOrder(order) {
    return {
      id: order.id,
      numeroPedido: order.orderNumber,
      clienteNome: order.clientName,
      status: order.status,
      formaPagamento:order.paymentMethod,
      fulfillmentType:order.fulfillmentType,
      itens: (order.items || []).map(item => ({
        qty: Number(item.quantity),
        nome: item.name,
      })),
      total: Number(order.total),
      observacoes: order.notes,
      dataCriacao: order.createdAt,
      dataAtualizacao: order.updatedAt,
    };
  },

  /* ── Dados ────────────────────────────────────────────────── */

  _pedidos() { return this._serverMode ? this._orders : Stores.pedidos.get(); },

  /* ── Renderização ─────────────────────────────────────────── */

  _render() {
    const board = document.getElementById('producao-board');
    if (!board) return;

    const pedidos    = this._pedidos().filter(p => !this._search || `${p.numeroPedido} ${p.clienteNome || ''}`.toLowerCase().includes(this._search.toLowerCase()));
    const pendentes  = pedidos.filter(p => ['Novo', 'Aguardando Pagamento', 'Pago'].includes(p.status));
    const emProd     = pedidos.filter(p => p.status === 'Em Produção');
    const prontos    = pedidos.filter(p => p.status === 'Pronto');
    const entregas   = pedidos.filter(p => p.status === 'Saiu para Entrega');
    const finalizados= pedidos.filter(p => ['Entregue', 'Concluído'].includes(p.status));

    board.innerHTML = `
      <div class="production-toolbar">
        <div class="production-tabs"><button class="production-tab is-active">Kanban</button><button class="production-tab">Roteirização</button></div>
        <input class="form-input production-search" id="production-search" placeholder="Buscar (nome, telefone, pedido)" value="${Utils.escapeHtml(this._search)}">
        <button class="btn btn-ghost" id="production-pause">${this._paused ? '▶ Retomar loja' : 'Ⅱ Pausar loja'}</button>
        <button class="btn btn-ghost" id="production-demand">♨ ${this._highDemand ? 'Remover alta demanda' : 'Informar alta demanda'}</button>
        <button class="btn btn-ghost" id="production-report">Abrir relatório diário</button>
      </div>
      <div class="kanban-board">
        ${this._renderCol('Em análise', pendentes, 'analise')}
        ${this._renderCol('Em preparo', emProd, 'em-preparo')}
        ${this._renderCol('Pronto', prontos, 'pronto')}
        ${this._renderCol('Em entrega', entregas, 'entrega')}
        ${this._renderCol('Finalizados', finalizados, 'finalizados')}
      </div>`;

    this._bindCardActions();
    this._bindToolbar();
  },

  _renderCol(titulo, pedidos, slug) {
    const cards = pedidos.length
      ? pedidos.map(p => this._renderCard(p)).join('')
      : '<p class="kanban-empty">Sem pedidos</p>';

    return `
      <div class="kanban-col kanban-col--${slug}">
        <div class="kanban-col__header">
          <span class="kanban-col__title">${titulo}</span>
          <span class="kanban-col__count">${pedidos.length}</span>
        </div>
        <div class="kanban-col__body">${cards}</div>
      </div>`;
  },

  _renderCard(p) {
    const elapsed    = this._elapsed(p.dataCriacao);
    const resumo     = p.itens.map(i => `${i.qty}× ${i.nome}`).join(', ');
    const next       = nextStatus(p.status,p);

    return `
      <div class="kanban-card" data-id="${p.id}">
        <div class="kanban-card__header">
          <strong>#${p.numeroPedido} — ${Utils.escapeHtml(p.clienteNome || 'Balcão')}</strong>
          <span class="kanban-card__elapsed">${elapsed}</span>
        </div>
        <div class="kanban-card__items">${Utils.escapeHtml(resumo)}</div>
        ${p.observacoes ? `<div class="kanban-card__obs">⚑ ${Utils.escapeHtml(p.observacoes)}</div>` : ''}
        <div class="kanban-card__footer">
          <span class="kanban-card__total">${Utils.currency(p.total)}</span>
          ${this._canWrite && next
            ? `<button type="button" class="btn btn-sm btn-primary" data-action="avancar" data-id="${p.id}">→ ${Utils.escapeHtml(next)}</button>`
            : `<span class="kanban-card__done">✓ Concluído</span>`}
        </div>
      </div>`;
  },

  _elapsed(dataCriacao) {
    try {
      const mins = Math.floor((Date.now() - new Date(dataCriacao).getTime()) / 60000);
      if (mins < 1)  return 'agora';
      if (mins < 60) return `${mins}min`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h${m > 0 ? m + 'min' : ''}`;
    } catch {
      return '';
    }
  },

  /* ── Ações ────────────────────────────────────────────────── */

  _bindCardActions() {
    document.querySelectorAll('.kanban-card [data-action="avancar"]').forEach(btn => {
      btn.addEventListener('click', () => this._avancar(btn.dataset.id));
    });
  },

  _bindToolbar() {
    const search=document.getElementById('production-search');
    if(search) search.addEventListener('input',()=>{this._search=search.value;this._render();});
    document.getElementById('production-pause')?.addEventListener('click',async()=>{
      if(!this._serverMode){this._paused=!this._paused;this._render();return UI.toast(this._paused?'Loja pausada para novos pedidos.':'Loja retomada.','success');}
      const nextOpen=this._paused;
      try { await API.saveServerSettings({'storefront.isOpen':nextOpen}); this._paused=!nextOpen; this._render(); UI.toast(this._paused?'Loja pausada para novos pedidos.':'Loja retomada.','success'); }
      catch { UI.toast('Não foi possível alterar o estado da loja.','danger'); }
    });
    document.getElementById('production-demand')?.addEventListener('click',async()=>{
      if(!this._serverMode){this._highDemand=!this._highDemand;return UI.toast(this._highDemand?'Alta demanda informada à equipe.':'Aviso de alta demanda removido.','success');}
      const next=!this._highDemand;
      try { await API.saveServerSettings({'storefront.highDemand':next}); this._highDemand=next; this._render(); UI.toast(this._highDemand?'Alta demanda informada à equipe.':'Aviso de alta demanda removido.','success'); }
      catch { UI.toast('Não foi possível atualizar a alta demanda.','danger'); }
    });
    document.getElementById('production-report')?.addEventListener('click',()=>UI.toast('Relatório diário disponível na aba Relatórios.','success'));
  },

  async _avancar(pedidoId) {
    const pedidos = this._pedidos();
    const pedido  = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    const novo = nextStatus(pedido.status,pedido);
    if (!novo) return;

    if (this._serverMode) {
      try {
        const updated = await API.updateServerOrderStatus(pedidoId, novo);
        const idx = this._orders.findIndex(order => order.id === pedidoId);
        if (idx >= 0) this._orders[idx] = this._mapServerOrder(updated);
        UI.toast(`#${pedido.numeroPedido} → ${novo}`, 'success');
        this._render();
      } catch (error) {
        UI.toast(error.code === 'insufficient_stock' ? 'Estoque insuficiente para concluir o pedido.' : 'Não foi possível avançar o pedido.', 'danger');
      }
      return;
    }

    pedido.status          = novo;
    pedido.dataAtualizacao = new Date().toISOString();
    Stores.pedidos.set(pedidos);

    const eventMap = {
      'Pago':              EVENTS.PEDIDO_PAGO,
      'Em Produção':       EVENTS.PEDIDO_EM_PRODUCAO,
      'Pronto':            EVENTS.PEDIDO_PRONTO,
      'Saiu para Entrega': EVENTS.PEDIDO_SAIU_ENTREGA,
      'Entregue':          EVENTS.PEDIDO_ENTREGUE,
    };
    EventBus.emit(eventMap[novo] || EVENTS.PEDIDO_ATUALIZADO, { pedido });

    if (novo === 'Entregue') {
      if (typeof EstoqueService   !== 'undefined') EstoqueService.baixarEstoque(pedido.id, pedido.itens);
      if (typeof FinanceiroService !== 'undefined') FinanceiroService.registrarVenda(pedido);
    }

    UI.toast(`#${pedido.numeroPedido} → ${novo}`, 'success');
    this._render();
  },

  /* ── Auto-refresh ─────────────────────────────────────────── */

  _bindRefresh() {
    const btn = document.getElementById('btn-refresh-board');
    if (btn) btn.addEventListener('click', async () => {
      if (this._serverMode) {
        const orders = await API.getServerOrders();
        this._orders = orders.map(order => this._mapServerOrder(order));
      }
      this._render();
    });
  },
};
