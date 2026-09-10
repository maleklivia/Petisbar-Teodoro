/* ============================================================
   Petisbar Teodoro — PedidosModule
   Motor central de pedidos. Gerencia todo o ciclo de vida:
   Novo → Aguardando Pagamento → Pago → Em Produção →
   Pronto → Saiu para Entrega → Entregue / Cancelado.
   ============================================================ */

const PedidosModule = {
  _filtroStatus: 'Todos',
  _serverMode: false,
  _serverOrders: [],
  _serverProducts: [],
  _serverClients: [],
  _canWrite: true,

  async init() {
    this._serverMode = API.isServerMode();
    this._canWrite = API.hasPermission('orders.write');
    if (this._serverMode) {
      const container = document.getElementById('pedidos-content');
      if (container) container.innerHTML = '<div class="empty-state"><p>Carregando pedidos…</p></div>';
      try {
        const [orders, products, clients] = await Promise.all([
          API.getServerOrders(),
          API.getServerProducts(),
          API.hasPermission('clients.read') ? API.getServerClients() : Promise.resolve([]),
        ]);
        this._serverOrders = orders.map(order => this._mapServerOrder(order));
        this._serverProducts = products.filter(product => product.ativo);
        this._serverClients = clients;
      } catch (error) {
        if (container) container.innerHTML = '<div class="empty-state"><p>Não foi possível carregar os pedidos.</p></div>';
        UI.toast('Falha ao carregar os pedidos do servidor.', 'danger');
        return;
      }
    }
    this._render();
    this._bindToolbar();
  },

  _mapServerOrder(order) {
    return {
      id: order.id,
      numeroPedido: order.orderNumber,
      origem: order.source,
      clienteId: order.clientId,
      clienteNome: order.clientName,
      status: order.status,
      itens: (order.items || []).map(item => ({
        id: item.id,
        produtoId: item.productId,
        nome: item.name,
        qty: Number(item.quantity),
        precoUnitario: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        options: item.options || {},
      })),
      subtotal: Number(order.subtotal),
      taxaEntrega: Number(order.deliveryFee),
      desconto: Number(order.discount),
      total: Number(order.total),
      formaPagamento: order.paymentMethod,
      observacoes: order.notes,
      dataCriacao: order.createdAt,
      dataAtualizacao: order.updatedAt,
    };
  },

  /* ── Dados ────────────────────────────────────────────────── */

  _pedidos() { return this._serverMode ? this._serverOrders : Stores.pedidos.get(); },

  _produtos() { return this._serverMode ? this._serverProducts : Stores.produtos.get().filter(p => p.ativo); },

  _clientes() { return this._serverMode ? this._serverClients : Stores.clientes.get(); },

  _filtered() {
    const all = this._pedidos();
    if (this._filtroStatus === 'Todos') return all;
    return all.filter(p => p.status === this._filtroStatus);
  },

  /* ── Renderização ─────────────────────────────────────────── */

  _render() {
    const container = document.getElementById('pedidos-content');
    if (!container) return;

    const pedidos = this._filtered();

    container.innerHTML =
      this._renderStatusBar() +
      (pedidos.length ? this._renderTable(pedidos) : '<div class="empty-state"><p>Nenhum pedido encontrado.</p></div>');

    this._bindStatusBar();
    this._bindTableActions();
  },

  _renderStatusBar() {
    const all = this._pedidos();
    const countAll = all.length;

    const pills = STATUS_PEDIDO.map(s => {
      const n = all.filter(p => p.status === s).length;
      const active = this._filtroStatus === s ? 'active' : '';
      return `<button class="status-filter-btn ${active}" data-status="${s}">
        ${Utils.escapeHtml(s)} ${n ? `<span class="count-badge">${n}</span>` : ''}
      </button>`;
    });

    const allActive = this._filtroStatus === 'Todos' ? 'active' : '';
    return `
      <div class="status-filter-bar">
        <button class="status-filter-btn ${allActive}" data-status="Todos">Todos <span class="count-badge">${countAll}</span></button>
        ${pills.join('')}
      </div>`;
  },

  _renderTable(pedidos) {
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th><th>Cliente</th><th>Origem</th><th>Itens</th>
              <th>Total</th><th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>${pedidos.map(p => this._renderRow(p)).join('')}</tbody>
        </table>
      </div>`;
  },

  _renderRow(p) {
    const slug = this._statusSlug(p.status);
    const next = nextStatus(p.status);
    const resumo = p.itens.map(i => `${i.nome} ×${i.qty}`).join(', ');
    const resumoCurt = resumo.length > 35 ? resumo.slice(0, 35) + '…' : resumo;
    const canCancel = !['Cancelado', 'Entregue', 'Concluído'].includes(p.status);

    return `
      <tr data-id="${p.id}">
        <td><strong>#${p.numeroPedido}</strong><br><small style="color:var(--color-text-muted)">${p.origem}</small>${p.agendadoPara ? `<br><span class="badge badge-gold">${new Date(p.agendadoPara).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>` : ''}</td>
        <td>${Utils.escapeHtml(p.clienteNome || '—')}</td>
        <td><span class="origem-badge">${Utils.escapeHtml(p.origem)}</span></td>
        <td class="itens-cell" title="${Utils.escapeHtml(resumo)}">${Utils.escapeHtml(resumoCurt)}</td>
        <td><strong>${Utils.currency(p.total)}</strong><br><small style="color:var(--color-text-muted)">${Utils.escapeHtml(p.formaPagamento)}</small></td>
        <td><span class="status-pill status-pill--${slug}">${Utils.escapeHtml(p.status)}</span></td>
        <td class="row-actions">
          ${this._canWrite && next ? `<button class="btn btn-sm btn-primary" data-action="avancar" data-id="${p.id}" title="→ ${Utils.escapeHtml(next)}">→ ${Utils.escapeHtml(next)}</button>` : ''}
          ${this._canWrite && canCancel ? `<button class="btn-icon btn-icon--danger" data-action="cancelar" data-id="${p.id}" title="Cancelar pedido">✕</button>` : ''}
        </td>
      </tr>`;
  },

  _statusSlug(status) {
    return status
      .toLowerCase()
      .replace(/\s+/g, '-')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  },

  /* ── Bindings ─────────────────────────────────────────────── */

  _bindStatusBar() {
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filtroStatus = btn.dataset.status;
        this._render();
      });
    });
  },

  _bindTableActions() {
    document.querySelectorAll('[data-action="avancar"]').forEach(btn => {
      btn.addEventListener('click', () => this._avancarStatus(btn.dataset.id));
    });
    document.querySelectorAll('[data-action="cancelar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Cancelar este pedido?')) this._mudarStatus(btn.dataset.id, 'Cancelado');
      });
    });
  },

  _bindToolbar() {
    const button = document.getElementById('btn-novo-pedido');
    if (!button) return;
    if (!this._canWrite) {
      button.hidden = true;
      return;
    }
    button.addEventListener('click', () => this._abrirModalNovoPedido());
  },

  /* ── Mudança de Status ────────────────────────────────────── */

  _avancarStatus(pedidoId) {
    const pedido = this._pedidos().find(p => p.id === pedidoId);
    if (!pedido) return;
    const novo = nextStatus(pedido.status);
    if (novo) this._mudarStatus(pedidoId, novo);
  },

  async _mudarStatus(pedidoId, novoStatus) {
    const pedidos  = this._pedidos();
    const pedido   = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    if (this._serverMode) {
      try {
        const updated = await API.updateServerOrderStatus(pedidoId, novoStatus);
        const index = this._serverOrders.findIndex(order => order.id === pedidoId);
        if (index >= 0) this._serverOrders[index] = this._mapServerOrder(updated);
        UI.toast(`Pedido #${pedido.numeroPedido} → ${novoStatus}`, 'success');
        this._render();
      } catch (error) {
        const message = error.code === 'insufficient_stock'
          ? `Estoque insuficiente: ${error.details?.item || 'revise os insumos'}.`
          : error.code === 'invalid_status_transition'
            ? 'Essa mudança de status não é permitida.'
            : 'Não foi possível atualizar o pedido.';
        UI.toast(message, 'danger');
      }
      return;
    }

    const statusAntigo = pedido.status;
    pedido.status          = novoStatus;
    pedido.dataAtualizacao = new Date().toISOString();
    Stores.pedidos.set(pedidos);

    // Emite evento específico
    const eventMap = {
      'Pago':              EVENTS.PEDIDO_PAGO,
      'Em Produção':       EVENTS.PEDIDO_EM_PRODUCAO,
      'Pronto':            EVENTS.PEDIDO_PRONTO,
      'Saiu para Entrega': EVENTS.PEDIDO_SAIU_ENTREGA,
      'Entregue':          EVENTS.PEDIDO_ENTREGUE,
      'Cancelado':         EVENTS.PEDIDO_CANCELADO,
    };
    EventBus.emit(eventMap[novoStatus] || EVENTS.PEDIDO_ATUALIZADO, { pedido });

    // Side-effects ao entregar
    if (novoStatus === 'Entregue') {
      EstoqueService.baixarEstoque(pedido.id, pedido.itens);
      if (typeof FinanceiroService !== 'undefined') FinanceiroService.registrarVenda(pedido);
    }

    // Estorno se era Entregue e foi cancelado
    if (novoStatus === 'Cancelado' && statusAntigo === 'Entregue') {
      EstoqueService.estornarEstoque(pedido.id, pedido.itens);
    }

    UI.toast(`Pedido #${pedido.numeroPedido} → ${novoStatus}`, 'success');
    this._render();
  },

  /* ── Modal: Novo Pedido ───────────────────────────────────── */

  _abrirModalNovoPedido() {
    Carrinho.limpar();
    const clientes = this._clientes();
    const produtos = this._produtos();

    UI.openModal({
      title:        'Novo Pedido',
      body:         this._buildModalBody(clientes, produtos),
      confirmLabel: 'Criar Pedido',
      size:         'wide',
      onConfirm:    () => this._criarPedido(),
    });

    this._bindModalEvents(produtos);
    this._renderCarrinho();
  },

  _buildModalBody(clientes, produtos) {
    const optsClientes = clientes.map(c =>
      `<option value="${c.id}">${Utils.escapeHtml(c.nome)}</option>`
    ).join('');

    const listaProdutos = produtos.map(p => `
      <div class="produto-item" data-id="${p.id}" data-nome="${Utils.escapeHtml(p.nome)}" data-preco="${p.precoVenda}">
        <span class="produto-item__nome">${Utils.escapeHtml(p.nome)}</span>
        <span class="produto-item__preco">${Utils.currency(p.precoVenda)}</span>
        <div class="produto-item__qty-control" aria-label="Quantidade de ${Utils.escapeHtml(p.nome)}">
          <button type="button" class="produto-item__qty-btn produto-item__qty-btn--minus" data-product-action="dec" data-id="${p.id}" aria-label="Diminuir quantidade" disabled>−</button>
          <output class="produto-item__qty" data-product-qty="${p.id}" aria-live="polite">0</output>
          <button type="button" class="produto-item__qty-btn produto-item__qty-btn--plus" data-product-action="inc" data-id="${p.id}" aria-label="Adicionar produto">+</button>
        </div>
      </div>`).join('');

    const optsOrigens = ORIGENS.map(o => `<option>${Utils.escapeHtml(o)}</option>`).join('');
    const optsFormas  = FORMAS_PAGAMENTO.map(f => `<option>${Utils.escapeHtml(f)}</option>`).join('');

    return `
      <div class="pedido-modal">
        <div class="pedido-modal__left">
          <div class="form-group">
            <label class="form-label">Buscar produto</label>
            <input type="text" id="produto-search" class="form-input" placeholder="Nome do produto…">
          </div>
          <div id="produto-list" class="produto-list">${listaProdutos}</div>
        </div>
        <div class="pedido-modal__right">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cliente</label>
              <select id="pedido-cliente" class="form-input">
                <option value="">— balcão —</option>
                ${optsClientes}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Origem</label>
              <select id="pedido-origem" class="form-input">${optsOrigens}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Forma de Pagamento</label>
            <select id="pedido-forma" class="form-input">${optsFormas}</select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Quando preparar</label>
              <select id="pedido-tipo-horario" class="form-input">
                <option value="agora">O quanto antes</option>
                <option value="agendado">Agendar data e horário</option>
              </select>
            </div>
            <div class="form-group hidden" id="pedido-agendamento-group">
              <label class="form-label">Data e horário</label>
              <input type="datetime-local" id="pedido-agendado-para" class="form-input">
            </div>
          </div>
          <div id="carrinho-itens" class="carrinho-itens"></div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Taxa Entrega (R$)</label>
              <input type="number" id="pedido-taxa" class="form-input" value="0" min="0" step="0.5">
              <small id="frete-info" style="color:var(--text-muted);font-size:var(--text-xs);display:block;margin-top:4px"></small>
            </div>
            <div class="form-group">
              <label class="form-label">Desconto (R$)</label>
              <input type="number" id="pedido-desconto" class="form-input" value="0" min="0" step="0.5">
            </div>
          </div>
          <div id="carrinho-totais" class="carrinho-totais"></div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea id="pedido-obs" class="form-input" rows="2" placeholder="Alguma observação…"></textarea>
          </div>
        </div>
      </div>`;
  },

  _bindModalEvents(produtos) {
    // Filtro de busca
    document.getElementById('produto-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.produto-item').forEach(el => {
        el.style.display = el.dataset.nome.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Alterar a quantidade diretamente na lista de produtos
    document.querySelectorAll('[data-product-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const produto = produtos.find(p => p.id === btn.dataset.id);
        if (!produto) return;
        const item = Carrinho.getItens().find(i => i.produtoId === produto.id);
        if (btn.dataset.productAction === 'inc') Carrinho.adicionar(produto);
        if (btn.dataset.productAction === 'dec') Carrinho.atualizarQty(produto.id, (item?.qty || 0) - 1);
        this._renderCarrinho();
      });
    });

    // Taxa / desconto
    ['pedido-taxa', 'pedido-desconto'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        Carrinho
          .setTaxaEntrega(parseFloat(document.getElementById('pedido-taxa')?.value || 0))
          .setDesconto(parseFloat(document.getElementById('pedido-desconto')?.value || 0));
        this._renderCarrinho();
      });
    });

    // Frete automático ao selecionar cliente
    document.getElementById('pedido-cliente')?.addEventListener('change', e => {
      this._calcularFreteCliente(e.target.value);
    });

    document.getElementById('pedido-tipo-horario')?.addEventListener('change', e => {
      const group = document.getElementById('pedido-agendamento-group');
      const input = document.getElementById('pedido-agendado-para');
      const scheduled = e.target.value === 'agendado';
      group?.classList.toggle('hidden', !scheduled);
      if (input) {
        input.required = scheduled;
        if (scheduled && !input.value) {
          const soon = new Date(Date.now() + 60 * 60 * 1000);
          soon.setMinutes(Math.ceil(soon.getMinutes() / 15) * 15, 0, 0);
          input.value = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
      }
    });
  },

  async _calcularFreteCliente(clienteId) {
    if (!clienteId || typeof FreteService === 'undefined') return;
    const clientes = this._clientes();
    const cliente  = clientes.find(c => c.id === clienteId);
    const cep      = cliente?.enderecos?.[0]?.cep;
    const infoEl   = document.getElementById('frete-info');
    const taxaEl   = document.getElementById('pedido-taxa');
    if (!cep) {
      if (infoEl) infoEl.textContent = '';
      return;
    }
    if (infoEl) infoEl.textContent = 'Calculando frete…';
    try {
      const resultado = await FreteService.calcularFreteComEndereco(cep);
      if (taxaEl) {
        taxaEl.value = resultado.valor;
        Carrinho.setTaxaEntrega(resultado.valor);
        this._renderCarrinho();
      }
      if (infoEl) {
        const loc = [resultado.bairro, resultado.cidade, resultado.uf].filter(Boolean).join(', ');
        infoEl.textContent = `Frete calculado para ${loc || cep} — R$ ${resultado.valor.toFixed(2)}`;
      }
    } catch {
      if (infoEl) infoEl.textContent = 'Não foi possível calcular o frete.';
    }
  },

  _renderCarrinho() {
    const itensEl  = document.getElementById('carrinho-itens');
    const totaisEl = document.getElementById('carrinho-totais');
    if (!itensEl) return;

    const itens = Carrinho.getItens();
    this._syncProductQuantities(itens);

    if (!itens.length) {
      itensEl.innerHTML  = '<p class="carrinho-vazio">Carrinho vazio — adicione produtos à esquerda.</p>';
      if (totaisEl) totaisEl.innerHTML = '';
      return;
    }

    itensEl.innerHTML = itens.map(i => `
      <div class="carrinho-item">
        <span class="carrinho-item__nome">${Utils.escapeHtml(i.nome)}</span>
        <div class="carrinho-item__controls">
          <button type="button" class="btn-icon" data-ca="dec" data-id="${i.produtoId}">−</button>
          <span class="carrinho-item__qty">${i.qty}</span>
          <button type="button" class="btn-icon" data-ca="inc" data-id="${i.produtoId}">+</button>
          <span class="carrinho-item__preco">${Utils.currency(i.subtotal)}</span>
          <button type="button" class="btn-icon btn-icon--danger" data-ca="rm" data-id="${i.produtoId}">✕</button>
        </div>
      </div>`).join('');

    if (totaisEl) {
      totaisEl.innerHTML = `
        <div class="totais-row"><span>Subtotal</span><span>${Utils.currency(Carrinho.calcSubtotal())}</span></div>
        <div class="totais-row"><span>Entrega</span><span>${Utils.currency(Carrinho.getTaxa())}</span></div>
        <div class="totais-row"><span>Desconto</span><span>-${Utils.currency(Carrinho.getDesconto())}</span></div>
        <div class="totais-row totais-row--total"><span>Total</span><strong>${Utils.currency(Carrinho.calcTotal())}</strong></div>`;
    }

    // Bind controles do carrinho
    itensEl.querySelectorAll('[data-ca]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { ca, id } = btn.dataset;
        const item = Carrinho.getItens().find(i => i.produtoId === id);
        if (ca === 'inc') Carrinho.atualizarQty(id, (item?.qty || 0) + 1);
        if (ca === 'dec') Carrinho.atualizarQty(id, (item?.qty || 1) - 1);
        if (ca === 'rm')  Carrinho.remover(id);
        this._renderCarrinho();
      });
    });
  },

  _syncProductQuantities(itens = Carrinho.getItens()) {
    const quantities = new Map(itens.map(item => [item.produtoId, item.qty]));
    document.querySelectorAll('.produto-item').forEach(row => {
      const qty = quantities.get(row.dataset.id) || 0;
      const output = row.querySelector('[data-product-qty]');
      const minus = row.querySelector('[data-product-action="dec"]');
      if (output) output.textContent = String(qty);
      if (minus) minus.disabled = qty === 0;
      row.classList.toggle('produto-item--selected', qty > 0);
    });
  },

  async _criarPedido() {
    if (Carrinho.isEmpty()) {
      UI.toast('Adicione pelo menos um item ao pedido.', 'warning');
      return;
    }

    const clienteSel  = document.getElementById('pedido-cliente');
    const clienteId   = clienteSel?.value || '';
    const clienteNome = clienteId
      ? (clienteSel?.selectedOptions[0]?.text || 'Cliente')
      : 'Balcão';

    const origem = document.getElementById('pedido-origem')?.value || 'Balcão';
    const forma  = document.getElementById('pedido-forma')?.value  || 'Dinheiro';
    const obs    = document.getElementById('pedido-obs')?.value?.trim() || '';
    const isScheduled = document.getElementById('pedido-tipo-horario')?.value === 'agendado';
    const scheduledValue = document.getElementById('pedido-agendado-para')?.value || '';
    const scheduledDate = scheduledValue ? new Date(scheduledValue) : null;
    const agendadoPara = isScheduled && scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.toISOString() : null;
    if (isScheduled && (!agendadoPara || scheduledDate <= new Date())) {
      UI.toast('Escolha um horário futuro para o pedido.', 'warning');
      return;
    }

    const taxa   = parseFloat(document.getElementById('pedido-taxa')?.value || 0);
    const desc   = parseFloat(document.getElementById('pedido-desconto')?.value || 0);
    Carrinho.setTaxaEntrega(taxa).setDesconto(desc);

    if (this._serverMode) {
      try {
        const created = await API.createServerOrder({
          clientId: clienteId || null,
          clientName: clienteNome,
          source: origem,
          paymentMethod: forma,
          notes: obs,
          deliveryFee: taxa,
          discount: desc,
          items: Carrinho.getItens().map(item => ({
            productId: item.produtoId,
            quantity: item.qty,
            options: item.options || {},
          })),
        });
        this._serverOrders.unshift(this._mapServerOrder(created));
        Carrinho.limpar();
        UI.closeModal();
        UI.toast(`Pedido #${created.orderNumber} criado!`, 'success');
        this._render();
      } catch (error) {
        const message = error.code === 'invalid_discount'
          ? 'O desconto não pode superar o valor do pedido.'
          : error.code === 'product_unavailable' || error.code === 'insufficient_stock'
            ? 'Um produto está indisponível ou sem estoque.'
            : 'Não foi possível criar o pedido.';
        UI.toast(message, 'danger');
      }
      return;
    }

    const pedidos   = this._pedidos();
    const num       = nextNumeroPedido(pedidos);
    const orderData = Carrinho.toOrderData();

    const pedido = {
      id:              `ped-${Utils.uid()}`,
      numeroPedido:    num,
      origem,
      clienteId:       clienteId || null,
      clienteNome,
      status:          'Novo',
      itens:           orderData.itens,
      subtotal:        orderData.subtotal,
      taxaEntrega:     orderData.taxaEntrega,
      desconto:        orderData.desconto,
      total:           orderData.total,
      formaPagamento:  forma,
      observacoes:     obs,
      agendadoPara,
      dataCriacao:     new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
    };

    // Verificação de estoque (não bloqueia, apenas avisa)
    const disp = EstoqueService.verificarDisponibilidade(pedido.itens);
    if (!disp.disponivel) {
      const nomes = disp.erros.map(e => e.ingrediente).join(', ');
      if (!confirm(`Estoque insuficiente para: ${nomes}.\nCriar pedido mesmo assim?`)) return;
    }

    pedidos.unshift(pedido);
    Stores.pedidos.set(pedidos);

    EstoqueService.reservarEstoque(pedido.id, pedido.itens);
    EventBus.emit(EVENTS.PEDIDO_CRIADO, { pedido });

    Carrinho.limpar();
    UI.closeModal();
    UI.toast(`Pedido #${num} criado!`, 'success');
    this._render();
  },
};
