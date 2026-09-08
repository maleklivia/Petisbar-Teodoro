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

  async init() {
    this._serverMode = API.isServerMode();
    this._canWrite = !this._serverMode || API.hasPermission('orders.write');
    if (this._serverMode) {
      const board = document.getElementById('producao-board');
      if (board) board.innerHTML = '<div class="empty-state"><p>Carregando produção…</p></div>';
      try {
        const orders = await API.getServerOrders();
        this._orders = orders.map(order => this._mapServerOrder(order));
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

    const pedidos    = this._pedidos();
    const pendentes  = pedidos.filter(p => ['Novo', 'Aguardando Pagamento', 'Pago'].includes(p.status));
    const emProd     = pedidos.filter(p => p.status === 'Em Produção');
    const prontos    = pedidos.filter(p => ['Pronto', 'Saiu para Entrega'].includes(p.status));

    board.innerHTML = `
      <div class="kanban-board">
        ${this._renderCol('Pendentes',   pendentes, 'pendentes')}
        ${this._renderCol('Em Produção', emProd,    'em-producao')}
        ${this._renderCol('Prontos',     prontos,   'prontos')}
      </div>`;

    this._bindCardActions();
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
    const next       = nextStatus(p.status);

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

  async _avancar(pedidoId) {
    const pedidos = this._pedidos();
    const pedido  = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    const novo = nextStatus(pedido.status);
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
