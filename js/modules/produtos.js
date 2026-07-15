/* ============================================================
   Distrito OS — Módulo Produtos
   Orquestra as três abas: Cardápio, Ingredientes, Fichas.
   CRUD completo com duplicar, filtrar, ordenar e validar.
   ============================================================ */

const ProdutosModule = {
  _items: [],
  _search: '',
  _filterCat: '',
  _filterAtivo: 'todos',
  _sortField: 'nome',
  _sortDir: 'asc',
  _activeTab: 'cardapio',

  /* ── Inicialização ─────────────────────────────────────────── */

  init() {
    this._items = Stores.produtos.get();
    // Pré-carrega fichas para exibir custo na aba Cardápio
    FichasModule.preload();
    this._bindTabs();
    this._switchTab('cardapio');
  },

  /* ── Tabs ──────────────────────────────────────────────────── */

  _bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });
  },

  _switchTab(tab) {
    this._activeTab = tab;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== `tab-${tab}`);
    });

    if (tab === 'cardapio') {
      this._render();
      this._bindCardapioToolbar();
    } else if (tab === 'ingredientes') {
      IngredientesModule.init();
    } else if (tab === 'fichas') {
      // Passa apenas produtos ativos para o editor
      FichasModule.init(this._items.filter(p => p.ativo));
    }
  },

  /* ── Filtragem e ordenação (Cardápio) ──────────────────────── */

  _filtered() {
    const q = this._search.toLowerCase();
    return this._items
      .filter(p => {
        if (q && !p.nome.toLowerCase().includes(q) && !(p.codigo || '').toLowerCase().includes(q)) return false;
        if (this._filterCat && p.categoria !== this._filterCat) return false;
        if (this._filterAtivo === 'ativo'   && !p.ativo) return false;
        if (this._filterAtivo === 'inativo' &&  p.ativo) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[this._sortField] ?? '';
        const bv = b[this._sortField] ?? '';
        const cmp = typeof av === 'string' ? av.localeCompare(bv, 'pt-BR') : av - bv;
        return this._sortDir === 'asc' ? cmp : -cmp;
      });
  },

  /* ── Custo via Ficha Técnica ───────────────────────────────── */

  getCusto(produtoId) {
    const ficha = FichasModule.getByProduto(produtoId);
    if (ficha) return FichasModule.calcCusto(ficha);
    const produto = this._items.find(p => p.id === produtoId);
    return produto?.custoCompra ?? null;
  },

  /* ── Render tabela Cardápio ────────────────────────────────── */

  _render() {
    const tbody = document.getElementById('tbody-cardapio');
    if (!tbody) return;

    const items = this._filtered();
    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);font-size:var(--text-sm)">
            Nenhum produto encontrado.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = items.map(p => {
      const custo  = this.getCusto(p.id);
      const margem = (custo !== null && p.precoVenda)
        ? Math.round(((p.precoVenda - custo) / p.precoVenda) * 100)
        : null;

      const custoStr    = custo  !== null ? Utils.currency(custo)  : '<span style="color:var(--text-muted)">—</span>';
      const margemColor = margem !== null && margem < 0 ? 'var(--color-danger)' : 'var(--color-success)';
      const margemStr   = margem !== null
        ? `<span style="color:${margemColor};font-weight:600">${margem}%</span>`
        : '<span style="color:var(--text-muted)">—</span>';

      const estoque = p.estoqueAtual !== null && p.estoqueAtual !== undefined;
      const estoqueStr = estoque
        ? (p.estoqueAtual <= (p.estoqueMinimo || 0)
            ? `<span style="color:var(--color-danger);font-weight:600">${p.estoqueAtual}</span>`
            : `<span>${p.estoqueAtual}</span>`)
        : '<span style="color:var(--text-muted)">ficha</span>';

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:var(--text-primary)">${Utils.escapeHtml(p.nome)}</div>
            ${p.sku ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.escapeHtml(p.sku)}</div>` : (p.codigo ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.escapeHtml(p.codigo)}</div>` : '')}
          </td>
          <td style="color:var(--text-muted)">${Utils.escapeHtml(p.categoria)}</td>
          <td style="font-weight:600">${Utils.currency(p.precoVenda)}</td>
          <td>${custoStr}</td>
          <td>${margemStr}</td>
          <td style="color:var(--text-muted);text-align:center">${estoqueStr}</td>
          <td style="color:var(--text-muted)">${p.tempoPreparo ? p.tempoPreparo + ' min' : '—'}</td>
          <td>
            <span class="status-dot ${p.ativo ? 'status-dot--active' : 'status-dot--inactive'}"></span>
            <span style="font-size:var(--text-sm);color:var(--text-muted)">${p.ativo ? 'Ativo' : 'Inativo'}</span>
          </td>
          <td>
            <div class="row-actions">
              <button class="btn-icon" data-action="edit-produto" data-id="${p.id}" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon" data-action="dup-produto" data-id="${p.id}" title="Duplicar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
              <button class="btn-icon btn-icon--danger" data-action="delete-produto" data-id="${p.id}" title="Excluir">
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

    tbody.querySelectorAll('[data-action="edit-produto"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = this._items.find(p => p.id === btn.dataset.id);
        if (item) this._openForm(item);
      });
    });
    tbody.querySelectorAll('[data-action="dup-produto"]').forEach(btn => {
      btn.addEventListener('click', () => this._duplicate(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-action="delete-produto"]').forEach(btn => {
      btn.addEventListener('click', () => this._confirmDelete(btn.dataset.id));
    });
  },

  /* ── Formulário (modal) ────────────────────────────────────── */

  _openForm(item = null) {
    const editing = !!item;

    const catOptions = CATEGORIAS_PRODUTO.map(c =>
      `<option value="${c}" ${item?.categoria === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    UI.openModal({
      title: editing ? 'Editar Produto' : 'Novo Produto',
      body: `
        <form id="form-produto" autocomplete="off">
          <input type="hidden" name="id" value="${item?.id || ''}">

          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-input" name="nome" required placeholder="ex: Batata Cheddar"
              value="${Utils.escapeHtml(item?.nome || '')}">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Categoria *</label>
              <select class="form-select" name="categoria" required>${catOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Código</label>
              <input class="form-input" name="codigo" placeholder="ex: BAT-CH"
                value="${Utils.escapeHtml(item?.codigo || '')}">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Preço de Venda (R$) *</label>
              <input class="form-input" name="precoVenda" type="number" step="0.01" min="0.01"
                required placeholder="0,00" value="${item?.precoVenda ?? ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Tempo de Preparo (min)</label>
              <input class="form-input" name="tempoPreparo" type="number" min="0" placeholder="0"
                value="${item?.tempoPreparo ?? ''}">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Peso (g)</label>
              <input class="form-input" name="peso" type="number" min="0" placeholder="0"
                value="${item?.peso ?? ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Data de Cadastro</label>
              <input class="form-input" name="dataCadastro" type="date"
                value="${item?.dataCadastro || Utils.today()}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-input" name="descricao" rows="2"
              style="height:auto;resize:vertical;padding-top:8px"
              placeholder="Descrição curta para o cardápio...">${Utils.escapeHtml(item?.descricao || '')}</textarea>
          </div>

          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer">
              <input type="checkbox" name="ativo" value="true"
                ${(!editing || item?.ativo) ? 'checked' : ''}>
              <span class="form-label" style="margin:0">Produto ativo no cardápio</span>
            </label>
          </div>
        </form>
      `,
      confirmLabel: editing ? 'Salvar' : 'Cadastrar',
      onConfirm: () => this._submitForm(editing, item),
    });
  },

  _submitForm(editing, original) {
    const form = document.getElementById('form-produto');
    if (!form) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd        = new FormData(form);
    const nome      = fd.get('nome').trim();
    const precoVenda = parseFloat(fd.get('precoVenda'));

    if (!nome)              { UI.toast('Nome é obrigatório', 'danger'); return; }
    if (!precoVenda || precoVenda <= 0) { UI.toast('Preço deve ser maior que zero', 'danger'); return; }

    const data = {
      id:           fd.get('id') || `p-${Utils.uid()}`,
      nome,
      categoria:    fd.get('categoria'),
      codigo:       fd.get('codigo').trim(),
      descricao:    fd.get('descricao').trim(),
      precoVenda,
      tempoPreparo: parseFloat(fd.get('tempoPreparo')) || 0,
      peso:         parseFloat(fd.get('peso')) || 0,
      dataCadastro: fd.get('dataCadastro') || Utils.today(),
      ativo:        fd.get('ativo') === 'true',
      foto:         original?.foto || '',
    };

    const idx = this._items.findIndex(p => p.id === data.id);
    if (idx >= 0) {
      this._items[idx] = data;
      UI.toast('Produto atualizado', 'success');
    } else {
      this._items.push(data);
      UI.toast('Produto cadastrado', 'success');
    }

    Stores.produtos.set(this._items);
    UI.closeModal();
    this._render();
  },

  /* ── Duplicar ──────────────────────────────────────────────── */

  _duplicate(id) {
    const item = this._items.find(p => p.id === id);
    if (!item) return;

    const copy = {
      ...item,
      id:           `p-${Utils.uid()}`,
      nome:         `${item.nome} (cópia)`,
      codigo:       item.codigo ? `${item.codigo}-C` : '',
      dataCadastro: Utils.today(),
    };
    this._items.push(copy);
    Stores.produtos.set(this._items);
    UI.toast('Produto duplicado', 'success');
    this._render();
  },

  /* ── Exclusão ──────────────────────────────────────────────── */

  _confirmDelete(id) {
    const item = this._items.find(p => p.id === id);
    if (!item) return;

    UI.openModal({
      title: 'Excluir Produto',
      body: `
        <p>Confirma a exclusão de <strong>${Utils.escapeHtml(item.nome)}</strong>?</p>
        <p style="margin-top:var(--sp-2);color:var(--text-muted);font-size:var(--text-sm)">
          A ficha técnica associada também será removida permanentemente.
        </p>
      `,
      confirmLabel: 'Excluir',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        this._items = this._items.filter(p => p.id !== id);
        FichasModule.deleteByProduto(id);
        Stores.produtos.set(this._items);
        UI.closeModal();
        UI.toast('Produto excluído', 'info');
        this._render();
      },
    });
  },

  /* ── Toolbar bindings (aba Cardápio) ───────────────────────── */

  _bindCardapioToolbar() {
    const search      = document.getElementById('cardapio-search');
    const catFilter   = document.getElementById('cardapio-categoria');
    const ativoFilter = document.getElementById('cardapio-ativo');
    const newBtn      = document.getElementById('btn-novo-produto');

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
