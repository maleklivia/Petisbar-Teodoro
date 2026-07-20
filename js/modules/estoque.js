/* ============================================================
   Petisbar Teodoro — EstoqueModule
   Gestão de estoque de ingredientes: visualização, movimentações
   manuais (entrada, saída, ajuste), histórico e alertas.
   ============================================================ */

const EstoqueModule = {
  _tab: 'ingredientes',
  _busca: '',
  _filtroStatus: 'todos',

  init() {
    this._render();
    this._bindEvents();
    this._verificarAlertasAutomaticos();
  },

  _render() {
    const el = document.getElementById('estoque-content');
    if (!el) return;
    const ings = Stores.ingredientes.get();
    const criticos = ings.filter(i => i.estoqueAtual <= i.estoqueMinimo && i.ativo).length;
    const valorTotal = ings.filter(i => i.ativo).reduce((s, i) => s + (i.estoqueAtual * i.custoUnitario), 0);

    el.innerHTML = `
      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card ${criticos > 0 ? 'kpi-card--warn' : 'kpi-card--ok'}">
          <span class="kpi-card__label">Alertas</span>
          <strong class="kpi-card__value">${criticos}</strong>
          <small class="kpi-card__sub">${criticos > 0 ? 'abaixo do mínimo' : 'tudo ok'}</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Ingredientes</span>
          <strong class="kpi-card__value">${ings.filter(i => i.ativo).length}</strong>
          <small class="kpi-card__sub">cadastrados</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Valor em Estoque</span>
          <strong class="kpi-card__value">${Utils.currency(valorTotal)}</strong>
          <small class="kpi-card__sub">custo total</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Movimentações</span>
          <strong class="kpi-card__value">${Stores.movimentacoes.get().length}</strong>
          <small class="kpi-card__sub">registradas</small>
        </article>
      </div>

      <div class="module-tabs">
        <button class="tab-btn ${this._tab === 'ingredientes' ? 'active' : ''}" data-est-tab="ingredientes">Ingredientes</button>
        <button class="tab-btn ${this._tab === 'movimentacoes' ? 'active' : ''}" data-est-tab="movimentacoes">Movimentações</button>
        <button class="tab-btn ${this._tab === 'alertas' ? 'active' : ''}" data-est-tab="alertas">
          Alertas ${criticos > 0 ? `<span class="count-badge">${criticos}</span>` : ''}
        </button>
      </div>

      <div id="est-tab-body">
        ${this._renderTab(ings)}
      </div>
    `;
  },

  _renderTab(ings) {
    if (this._tab === 'movimentacoes') return this._renderMovimentacoes();
    if (this._tab === 'alertas')       return this._renderAlertas(ings);
    return this._renderIngredientes(ings);
  },

  _renderIngredientes(ings) {
    let data = ings.filter(i => i.ativo);
    if (this._busca) {
      const b = this._busca.toLowerCase();
      data = data.filter(i => i.nome.toLowerCase().includes(b) || i.categoria.toLowerCase().includes(b));
    }
    if (this._filtroStatus === 'critico') data = data.filter(i => i.estoqueAtual <= i.estoqueMinimo);
    if (this._filtroStatus === 'ok')      data = data.filter(i => i.estoqueAtual > i.estoqueMinimo);

    return `
      <div class="module-toolbar">
        <input type="text" class="form-input toolbar-search" id="est-busca" placeholder="Buscar ingrediente…" value="${Utils.escapeHtml(this._busca)}">
        <select class="form-input toolbar-filter" id="est-status">
          <option value="todos" ${this._filtroStatus === 'todos' ? 'selected' : ''}>Todos</option>
          <option value="critico" ${this._filtroStatus === 'critico' ? 'selected' : ''}>Abaixo do mínimo</option>
          <option value="ok" ${this._filtroStatus === 'ok' ? 'selected' : ''}>OK</option>
        </select>
        <button class="btn btn-primary" id="btn-movimentacao">+ Movimentação</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Categoria</th>
              <th style="text-align:right">Estoque Atual</th>
              <th style="text-align:right">Mínimo</th>
              <th style="text-align:right">Custo Unit.</th>
              <th style="text-align:right">Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.length ? data.map(i => this._rowIng(i)).join('') :
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum ingrediente encontrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _rowIng(i) {
    const critico = i.estoqueAtual <= i.estoqueMinimo;
    const pct     = i.estoqueMinimo > 0 ? Math.min(100, (i.estoqueAtual / (i.estoqueMinimo * 2)) * 100) : 100;
    const barColor = critico ? 'var(--color-danger)' : 'var(--color-success)';
    return `
      <tr class="${critico ? 'row--alert' : ''}">
        <td style="font-weight:600">${Utils.escapeHtml(i.nome)}</td>
        <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.escapeHtml(i.categoria)}</td>
        <td style="text-align:right;font-weight:700;color:${critico ? 'var(--color-danger)' : 'var(--text-primary)'}">
          ${i.estoqueAtual} ${i.unidade}
          <div style="margin-top:4px;height:3px;background:var(--bg-raised);border-radius:2px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px"></div>
          </div>
        </td>
        <td style="text-align:right;color:var(--text-muted)">${i.estoqueMinimo} ${i.unidade}</td>
        <td style="text-align:right;color:var(--text-muted);font-size:var(--text-sm)">${Utils.currency(i.custoUnitario)}/${i.unidade}</td>
        <td style="text-align:right;font-size:var(--text-sm)">${Utils.currency(i.estoqueAtual * i.custoUnitario)}</td>
        <td>
          ${critico
            ? '<span class="badge badge-danger">Crítico</span>'
            : '<span class="badge badge-success">OK</span>'}
        </td>
      </tr>
    `;
  },

  _renderMovimentacoes() {
    const movs = [...Stores.movimentacoes.get()].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tipoColor = { entrada: 'var(--color-success)', saída: 'var(--color-danger)', ajuste: 'var(--color-warning)', perda: 'var(--color-danger)' };

    return `
      <div class="module-toolbar">
        <span style="flex:1"></span>
        <button class="btn btn-primary" id="btn-movimentacao">+ Movimentação</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Ingrediente</th>
              <th style="text-align:right">Quantidade</th>
              <th>Motivo</th>
              <th>Referência</th>
              <th>Usuário</th>
            </tr>
          </thead>
          <tbody>
            ${movs.length ? movs.map(m => `
              <tr>
                <td style="white-space:nowrap;color:var(--text-muted);font-size:var(--text-sm)">${Utils.formatShortDate(m.data)}</td>
                <td><span style="font-weight:600;text-transform:capitalize;color:${tipoColor[m.tipo] || 'var(--text-primary)'}">${m.tipo}</span></td>
                <td style="font-weight:600">${Utils.escapeHtml(m.ingredienteNome)}</td>
                <td style="text-align:right">${m.tipo === 'saída' || m.tipo === 'perda' ? '−' : '+'}${m.quantidade} ${m.unidade}</td>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.escapeHtml(m.motivo)}</td>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.escapeHtml(m.referencia || '—')}</td>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.escapeHtml(m.usuario)}</td>
              </tr>
            `).join('') :
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Nenhuma movimentação registrada.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderAlertas(ings) {
    const criticos = ings.filter(i => i.ativo && i.estoqueAtual <= i.estoqueMinimo);
    if (!criticos.length) {
      return `<div class="empty-state" style="padding:48px 0"><p style="color:var(--color-success);font-weight:600">✓ Todos os ingredientes estão dentro do estoque mínimo.</p></div>`;
    }
    return `
      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        ${criticos.map(i => {
          const deficit = i.estoqueMinimo - i.estoqueAtual;
          return `
            <div style="background:var(--bg-surface);border:1px solid rgba(239,68,68,0.30);border-left:3px solid var(--color-danger);border-radius:var(--radius-lg);padding:var(--sp-4) var(--sp-5);display:flex;align-items:center;gap:var(--sp-4)">
              <span style="font-size:20px">⚠</span>
              <div style="flex:1">
                <div style="font-weight:700">${Utils.escapeHtml(i.nome)}</div>
                <div style="font-size:var(--text-sm);color:var(--text-muted)">${i.categoria} · Atual: <strong style="color:var(--color-danger)">${i.estoqueAtual} ${i.unidade}</strong> · Mínimo: ${i.estoqueMinimo} ${i.unidade} · Deficit: ${deficit.toFixed(2)} ${i.unidade}</div>
              </div>
              <button class="btn btn-primary" data-est-repor="${i.id}" style="font-size:var(--text-sm)">Repor Estoque</button>
            </div>
          `;
        }).join('')}
      </div>
      <p style="margin-top:var(--sp-4);color:var(--text-muted);font-size:var(--text-sm)">
        💡 Vá em <strong>Compras</strong> para gerar um pedido de compra automático para estes ingredientes.
      </p>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('estoque-content');
    if (!el) return;

    el.addEventListener('click', e => {
      const tab = e.target.closest('[data-est-tab]');
      if (tab) { this._tab = tab.dataset.estTab; this._render(); this._bindEvents(); return; }

      if (e.target.closest('#btn-movimentacao')) { this._abrirModalMovimentacao(); return; }

      const repor = e.target.closest('[data-est-repor]');
      if (repor) {
        this._abrirModalMovimentacao(repor.dataset.estRepor);
        return;
      }
    });

    const busca = el.querySelector('#est-busca');
    if (busca) busca.addEventListener('input', e => { this._busca = e.target.value; this._render(); this._bindEvents(); });

    const sel = el.querySelector('#est-status');
    if (sel) sel.addEventListener('change', e => { this._filtroStatus = e.target.value; this._render(); this._bindEvents(); });
  },

  _abrirModalMovimentacao(ingredienteId = '') {
    const ings = Stores.ingredientes.get().filter(i => i.ativo);
    const ing  = ingredienteId ? ings.find(i => i.id === ingredienteId) : null;

    UI.openModal({
      title: 'Movimentação de Estoque',
      body: `
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-input" id="mov-tipo">
            <option value="entrada">Entrada</option>
            <option value="saída">Saída</option>
            <option value="ajuste">Ajuste</option>
            <option value="perda">Perda</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ingrediente</label>
          <select class="form-input" id="mov-ing">
            ${ings.map(i => `<option value="${i.id}" ${i.id === ingredienteId ? 'selected' : ''}>${Utils.escapeHtml(i.nome)} (${i.estoqueAtual} ${i.unidade})</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Quantidade</label>
            <input type="number" class="form-input" id="mov-qty" min="0.001" step="0.001" placeholder="0" value="">
          </div>
          <div class="form-group">
            <label class="form-label">Unidade</label>
            <input type="text" class="form-input" id="mov-un" value="${ing ? ing.unidade : ''}" placeholder="kg, L, un…">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Motivo</label>
          <input type="text" class="form-input" id="mov-motivo" placeholder="Ex: compra, uso, vencimento…">
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" class="form-input" id="mov-data" value="${new Date().toISOString().slice(0,10)}">
        </div>
      `,
      confirmLabel: 'Registrar',
      onConfirm: () => this._registrarMovimentacao(),
    });

    if (ing) {
      const unEl = document.getElementById('mov-un');
      if (unEl) unEl.value = ing.unidade;
    }

    document.getElementById('mov-ing')?.addEventListener('change', e => {
      const sel = ings.find(i => i.id === e.target.value);
      if (sel) { const u = document.getElementById('mov-un'); if (u) u.value = sel.unidade; }
    });
  },

  _registrarMovimentacao() {
    const tipo   = document.getElementById('mov-tipo')?.value;
    const ingId  = document.getElementById('mov-ing')?.value;
    const qty    = parseFloat(document.getElementById('mov-qty')?.value || 0);
    const un     = document.getElementById('mov-un')?.value?.trim();
    const motivo = document.getElementById('mov-motivo')?.value?.trim() || tipo;
    const data   = document.getElementById('mov-data')?.value;

    if (!ingId || !qty || qty <= 0 || !data) { UI.toast('Preencha todos os campos.', 'error'); return; }

    const ings   = Stores.ingredientes.get();
    const ing    = ings.find(i => i.id === ingId);
    if (!ing) return;

    // Adjust stock
    if (tipo === 'entrada' || tipo === 'ajuste') ing.estoqueAtual += qty;
    else ing.estoqueAtual = Math.max(0, ing.estoqueAtual - qty);
    Stores.ingredientes.set(ings);

    // Register movement
    const movs = Stores.movimentacoes.get();
    const maxId = movs.reduce((m, v) => Math.max(m, parseInt(v.id?.replace('mov-', '') || 0)), 0);
    movs.unshift({ id: `mov-${String(maxId + 1).padStart(3, '0')}`, tipo, ingredienteId: ingId, ingredienteNome: ing.nome, quantidade: qty, unidade: un || ing.unidade, motivo, referencia: '', data, usuario: 'admin' });
    Stores.movimentacoes.set(movs);

    if (typeof EventBus !== 'undefined') EventBus.emit('estoque.movimentado', { tipo, ingredienteId: ingId, quantidade: qty });
    UI.toast(`Movimentação registrada: ${tipo} de ${qty} ${un} de ${ing.nome}.`, 'success');
    this._render();
    this._bindEvents();
  },

  _verificarAlertasAutomaticos() {
    const ings = Stores.ingredientes.get();
    const criticos = ings.filter(i => i.ativo && i.estoqueAtual <= i.estoqueMinimo);
    if (criticos.length > 0 && typeof EventBus !== 'undefined') {
      EventBus.emit('estoque.alertas', { ingredientes: criticos.map(i => i.nome) });
    }
  },
};
