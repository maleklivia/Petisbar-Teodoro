/* ============================================================
   Distrito OS — DocumentosModule
   Gestão de documentos: alvarás, contratos, manuais, etc.
   Armazena metadados + link/nota (localStorage não suporta arquivos).
   ============================================================ */

const DocumentosModule = {
  _busca: '',
  _filtroCategoria: 'todos',

  init() {
    this._render();
    this._bindEvents();
    this._verificarVencimentos();
  },

  _filtered() {
    let data = Stores.documentos.get();
    if (this._busca) {
      const b = this._busca.toLowerCase();
      data = data.filter(d => d.titulo.toLowerCase().includes(b) || d.categoria.toLowerCase().includes(b));
    }
    if (this._filtroCategoria !== 'todos') data = data.filter(d => d.categoria === this._filtroCategoria);
    return data.sort((a, b) => (b.dataCadastro || '').localeCompare(a.dataCadastro || ''));
  },

  _render() {
    const el = document.getElementById('documentos-content');
    if (!el) return;
    const todos = Stores.documentos.get();
    const hoje  = new Date().toISOString().slice(0, 10);
    const limit = new Date(); limit.setDate(limit.getDate() + 30);
    const limStr= limit.toISOString().slice(0, 10);
    const vencendo = todos.filter(d => d.data && d.data >= hoje && d.data <= limStr).length;
    const vencidos  = todos.filter(d => d.data && d.data < hoje).length;
    const data = this._filtered();

    el.innerHTML = `
      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card">
          <span class="kpi-card__label">Documentos</span>
          <strong class="kpi-card__value">${todos.length}</strong>
          <small class="kpi-card__sub">cadastrados</small>
        </article>
        <article class="kpi-card ${vencendo > 0 ? 'kpi-card--warn' : ''}">
          <span class="kpi-card__label">Vencendo em 30d</span>
          <strong class="kpi-card__value">${vencendo}</strong>
          <small class="kpi-card__sub">atenção</small>
        </article>
        <article class="kpi-card ${vencidos > 0 ? 'kpi-card--warn' : 'kpi-card--ok'}">
          <span class="kpi-card__label">Vencidos</span>
          <strong class="kpi-card__value">${vencidos}</strong>
          <small class="kpi-card__sub">renovar</small>
        </article>
      </div>

      <div class="module-toolbar">
        <input type="text" class="form-input toolbar-search" id="doc-busca" placeholder="Buscar documento…" value="${Utils.escapeHtml(this._busca)}">
        <select class="form-input toolbar-filter" id="doc-cat">
          <option value="todos">Todas as categorias</option>
          ${CATS_DOCUMENTO.map(c => `<option value="${c}" ${this._filtroCategoria === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="btn-novo-doc">+ Adicionar</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        ${data.length ? data.map(d => this._card(d, hoje, limStr)).join('') :
          '<div class="empty-state"><p>Nenhum documento encontrado.</p></div>'}
      </div>
    `;
  },

  _card(d, hoje, limStr) {
    const vencido  = d.data && d.data < hoje;
    const vencendo = d.data && d.data >= hoje && d.data <= limStr;
    const borderColor = vencido ? 'var(--color-danger)' : vencendo ? 'var(--color-warning)' : 'var(--border-default)';
    const diasRestantes = d.data ? Math.floor((new Date(d.data) - new Date(hoje)) / 86400000) : null;

    return `
      <div style="background:var(--bg-surface);border:1px solid ${borderColor};border-radius:var(--radius-lg);padding:var(--sp-4) var(--sp-5);display:flex;align-items:center;gap:var(--sp-4)">
        <div style="font-size:28px">
          ${d.categoria === 'Alvará' ? '📋' : d.categoria === 'Contrato' ? '📄' : d.categoria === 'Fiscal' ? '🧾' : d.categoria === 'Manual' ? '📖' : '📁'}
        </div>
        <div style="flex:1">
          <div style="font-weight:700">${Utils.escapeHtml(d.titulo)}</div>
          <div style="font-size:var(--text-sm);color:var(--text-muted);margin-top:2px">
            <span class="badge badge-neutral">${Utils.escapeHtml(d.categoria)}</span>
            ${d.data ? ` · Validade: <span style="color:${vencido ? 'var(--color-danger)' : vencendo ? 'var(--color-warning)' : 'var(--text-muted)'};font-weight:600">${Utils.formatShortDate(d.data)}</span>` : ''}
            ${diasRestantes !== null && !vencido ? ` · ${diasRestantes}d` : ''}
            ${vencido ? ' <span style="color:var(--color-danger);font-weight:700">VENCIDO</span>' : ''}
          </div>
          ${d.notas ? `<div style="font-size:var(--text-sm);color:var(--text-muted);margin-top:4px">${Utils.escapeHtml(d.notas)}</div>` : ''}
        </div>
        <div style="display:flex;gap:var(--sp-2);align-items:center">
          ${d.link ? `<a href="${Utils.escapeHtml(d.link)}" target="_blank" rel="noopener" class="btn btn-ghost" style="font-size:var(--text-sm)">↗ Abrir</a>` : ''}
          <button class="btn-icon" data-doc-edit="${d.id}" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-icon--danger" data-doc-del="${d.id}" title="Excluir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('documentos-content');
    if (!el) return;

    el.addEventListener('click', e => {
      if (e.target.closest('#btn-novo-doc')) { this._openForm(); return; }

      const edit = e.target.closest('[data-doc-edit]');
      if (edit) { this._openForm(edit.dataset.docEdit); return; }

      const del = e.target.closest('[data-doc-del]');
      if (del) {
        if (!confirm('Excluir este documento?')) return;
        Stores.documentos.set(Stores.documentos.get().filter(d => d.id !== del.dataset.docDel));
        this._render();
        this._bindEvents();
        return;
      }
    });

    const busca = el.querySelector('#doc-busca');
    if (busca) busca.addEventListener('input', e => { this._busca = e.target.value; this._render(); this._bindEvents(); });

    const cat = el.querySelector('#doc-cat');
    if (cat) cat.addEventListener('change', e => { this._filtroCategoria = e.target.value; this._render(); this._bindEvents(); });
  },

  _openForm(id) {
    const docs = Stores.documentos.get();
    const d    = id ? docs.find(x => x.id === id) : null;

    UI.openModal({
      title: d ? 'Editar Documento' : 'Adicionar Documento',
      body: `
        <div class="form-group">
          <label class="form-label">Título</label>
          <input type="text" class="form-input" id="doc-titulo" value="${Utils.escapeHtml(d?.titulo || '')}" placeholder="Ex: Alvará de Funcionamento 2026">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select class="form-input" id="doc-categoria">
              ${CATS_DOCUMENTO.map(c => `<option ${d?.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data de Validade</label>
            <input type="date" class="form-input" id="doc-data" value="${d?.data || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Link (URL do documento)</label>
          <input type="url" class="form-input" id="doc-link" value="${Utils.escapeHtml(d?.link || '')}" placeholder="https://drive.google.com/…">
        </div>
        <div class="form-group">
          <label class="form-label">Notas</label>
          <input type="text" class="form-input" id="doc-notas" value="${Utils.escapeHtml(d?.notas || '')}" placeholder="Ex: Renovar em set/2026">
        </div>
      `,
      confirmLabel: d ? 'Salvar' : 'Adicionar',
      onConfirm: () => {
        const titulo    = document.getElementById('doc-titulo')?.value?.trim();
        const categoria = document.getElementById('doc-categoria')?.value;
        const data2     = document.getElementById('doc-data')?.value;
        const link      = document.getElementById('doc-link')?.value?.trim();
        const notas     = document.getElementById('doc-notas')?.value?.trim();

        if (!titulo) { UI.toast('Informe o título.', 'error'); return; }

        const docs2  = Stores.documentos.get();
        if (id) {
          const idx = docs2.findIndex(x => x.id === id);
          if (idx >= 0) docs2[idx] = { ...docs2[idx], titulo, categoria, data: data2, link, notas };
          UI.toast('Documento atualizado.', 'success');
        } else {
          const maxNum = docs2.reduce((m, x) => Math.max(m, parseInt(x.id?.replace('doc-', '') || 0)), 0);
          docs2.unshift({ id: `doc-${String(maxNum + 1).padStart(3, '0')}`, titulo, categoria, data: data2, link, notas, dataCadastro: new Date().toISOString().slice(0, 10) });
          UI.toast('Documento adicionado.', 'success');
        }
        Stores.documentos.set(docs2);
        this._render();
        this._bindEvents();
      },
    });
  },

  _verificarVencimentos() {
    const hoje = new Date().toISOString().slice(0, 10);
    const lim  = new Date(); lim.setDate(lim.getDate() + 7);
    const limStr = lim.toISOString().slice(0, 10);
    const urgentes = Stores.documentos.get().filter(d => d.data && d.data >= hoje && d.data <= limStr);
    if (urgentes.length > 0 && typeof EventBus !== 'undefined') {
      EventBus.emit('documentos.vencendo', { documentos: urgentes.map(d => d.titulo) });
    }
  },
};
