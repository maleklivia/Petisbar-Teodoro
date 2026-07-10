/* ============================================================
   Distrito OS — ComprasModule
   Pedidos de compra: criação, aprovação, recebimento.
   Ao receber: atualiza estoque + custo + registra despesa.
   Gera automaticamente pedidos para ingredientes críticos.
   ============================================================ */

const ComprasModule = {
  _tab: 'compras',
  _filtroStatus: 'todos',

  init() {
    this._gerarSolicitacoesAutomaticas();
    this._render();
    this._bindEvents();
  },

  _render() {
    const el = document.getElementById('compras-content');
    if (!el) return;
    const compras = Stores.compras.get();
    const pendentes = compras.filter(c => ['Rascunho', 'Aprovado'].includes(c.status)).length;
    const totalMes  = compras.filter(c => c.status === 'Recebido' && (c.dataRecebimento || '').startsWith(Utils.currentMonth())).reduce((s, c) => s + (c.total || 0), 0);

    el.innerHTML = `
      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card ${pendentes > 0 ? 'kpi-card--warn' : 'kpi-card--ok'}">
          <span class="kpi-card__label">Pendentes</span>
          <strong class="kpi-card__value">${pendentes}</strong>
          <small class="kpi-card__sub">aguardando ação</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Compras no Mês</span>
          <strong class="kpi-card__value">${compras.filter(c => c.status === 'Recebido' && (c.dataRecebimento || '').startsWith(Utils.currentMonth())).length}</strong>
          <small class="kpi-card__sub">pedidos recebidos</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Gasto no Mês</span>
          <strong class="kpi-card__value">${Utils.currency(totalMes)}</strong>
          <small class="kpi-card__sub">em compras</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Total Pedidos</span>
          <strong class="kpi-card__value">${compras.length}</strong>
          <small class="kpi-card__sub">registrados</small>
        </article>
      </div>

      <div class="module-tabs">
        <button class="tab-btn ${this._tab === 'compras' ? 'active' : ''}" data-cmp-tab="compras">
          Pedidos de Compra ${pendentes > 0 ? `<span class="count-badge">${pendentes}</span>` : ''}
        </button>
        <button class="tab-btn ${this._tab === 'historico' ? 'active' : ''}" data-cmp-tab="historico">Histórico</button>
      </div>

      <div id="cmp-tab-body">
        ${this._renderTab(compras)}
      </div>
    `;
  },

  _renderTab(compras) {
    if (this._tab === 'historico') return this._renderHistorico(compras);
    return this._renderCompras(compras);
  },

  _renderCompras(compras) {
    let data = compras.filter(c => c.status !== 'Recebido' && c.status !== 'Cancelado');
    if (this._filtroStatus !== 'todos') data = data.filter(c => c.status === this._filtroStatus);

    return `
      <div class="module-toolbar">
        <select class="form-input toolbar-filter" id="cmp-status-filter">
          <option value="todos" ${this._filtroStatus === 'todos' ? 'selected' : ''}>Todos os status</option>
          ${STATUS_COMPRA.slice(0,-1).map(s => `<option value="${s}" ${this._filtroStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span style="flex:1"></span>
        <button class="btn btn-ghost" id="btn-gerar-automatico">⚡ Gerar Automático</button>
        <button class="btn btn-primary" id="btn-nova-compra">+ Nova Compra</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        ${data.length ? data.map(c => this._cardCompra(c)).join('') :
          '<div class="empty-state"><p>Nenhum pedido pendente.</p></div>'}
      </div>
    `;
  },

  _renderHistorico(compras) {
    const data = [...compras].filter(c => c.status === 'Recebido' || c.status === 'Cancelado').sort((a, b) => (b.dataCompra || '').localeCompare(a.dataCompra || ''));
    return `
      <div class="table-wrap" style="margin-top:var(--sp-2)">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Fornecedor</th><th>Data</th><th>Tipo</th><th>Itens</th><th style="text-align:right">Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(c => `
              <tr>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">#${c.numeroPedidoCompra}</td>
                <td style="font-weight:600">${Utils.escapeHtml(c.fornecedorNome)}</td>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.formatShortDate(c.dataCompra)}</td>
                <td><span class="badge ${c.tipo === 'automatico' ? 'badge-gold' : 'badge-neutral'}">${c.tipo}</span></td>
                <td style="font-size:var(--text-sm)">${c.itens.length} item(ns)</td>
                <td style="text-align:right;font-weight:700">${Utils.currency(c.total)}</td>
                <td><span class="badge ${c.status === 'Recebido' ? 'badge-success' : 'badge-danger'}">${c.status}</span></td>
              </tr>
            `).join('') :
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Sem histórico ainda.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _cardCompra(c) {
    const statusColor = { Rascunho: 'badge-neutral', Aprovado: 'badge-gold', Pedido: 'badge-warning' };
    const acoes = {
      Rascunho: `<button class="btn btn-ghost" data-cmp-action="aprovar" data-cmp-id="${c.id}">Aprovar</button> <button class="btn btn-ghost" data-cmp-action="cancelar" data-cmp-id="${c.id}">Cancelar</button>`,
      Aprovado: `<button class="btn btn-primary" data-cmp-action="pedido" data-cmp-id="${c.id}">Marcar como Pedido</button> <button class="btn btn-ghost" data-cmp-action="cancelar" data-cmp-id="${c.id}">Cancelar</button>`,
      Pedido:   `<button class="btn btn-primary" data-cmp-action="receber" data-cmp-id="${c.id}">Confirmar Recebimento</button>`,
    };

    return `
      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-4) var(--sp-5)">
        <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-3)">
          <span style="font-weight:700">#${c.numeroPedidoCompra} — ${Utils.escapeHtml(c.fornecedorNome)}</span>
          <span class="badge ${statusColor[c.status] || 'badge-neutral'}">${c.status}</span>
          ${c.tipo === 'automatico' ? '<span class="badge badge-gold">⚡ automático</span>' : ''}
          <span style="flex:1"></span>
          <span style="font-weight:700;font-size:var(--text-lg)">${Utils.currency(c.total)}</span>
        </div>
        <div style="margin-bottom:var(--sp-3)">
          ${c.itens.map(i => `
            <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);padding:4px 0;border-bottom:1px solid var(--border-subtle)">
              <span>${Utils.escapeHtml(i.nome)}</span>
              <span style="color:var(--text-muted)">${i.quantidade} ${i.unidade} × ${Utils.currency(i.custoUnitario)} = <strong>${Utils.currency(i.subtotal)}</strong></span>
            </div>
          `).join('')}
        </div>
        ${c.observacoes ? `<p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--sp-3)">${Utils.escapeHtml(c.observacoes)}</p>` : ''}
        <div style="display:flex;gap:var(--sp-2)">
          ${acoes[c.status] || ''}
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('compras-content');
    if (!el) return;

    el.addEventListener('click', e => {
      const tab = e.target.closest('[data-cmp-tab]');
      if (tab) { this._tab = tab.dataset.cmpTab; this._render(); this._bindEvents(); return; }

      if (e.target.closest('#btn-nova-compra'))      { this._abrirModalNovaCompra(); return; }
      if (e.target.closest('#btn-gerar-automatico')) { this._gerarSolicitacoesAutomaticas(true); this._render(); this._bindEvents(); return; }

      const action = e.target.closest('[data-cmp-action]');
      if (action) { this._executarAcao(action.dataset.cmpId, action.dataset.cmpAction); return; }
    });

    el.addEventListener('change', e => {
      if (e.target.id === 'cmp-status-filter') { this._filtroStatus = e.target.value; this._render(); this._bindEvents(); }
    });
  },

  _executarAcao(id, action) {
    const compras = Stores.compras.get();
    const compra  = compras.find(c => c.id === id);
    if (!compra) return;

    if (action === 'aprovar')  compra.status = 'Aprovado';
    if (action === 'pedido')   compra.status = 'Pedido';
    if (action === 'cancelar') { if (!confirm('Cancelar este pedido?')) return; compra.status = 'Cancelado'; }
    if (action === 'receber')  { this._confirmarRecebimento(compra); return; }

    Stores.compras.set(compras);
    this._render();
    this._bindEvents();
  },

  _confirmarRecebimento(compra) {
    compra.status = 'Recebido';
    compra.dataRecebimento = new Date().toISOString().slice(0, 10);

    // Atualiza estoque e custo de cada ingrediente
    const ings = Stores.ingredientes.get();
    const movs = Stores.movimentacoes.get();
    for (const item of compra.itens) {
      const ing = ings.find(i => i.id === item.ingredienteId);
      if (ing) {
        ing.estoqueAtual += item.quantidade;
        ing.custoUnitario = item.custoUnitario; // Atualiza custo
      }
      const maxMovId = movs.reduce((m, v) => Math.max(m, parseInt(v.id?.replace('mov-', '') || 0)), 0);
      movs.unshift({ id: `mov-${String(maxMovId + 1).padStart(3, '0')}`, tipo: 'entrada', ingredienteId: item.ingredienteId, ingredienteNome: item.nome, quantidade: item.quantidade, unidade: item.unidade, motivo: 'compra', referencia: compra.id, data: compra.dataRecebimento, usuario: 'admin' });
    }
    Stores.ingredientes.set(ings);
    Stores.movimentacoes.set(movs);

    // Recalcula CMV de fichas técnicas vinculadas
    this._recalcularCMV(ings);

    // Registra despesa no financeiro
    const state = Storage.getState();
    const maxId = state.finance.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0);
    state.finance.unshift({ id: maxId + 1, date: compra.dataRecebimento, description: `Compra #${compra.numeroPedidoCompra} · ${compra.fornecedorNome}`, category: 'Fornecedores', type: 'Saída', value: -compra.total });
    Storage.setState(state);

    const compras = Stores.compras.get();
    const idx = compras.findIndex(c => c.id === compra.id);
    if (idx >= 0) compras[idx] = compra;
    Stores.compras.set(compras);

    if (typeof EventBus !== 'undefined') EventBus.emit('compra.recebida', { compraId: compra.id, fornecedor: compra.fornecedorNome, total: compra.total });
    UI.toast(`Compra #${compra.numeroPedidoCompra} recebida! Estoque e financeiro atualizados.`, 'success');
    this._render();
    this._bindEvents();
  },

  _recalcularCMV(ings) {
    // Quando o custo de um ingrediente muda, recalcula o custo de produção de produtos vinculados
    if (typeof Stores === 'undefined') return;
    // Fichas técnicas: custo é calculado em tempo real no FichasModule via calcIngredienteCost
    // Aqui apenas emitimos o evento para quem quiser reagir
    if (typeof EventBus !== 'undefined') EventBus.emit('estoque.custoAtualizado', { ingredientes: ings.length });
  },

  _gerarSolicitacoesAutomaticas(mostrarFeedback = false) {
    const ings    = Stores.ingredientes.get();
    const criticos = ings.filter(i => i.ativo && i.estoqueAtual <= i.estoqueMinimo);
    if (!criticos.length) {
      if (mostrarFeedback) UI.toast('Nenhum ingrediente abaixo do mínimo.', 'success');
      return;
    }

    const compras = Stores.compras.get();
    const pendentes = compras.filter(c => c.status !== 'Recebido' && c.status !== 'Cancelado');
    let gerados = 0;

    for (const ing of criticos) {
      const jaExiste = pendentes.some(p => p.itens.some(i => i.ingredienteId === ing.id));
      if (jaExiste) continue;

      const fornecedores = Stores.fornecedores.get();
      const forn = fornecedores.find(f => f.nome === ing.fornecedor) || fornecedores[0];
      const maxNum = compras.reduce((m, c) => Math.max(m, c.numeroPedidoCompra || 0), 0);
      const qtdSugerida = Math.max(ing.estoqueMinimo * 2 - ing.estoqueAtual, ing.estoqueMinimo);

      compras.unshift({
        id: `cmp-auto-${Date.now()}-${ing.id}`,
        numeroPedidoCompra: maxNum + 1 + gerados,
        fornecedorId: forn?.id || '',
        fornecedorNome: forn?.nome || ing.fornecedor || 'A definir',
        status: 'Rascunho',
        tipo: 'automatico',
        itens: [{ ingredienteId: ing.id, nome: ing.nome, quantidade: qtdSugerida, unidade: ing.unidade, custoUnitario: ing.custoUnitario, subtotal: qtdSugerida * ing.custoUnitario }],
        total: qtdSugerida * ing.custoUnitario,
        observacoes: `Gerado automaticamente — estoque crítico (${ing.estoqueAtual} ${ing.unidade})`,
        dataCompra: new Date().toISOString().slice(0, 10),
        dataRecebimento: '',
        notaFiscal: '',
        formaPagamento: forn?.condicoesPagamento || 'À vista',
      });
      gerados++;
    }

    if (gerados > 0) {
      Stores.compras.set(compras);
      if (mostrarFeedback) UI.toast(`${gerados} solicitação(ões) gerada(s) automaticamente.`, 'success');
    } else if (mostrarFeedback) {
      UI.toast('Todas as solicitações já foram criadas.', 'success');
    }
  },

  _abrirModalNovaCompra() {
    const fornecedores = Stores.fornecedores.get().filter(f => f.ativo);
    const ings = Stores.ingredientes.get().filter(i => i.ativo);
    let itens  = [];

    const renderItens = () => {
      const cont = document.getElementById('cmp-itens');
      if (!cont) return;
      cont.innerHTML = itens.map((it, idx) => `
        <div style="display:grid;grid-template-columns:1fr 80px 60px 90px 28px;gap:6px;align-items:center;margin-bottom:6px">
          <select class="form-input" data-cmp-it-ing="${idx}">
            ${ings.map(i => `<option value="${i.id}" ${i.id === it.ingredienteId ? 'selected' : ''}>${Utils.escapeHtml(i.nome)}</option>`).join('')}
          </select>
          <input type="number" class="form-input" data-cmp-it-qty="${idx}" min="0.001" step="0.001" value="${it.quantidade}" placeholder="Qtd">
          <input type="text" class="form-input" data-cmp-it-un="${idx}" value="${it.unidade}" placeholder="un">
          <input type="number" class="form-input" data-cmp-it-custo="${idx}" min="0" step="0.01" value="${it.custoUnitario}" placeholder="R$/un">
          <button class="btn-icon btn-icon--danger" data-cmp-it-del="${idx}" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      `).join('') + `<button class="btn btn-ghost" id="cmp-add-item" type="button" style="font-size:var(--text-sm)">+ Adicionar item</button>`;

      cont.querySelectorAll('[data-cmp-it-ing]').forEach(sel => {
        sel.addEventListener('change', e => {
          const idx = parseInt(e.target.dataset.cmpItIng);
          const ing = ings.find(i => i.id === e.target.value);
          if (ing) { itens[idx].ingredienteId = ing.id; itens[idx].unidade = ing.unidade; itens[idx].custoUnitario = ing.custoUnitario; renderItens(); }
        });
      });
      cont.querySelectorAll('[data-cmp-it-qty]').forEach(el => el.addEventListener('input', e => { itens[parseInt(e.target.dataset.cmpItQty)].quantidade = parseFloat(e.target.value) || 0; }));
      cont.querySelectorAll('[data-cmp-it-un]').forEach(el => el.addEventListener('input', e => { itens[parseInt(e.target.dataset.cmpItUn)].unidade = e.target.value; }));
      cont.querySelectorAll('[data-cmp-it-custo]').forEach(el => el.addEventListener('input', e => { itens[parseInt(e.target.dataset.cmpItCusto)].custoUnitario = parseFloat(e.target.value) || 0; }));
      cont.querySelectorAll('[data-cmp-it-del]').forEach(btn => btn.addEventListener('click', e => { itens.splice(parseInt(e.target.closest('[data-cmp-it-del]').dataset.cmpItDel), 1); renderItens(); }));
      const addBtn = cont.querySelector('#cmp-add-item');
      if (addBtn) addBtn.addEventListener('click', () => { const i = ings[0]; itens.push({ ingredienteId: i.id, nome: i.nome, quantidade: 1, unidade: i.unidade, custoUnitario: i.custoUnitario }); renderItens(); });
    };

    UI.openModal({
      title: 'Nova Compra',
      size: 'wide',
      body: `
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Fornecedor</label>
            <select class="form-input" id="cmp-forn">
              ${fornecedores.map(f => `<option value="${f.id}">${Utils.escapeHtml(f.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data</label>
            <input type="date" class="form-input" id="cmp-data" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Pagamento</label>
            <input type="text" class="form-input" id="cmp-pgto" placeholder="À vista, 30 dias…">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Itens da Compra</label>
          <div id="cmp-itens"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <input type="text" class="form-input" id="cmp-obs" placeholder="Opcional">
        </div>
      `,
      confirmLabel: 'Criar Pedido',
      onConfirm: () => {
        const fornId   = document.getElementById('cmp-forn')?.value;
        const data     = document.getElementById('cmp-data')?.value;
        const pgto     = document.getElementById('cmp-pgto')?.value?.trim();
        const obs      = document.getElementById('cmp-obs')?.value?.trim();
        const forn     = fornecedores.find(f => f.id === fornId);

        if (!itens.length) { UI.toast('Adicione pelo menos um item.', 'error'); return; }

        // Calculate subtotals and total
        const itensFinal = itens.map(it => {
          const ing = ings.find(i => i.id === it.ingredienteId);
          const sub = it.quantidade * it.custoUnitario;
          return { ...it, nome: ing?.nome || '?', subtotal: sub };
        });
        const total = itensFinal.reduce((s, i) => s + i.subtotal, 0);

        const compras = Stores.compras.get();
        const maxNum  = compras.reduce((m, c) => Math.max(m, c.numeroPedidoCompra || 0), 0);
        compras.unshift({ id: `cmp-${Date.now()}`, numeroPedidoCompra: maxNum + 1, fornecedorId: fornId, fornecedorNome: forn?.nome || 'Desconhecido', status: 'Aprovado', tipo: 'manual', itens: itensFinal, total, observacoes: obs, dataCompra: data, dataRecebimento: '', notaFiscal: '', formaPagamento: pgto });
        Stores.compras.set(compras);
        UI.toast('Pedido de compra criado!', 'success');
        this._render();
        this._bindEvents();
      },
    });

    // Start with one empty item
    if (ings.length) { itens = [{ ingredienteId: ings[0].id, nome: ings[0].nome, quantidade: 1, unidade: ings[0].unidade, custoUnitario: ings[0].custoUnitario }]; }
    setTimeout(() => renderItens(), 50);
  },
};
