/* ============================================================
   Petisbar Teodoro — FinanceiroModule
   Extrato, DRE e lançamentos manuais. Lê state.finance[] do
   Storage legado + escreve via FinanceiroService quando possível.
   ============================================================ */

const FinanceiroModule = {
  _tab: 'extrato',
  _filtroTipo: 'todos',
  _filtroCategoria: 'todos',

  init() {
    this._render();
    this._bindEvents();
  },

  _getFinance() {
    return Storage.getState().finance || [];
  },

  _kpis(finance) {
    const mes = Utils.currentMonth();
    const d   = finance.filter(f => (f.date || '').startsWith(mes));
    const rec = d.filter(f => f.type === 'Entrada').reduce((s, f) => s + (f.value || 0), 0);
    const des = d.filter(f => f.type === 'Saída').reduce((s, f) => s + Math.abs(f.value || 0), 0);
    const cmv = d.filter(f => f.category === 'CMV').reduce((s, f) => s + Math.abs(f.value || 0), 0);
    return { rec, des, lucro: rec - des, cmvPct: rec > 0 ? ((cmv / rec) * 100).toFixed(1) : '0.0' };
  },

  _render() {
    const el = document.getElementById('financeiro-content');
    if (!el) return;
    const finance = this._getFinance();
    const { rec, des, lucro, cmvPct } = this._kpis(finance);

    el.innerHTML = `
      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card">
          <span class="kpi-card__label">Faturamento</span>
          <strong class="kpi-card__value">${Utils.currency(rec)}</strong>
          <small class="kpi-card__sub">este mês</small>
        </article>
        <article class="kpi-card ${des > rec ? 'kpi-card--warn' : ''}">
          <span class="kpi-card__label">Despesas</span>
          <strong class="kpi-card__value">${Utils.currency(des)}</strong>
          <small class="kpi-card__sub">este mês</small>
        </article>
        <article class="kpi-card ${lucro < 0 ? 'kpi-card--warn' : 'kpi-card--ok'}">
          <span class="kpi-card__label">Lucro Est.</span>
          <strong class="kpi-card__value">${Utils.currency(lucro)}</strong>
          <small class="kpi-card__sub">${Utils.pct(rec > 0 ? lucro / rec : 0)} margem</small>
        </article>
        <article class="kpi-card ${parseFloat(cmvPct) > 35 ? 'kpi-card--warn' : 'kpi-card--ok'}">
          <span class="kpi-card__label">CMV</span>
          <strong class="kpi-card__value">${cmvPct}%</strong>
          <small class="kpi-card__sub">meta 35%</small>
        </article>
      </div>

      <div class="module-tabs">
        <button class="tab-btn ${this._tab === 'extrato' ? 'active' : ''}" data-fin-tab="extrato">Extrato</button>
        <button class="tab-btn ${this._tab === 'dre' ? 'active' : ''}" data-fin-tab="dre">DRE</button>
        <button class="tab-btn ${this._tab === 'lancamento' ? 'active' : ''}" data-fin-tab="lancamento">+ Lançamento</button>
      </div>

      <div id="fin-tab-body">
        ${this._renderTab(finance)}
      </div>
    `;
  },

  _renderTab(finance) {
    if (this._tab === 'dre')        return this._renderDRE(finance);
    if (this._tab === 'lancamento') return this._renderForm();
    return this._renderExtrato(finance);
  },

  _renderExtrato(finance) {
    let data = [...finance].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (this._filtroTipo !== 'todos')      data = data.filter(f => f.type === this._filtroTipo);
    if (this._filtroCategoria !== 'todos') data = data.filter(f => f.category === this._filtroCategoria);
    const cats = [...new Set(finance.map(f => f.category))].sort();

    return `
      <div class="module-toolbar">
        <select class="form-input toolbar-filter" id="fin-tipo">
          <option value="todos" ${this._filtroTipo === 'todos' ? 'selected' : ''}>Todos os tipos</option>
          <option value="Entrada" ${this._filtroTipo === 'Entrada' ? 'selected' : ''}>Entradas</option>
          <option value="Saída" ${this._filtroTipo === 'Saída' ? 'selected' : ''}>Saídas</option>
        </select>
        <select class="form-input toolbar-filter" id="fin-cat">
          <option value="todos">Todas as categorias</option>
          ${cats.map(c => `<option value="${c}" ${this._filtroCategoria === c ? 'selected' : ''}>${Utils.escapeHtml(c)}</option>`).join('')}
        </select>
        <span style="flex:1"></span>
        <button class="btn btn-primary" data-fin-tab="lancamento">+ Lançamento</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th style="text-align:right">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length ? data.map(f => this._row(f)).join('') :
              '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum lançamento encontrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _row(f) {
    const pos   = f.type === 'Entrada';
    const color = pos ? 'var(--color-success)' : 'var(--color-danger)';
    return `
      <tr>
        <td style="white-space:nowrap;color:var(--text-muted);font-size:var(--text-sm)">${Utils.formatShortDate(f.date)}</td>
        <td>${Utils.escapeHtml(f.description || '—')}</td>
        <td><span class="badge badge-neutral">${Utils.escapeHtml(f.category || '—')}</span></td>
        <td><span style="font-size:var(--text-xs);font-weight:600;color:${color}">${f.type}</span></td>
        <td style="text-align:right;font-weight:700;color:${color}">${pos ? '+' : ''}${Utils.currency(Math.abs(f.value || 0))}</td>
        <td>
          <div class="row-actions">
            <button class="btn-icon btn-icon--danger" data-fin-del="${f.id}" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  _renderDRE(finance) {
    const mes  = Utils.currentMonth();
    const data = finance.filter(f => (f.date || '').startsWith(mes));
    const groups = {};
    for (const f of data) {
      if (!groups[f.category]) groups[f.category] = { e: 0, s: 0 };
      if (f.type === 'Entrada') groups[f.category].e += (f.value || 0);
      else                      groups[f.category].s += Math.abs(f.value || 0);
    }
    const rec = data.filter(f => f.type === 'Entrada').reduce((s, f) => s + (f.value || 0), 0);
    const des = data.filter(f => f.type === 'Saída').reduce((s, f) => s + Math.abs(f.value || 0), 0);
    const luc = rec - des;
    const mesLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return `
      <div style="max-width:600px">
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);overflow:hidden">
          <div style="padding:var(--sp-4) var(--sp-5);border-bottom:1px solid var(--border-default);display:flex;align-items:center;justify-content:space-between">
            <strong style="font-family:var(--font-display);letter-spacing:.04em;font-size:var(--text-lg)">DRE — ${mesLabel}</strong>
            <button class="btn btn-ghost" onclick="window.print()" style="font-size:var(--text-sm)">↓ Imprimir</button>
          </div>
          <table class="data-table" style="border:none;border-radius:0">
            <thead>
              <tr>
                <th>Categoria</th>
                <th style="text-align:right">Entradas</th>
                <th style="text-align:right">Saídas</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(groups).map(([cat, { e, s }]) => `
                <tr>
                  <td style="color:var(--text-secondary);font-size:var(--text-sm)">${Utils.escapeHtml(cat)}</td>
                  <td style="text-align:right;color:${e > 0 ? 'var(--color-success)' : 'var(--text-muted)'}">${e > 0 ? Utils.currency(e) : '—'}</td>
                  <td style="text-align:right;color:${s > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}">  ${s > 0 ? `(${Utils.currency(s)})` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--border-strong)">
                <td style="font-weight:700">Receita Total</td>
                <td style="text-align:right;font-weight:700;color:var(--color-success)">${Utils.currency(rec)}</td>
                <td></td>
              </tr>
              <tr>
                <td style="font-weight:700">Despesas Totais</td>
                <td></td>
                <td style="text-align:right;font-weight:700;color:var(--color-danger)">(${Utils.currency(des)})</td>
              </tr>
              <tr style="background:var(--bg-raised)">
                <td style="font-weight:700;font-size:var(--text-lg)">Resultado</td>
                <td colspan="2" style="text-align:right;font-weight:700;font-size:var(--text-lg);color:${luc >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${Utils.currency(luc)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  _renderForm() {
    return `
      <div style="max-width:520px">
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-6)">
          <h3 style="font-family:var(--font-display);letter-spacing:.04em;margin-bottom:var(--sp-5)">Novo Lançamento</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-input" id="lan-tipo">
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Data</label>
              <input type="date" class="form-input" id="lan-data" value="${new Date().toISOString().slice(0,10)}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <input type="text" class="form-input" id="lan-desc" placeholder="Ex: Vendas do dia · 10/07">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select class="form-input" id="lan-cat">
                <optgroup label="Entradas"><option>Vendas</option><option>Outros</option></optgroup>
                <optgroup label="Saídas"><option>CMV</option><option>Fornecedores</option><option>Fixo</option><option>Operacional</option><option>Marketing</option><option>Folha</option><option>Outros</option></optgroup>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Valor (R$)</label>
              <input type="number" class="form-input" id="lan-valor" min="0.01" step="0.01" placeholder="0,00">
            </div>
          </div>
          <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-4)">
            <button class="btn btn-primary" id="btn-salvar-lan">Salvar</button>
            <button class="btn btn-ghost" data-fin-tab="extrato">Cancelar</button>
          </div>
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('financeiro-content');
    if (!el) return;

    el.addEventListener('click', e => {
      const tab = e.target.closest('[data-fin-tab]');
      if (tab) { this._tab = tab.dataset.finTab; this._render(); this._bindEvents(); return; }

      if (e.target.closest('#btn-salvar-lan')) { this._salvar(); return; }

      const del = e.target.closest('[data-fin-del]');
      if (del) { this._excluir(Number(del.dataset.finDel)); return; }
    });

    el.addEventListener('change', e => {
      if (e.target.id === 'fin-tipo') { this._filtroTipo = e.target.value; this._render(); this._bindEvents(); }
      if (e.target.id === 'fin-cat')  { this._filtroCategoria = e.target.value; this._render(); this._bindEvents(); }
    });
  },

  _salvar() {
    const tipo = document.getElementById('lan-tipo')?.value;
    const data = document.getElementById('lan-data')?.value;
    const desc = document.getElementById('lan-desc')?.value?.trim();
    const cat  = document.getElementById('lan-cat')?.value;
    const val  = parseFloat(document.getElementById('lan-valor')?.value || 0);

    if (!data || !desc || !val || val <= 0) { UI.toast('Preencha todos os campos.', 'error'); return; }

    const state = Storage.getState();
    const maxId = state.finance.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0);
    state.finance.unshift({ id: maxId + 1, date: data, description: desc, category: cat, type: tipo, value: tipo === 'Entrada' ? val : -val });
    Storage.setState(state);
    UI.toast('Lançamento salvo.', 'success');
    this._tab = 'extrato';
    this._render();
    this._bindEvents();
  },

  _excluir(id) {
    if (!confirm('Excluir este lançamento?')) return;
    const state = Storage.getState();
    state.finance = state.finance.filter(f => f.id !== id);
    Storage.setState(state);
    this._render();
    this._bindEvents();
  },
};
