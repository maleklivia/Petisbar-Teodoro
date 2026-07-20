/* ============================================================
   Petisbar Teodoro — FornecedoresModule
   CRUD de fornecedores com histórico de compras.
   ============================================================ */

const FornecedoresModule = {
  _busca: '',
  _filtroCategoria: 'todos',

  init() {
    this._render();
    this._bindEvents();
  },

  _filtered() {
    let data = Stores.fornecedores.get();
    if (this._busca) {
      const b = this._busca.toLowerCase();
      data = data.filter(f => f.nome.toLowerCase().includes(b) || f.categoria.toLowerCase().includes(b) || (f.contato || '').toLowerCase().includes(b));
    }
    if (this._filtroCategoria !== 'todos') data = data.filter(f => f.categoria === this._filtroCategoria);
    return data;
  },

  _render() {
    const el = document.getElementById('fornecedores-content');
    if (!el) return;
    const todos = Stores.fornecedores.get();
    const ativos = todos.filter(f => f.ativo).length;
    const data   = this._filtered();

    el.innerHTML = `
      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card">
          <span class="kpi-card__label">Fornecedores</span>
          <strong class="kpi-card__value">${todos.length}</strong>
          <small class="kpi-card__sub">${ativos} ativos</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Categorias</span>
          <strong class="kpi-card__value">${[...new Set(todos.map(f => f.categoria))].length}</strong>
          <small class="kpi-card__sub">de produto</small>
        </article>
      </div>

      <div class="module-toolbar">
        <input type="text" class="form-input toolbar-search" id="forn-busca" placeholder="Buscar fornecedor…" value="${Utils.escapeHtml(this._busca)}">
        <select class="form-input toolbar-filter" id="forn-cat">
          <option value="todos">Todas as categorias</option>
          ${CATS_FORNECEDOR.map(c => `<option value="${c}" ${this._filtroCategoria === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="btn-novo-forn">+ Novo Fornecedor</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Categoria</th>
              <th>Telefone</th>
              <th>Prazo</th>
              <th>Condições</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${data.length ? data.map(f => this._row(f)).join('') :
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum fornecedor encontrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _row(f) {
    return `
      <tr>
        <td>
          <div style="font-weight:600">${Utils.escapeHtml(f.nome)}</div>
          ${f.observacoes ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.escapeHtml(f.observacoes)}</div>` : ''}
        </td>
        <td><span class="badge badge-neutral">${Utils.escapeHtml(f.categoria)}</span></td>
        <td style="color:var(--text-secondary);font-size:var(--text-sm)">${Utils.escapeHtml(f.telefone || '—')}</td>
        <td style="color:var(--text-muted);font-size:var(--text-sm)">${f.prazoEntrega ? `${f.prazoEntrega}d` : '—'}</td>
        <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.escapeHtml(f.condicoesPagamento || '—')}</td>
        <td>
          <span class="status-dot ${f.ativo ? 'status-dot--active' : 'status-dot--inactive'}"></span>
          ${f.ativo ? 'Ativo' : 'Inativo'}
        </td>
        <td>
          <div class="row-actions">
            <button class="btn-icon" data-forn-edit="${f.id}" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon btn-icon--danger" data-forn-del="${f.id}" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('fornecedores-content');
    if (!el) return;

    el.addEventListener('click', e => {
      if (e.target.closest('#btn-novo-forn')) { this._openForm(); return; }

      const edit = e.target.closest('[data-forn-edit]');
      if (edit) { this._openForm(edit.dataset.fornEdit); return; }

      const del = e.target.closest('[data-forn-del]');
      if (del) { this._excluir(del.dataset.fornDel); return; }
    });

    const busca = el.querySelector('#forn-busca');
    if (busca) busca.addEventListener('input', e => { this._busca = e.target.value; this._render(); this._bindEvents(); });

    const cat = el.querySelector('#forn-cat');
    if (cat) cat.addEventListener('change', e => { this._filtroCategoria = e.target.value; this._render(); this._bindEvents(); });
  },

  _openForm(id) {
    const fornecedores = Stores.fornecedores.get();
    const f = id ? fornecedores.find(x => x.id === id) : null;

    UI.openModal({
      title: f ? 'Editar Fornecedor' : 'Novo Fornecedor',
      body: `
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Nome</label>
            <input type="text" class="form-input" id="forn-nome" value="${Utils.escapeHtml(f?.nome || '')}" placeholder="Nome do fornecedor">
          </div>
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select class="form-input" id="forn-categoria">
              ${CATS_FORNECEDOR.map(c => `<option ${f?.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">CNPJ</label>
            <input type="text" class="form-input" id="forn-cnpj" value="${Utils.escapeHtml(f?.cnpj || '')}" placeholder="00.000.000/0001-00">
          </div>
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input type="text" class="form-input" id="forn-tel" value="${Utils.escapeHtml(f?.telefone || '')}" placeholder="(11) 9 9999-0000">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="forn-email" value="${Utils.escapeHtml(f?.email || '')}" placeholder="contato@fornecedor.com">
          </div>
          <div class="form-group">
            <label class="form-label">Contato</label>
            <input type="text" class="form-input" id="forn-contato" value="${Utils.escapeHtml(f?.contato || '')}" placeholder="Nome do contato">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Prazo de Entrega (dias)</label>
            <input type="number" class="form-input" id="forn-prazo" min="0" value="${f?.prazoEntrega || 1}">
          </div>
          <div class="form-group">
            <label class="form-label">Condições de Pagamento</label>
            <input type="text" class="form-input" id="forn-condicoes" value="${Utils.escapeHtml(f?.condicoesPagamento || '')}" placeholder="À vista, 30 dias…">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <input type="text" class="form-input" id="forn-obs" value="${Utils.escapeHtml(f?.observacoes || '')}" placeholder="Dias de entrega, pedido mínimo…">
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="forn-ativo" ${f === null || f?.ativo ? 'checked' : ''}> Fornecedor ativo
          </label>
        </div>
      `,
      confirmLabel: f ? 'Salvar' : 'Criar Fornecedor',
      onConfirm: () => this._submitForm(id),
    });
  },

  _submitForm(id) {
    const nome       = document.getElementById('forn-nome')?.value?.trim();
    const categoria  = document.getElementById('forn-categoria')?.value;
    const cnpj       = document.getElementById('forn-cnpj')?.value?.trim();
    const telefone   = document.getElementById('forn-tel')?.value?.trim();
    const email      = document.getElementById('forn-email')?.value?.trim();
    const contato    = document.getElementById('forn-contato')?.value?.trim();
    const prazo      = parseInt(document.getElementById('forn-prazo')?.value || 1);
    const condicoes  = document.getElementById('forn-condicoes')?.value?.trim();
    const obs        = document.getElementById('forn-obs')?.value?.trim();
    const ativo      = document.getElementById('forn-ativo')?.checked ?? true;

    if (!nome) { UI.toast('Informe o nome do fornecedor.', 'error'); return; }

    const fornecedores = Stores.fornecedores.get();
    if (id) {
      const idx = fornecedores.findIndex(f => f.id === id);
      if (idx >= 0) fornecedores[idx] = { ...fornecedores[idx], nome, categoria, cnpj, telefone, email, contato, prazoEntrega: prazo, condicoesPagamento: condicoes, observacoes: obs, ativo };
      UI.toast('Fornecedor atualizado.', 'success');
    } else {
      const maxNum = fornecedores.reduce((m, f) => Math.max(m, parseInt(f.id?.replace('for-', '') || 0)), 0);
      fornecedores.unshift({ id: `for-${String(maxNum + 1).padStart(3, '0')}`, nome, categoria, cnpj, telefone, email, contato, prazoEntrega: prazo, condicoesPagamento: condicoes, observacoes: obs, ativo, dataCadastro: new Date().toISOString().slice(0, 10) });
      UI.toast('Fornecedor criado.', 'success');
    }

    Stores.fornecedores.set(fornecedores);
    this._render();
    this._bindEvents();
  },

  _excluir(id) {
    if (!confirm('Excluir este fornecedor?')) return;
    const fornecedores = Stores.fornecedores.get().filter(f => f.id !== id);
    Stores.fornecedores.set(fornecedores);
    UI.toast('Fornecedor excluído.', 'success');
    this._render();
    this._bindEvents();
  },
};
