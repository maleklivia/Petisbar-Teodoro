/* ============================================================
   Petisbar Teodoro — Módulo Ingredientes
   CRUD completo com busca, filtro por categoria e status,
   ordenação e validação de campos.
   ============================================================ */

const IngredientesModule = {
  _items: [],
  _search: '',
  _filterCat: '',
  _filterAtivo: 'todos',
  _sortField: 'nome',
  _sortDir: 'asc',

  /* ── Inicialização ─────────────────────────────────────────── */

  init() {
    this._items = Stores.ingredientes.get();
    this._render();
    this._bindToolbar();
  },

  /* ── Filtragem e ordenação ─────────────────────────────────── */

  _filtered() {
    const q = this._search.toLowerCase();
    return this._items
      .filter(i => {
        if (q && !i.nome.toLowerCase().includes(q) && !(i.fornecedor || '').toLowerCase().includes(q)) return false;
        if (this._filterCat && i.categoria !== this._filterCat) return false;
        if (this._filterAtivo === 'ativo'   && !i.ativo) return false;
        if (this._filterAtivo === 'inativo' &&  i.ativo) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[this._sortField] ?? '';
        const bv = b[this._sortField] ?? '';
        const cmp = typeof av === 'string' ? av.localeCompare(bv, 'pt-BR') : av - bv;
        return this._sortDir === 'asc' ? cmp : -cmp;
      });
  },

  /* ── Render tabela ─────────────────────────────────────────── */

  _render() {
    const tbody = document.getElementById('tbody-ingredientes');
    if (!tbody) return;

    const items = this._filtered();
    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);font-size:var(--text-sm)">
            Nenhum ingrediente encontrado.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = items.map(i => {
      const pontoPedido = Math.max(
        Number(i.estoqueMinimo) || 0,
        (Number(i.consumoMedioDiario) || 0) * (Number(i.prazoReposicaoDias) || 0),
      );
      const estoqueBaixo = i.estoqueAtual <= pontoPedido;
      return `
        <tr>
          <td style="font-weight:600">${Utils.escapeHtml(i.nome)}</td>
          <td style="color:var(--text-muted)">${Utils.escapeHtml(i.categoria)}</td>
          <td>${i.unidade}</td>
          <td>
            <div>${Utils.currency(i.custoUnitario)}/${i.unidade}</div>
            ${i.precoStatus ? `<div style="font-size:var(--text-xs);color:${i.precoStatus === 'provisório' ? 'var(--color-warning)' : 'var(--text-muted)'}">${Utils.escapeHtml(i.precoStatus)} · ${i.precoRevisadoEm ? Utils.formatDate(i.precoRevisadoEm) : ''}</div>` : ''}
            ${i.fontePreco ? `<a href="${Utils.escapeHtml(i.fontePreco)}" target="_blank" rel="noopener" style="font-size:var(--text-xs)">ver fonte</a>` : ''}
          </td>
          <td>
            <span class="badge ${estoqueBaixo ? 'badge-danger' : 'badge-success'}">
              ${i.estoqueAtual} ${i.unidade}
            </span>
          </td>
          <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.escapeHtml(i.fornecedor || '—')}</td>
          <td>
            <span class="status-dot ${i.ativo ? 'status-dot--active' : 'status-dot--inactive'}"></span>
            ${i.ativo ? 'Ativo' : 'Inativo'}
          </td>
          <td>
            <div class="row-actions">
              <button class="btn-icon" data-action="edit-ing" data-id="${i.id}" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon btn-icon--danger" data-action="delete-ing" data-id="${i.id}" title="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action="edit-ing"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = this._items.find(i => i.id === btn.dataset.id);
        if (item) this._openForm(item);
      });
    });

    tbody.querySelectorAll('[data-action="delete-ing"]').forEach(btn => {
      btn.addEventListener('click', () => this._confirmDelete(btn.dataset.id));
    });
  },

  /* ── Formulário (modal) ────────────────────────────────────── */

  _openForm(item = null) {
    const editing = !!item;

    const catOptions = CATEGORIAS_INGREDIENTE.map(c =>
      `<option value="${c}" ${item?.categoria === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    const unitOptions = UNIDADES.map(u =>
      `<option value="${u}" ${(item?.unidade || 'kg') === u ? 'selected' : ''}>${u}</option>`
    ).join('');

    UI.openModal({
      title: editing ? 'Editar Ingrediente' : 'Novo Ingrediente',
      body: `
        <form id="form-ing" autocomplete="off">
          <input type="hidden" name="id" value="${item?.id || ''}">

          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-input" name="nome" required placeholder="ex: Limão Tahiti"
              value="${Utils.escapeHtml(item?.nome || '')}">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Categoria *</label>
              <select class="form-select" name="categoria" required>${catOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Unidade *</label>
              <select class="form-select" name="unidade" required>${unitOptions}</select>
            </div>
          </div>

          <div style="padding:var(--sp-3);background:var(--bg-raised);border-radius:var(--radius-md);margin-bottom:var(--sp-3)">
            <div class="form-label" style="margin-bottom:var(--sp-3)">Planejamento de reposição</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-3)">
              <div class="form-group" style="margin:0">
                <label class="form-label">Consumo médio/dia</label>
                <input class="form-input" name="consumoMedioDiario" type="number" step="0.001" min="0" value="${item?.consumoMedioDiario ?? 0}">
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Prazo de entrega (dias)</label>
                <input class="form-input" name="prazoReposicaoDias" type="number" step="1" min="0" value="${item?.prazoReposicaoDias ?? 0}">
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Quantidade por pacote</label>
                <input class="form-input" name="quantidadePacote" type="number" step="0.001" min="0.001" value="${item?.quantidadePacote ?? 1}">
              </div>
            </div>
            <small style="display:block;margin-top:var(--sp-2);color:var(--text-muted)">O alerta usa o maior valor entre o estoque mínimo e o consumo diário × prazo de entrega.</small>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Custo Unitário (R$) *</label>
              <input class="form-input" name="custoUnitario" type="number" step="0.01" min="0" required
                placeholder="0,00" value="${item?.custoUnitario ?? ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Estoque Atual *</label>
              <input class="form-input" name="estoqueAtual" type="number" step="0.001" min="0" required
                value="${item?.estoqueAtual ?? ''}">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Quantidade mínima *</label>
              <input class="form-input" name="estoqueMinimo" type="number" step="0.001" min="0" required
                value="${item?.estoqueMinimo ?? ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Fornecedor</label>
              <input class="form-input" name="fornecedor" placeholder="opcional"
                value="${Utils.escapeHtml(item?.fornecedor || '')}">
            </div>
          </div>

          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer">
              <input type="checkbox" name="ativo" value="true"
                ${(!editing || item?.ativo) ? 'checked' : ''}>
              <span class="form-label" style="margin:0">Ingrediente ativo</span>
            </label>
          </div>
        </form>
      `,
      confirmLabel: editing ? 'Salvar' : 'Cadastrar',
      onConfirm: () => this._submitForm(editing),
    });
  },

  _submitForm(editing) {
    const form = document.getElementById('form-ing');
    if (!form) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd = new FormData(form);
    const custoUnitario = parseFloat(fd.get('custoUnitario'));
    const estoqueAtual  = parseFloat(fd.get('estoqueAtual'));
    const estoqueMinimo = parseFloat(fd.get('estoqueMinimo'));
    const consumoMedioDiario = parseFloat(fd.get('consumoMedioDiario') || 0);
    const prazoReposicaoDias = parseInt(fd.get('prazoReposicaoDias') || 0, 10);
    const quantidadePacote = parseFloat(fd.get('quantidadePacote') || 1);

    if (custoUnitario < 0) { UI.toast('Custo não pode ser negativo', 'danger'); return; }
    if (estoqueAtual  < 0) { UI.toast('Estoque não pode ser negativo', 'danger'); return; }
    if (estoqueMinimo < 0) { UI.toast('Estoque mínimo não pode ser negativo', 'danger'); return; }

    const data = {
      id:            fd.get('id') || `i-${Utils.uid()}`,
      nome:          fd.get('nome').trim(),
      categoria:     fd.get('categoria'),
      unidade:       fd.get('unidade'),
      custoUnitario,
      estoqueAtual,
      estoqueMinimo,
      consumoMedioDiario,
      prazoReposicaoDias,
      quantidadePacote,
      fornecedor:    fd.get('fornecedor').trim(),
      ativo:         fd.get('ativo') === 'true',
    };

    if (!data.nome) { UI.toast('Nome é obrigatório', 'danger'); return; }

    const idx = this._items.findIndex(i => i.id === data.id);
    if (idx >= 0) {
      this._items[idx] = data;
      UI.toast('Ingrediente atualizado', 'success');
    } else {
      this._items.push(data);
      UI.toast('Ingrediente cadastrado', 'success');
    }

    Stores.ingredientes.set(this._items);
    UI.closeModal();
    this._render();
  },

  /* ── Exclusão ──────────────────────────────────────────────── */

  _confirmDelete(id) {
    const item = this._items.find(i => i.id === id);
    if (!item) return;

    UI.openModal({
      title: 'Excluir Ingrediente',
      body: `
        <p>Confirma a exclusão de <strong>${Utils.escapeHtml(item.nome)}</strong>?</p>
        <p style="margin-top:var(--sp-2);color:var(--text-muted);font-size:var(--text-sm)">
          Fichas técnicas que usam este ingrediente perderão o vínculo.
        </p>
      `,
      confirmLabel: 'Excluir',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        this._items = this._items.filter(i => i.id !== id);
        Stores.ingredientes.set(this._items);
        UI.closeModal();
        UI.toast('Ingrediente excluído', 'info');
        this._render();
      },
    });
  },

  /* ── Toolbar bindings ──────────────────────────────────────── */

  _bindToolbar() {
    const search      = document.getElementById('ing-search');
    const catFilter   = document.getElementById('ing-categoria');
    const ativoFilter = document.getElementById('ing-ativo');
    const newBtn      = document.getElementById('btn-novo-ingrediente');

    if (search) {
      search.addEventListener('input', Utils.debounce(() => {
        this._search = search.value;
        this._render();
      }, 250));
    }
    if (catFilter) {
      catFilter.addEventListener('change', () => {
        this._filterCat = catFilter.value;
        this._render();
      });
    }
    if (ativoFilter) {
      ativoFilter.addEventListener('change', () => {
        this._filterAtivo = ativoFilter.value;
        this._render();
      });
    }
    if (newBtn) {
      newBtn.addEventListener('click', () => this._openForm());
    }
  },
};
