/* ============================================================
   Petisbar Teodoro — Módulo Fichas Técnicas
   Editor interativo com cálculo automático de CMV e margem.
   Auto-salva a cada alteração — sem botão "Salvar".
   ============================================================ */

const FichasModule = {
  _ingredientes: [],
  _fichas: [],
  _activeProdutoId: null,
  _activeProduto: null,
  _cmvGoal: 35,
  _allProdutos: [],

  /* ── Inicialização ─────────────────────────────────────────── */

  init(produtos) {
    this._allProdutos = produtos;
    this._ingredientes = Stores.ingredientes.get();
    this._fichas = Stores.fichas.get();
    this._cmvGoal = (Storage.getState().settings || {}).cmvGoal || 35;
    this._renderProdutoList(produtos);
    this._bindSearch(produtos);

    // Re-seleciona produto ativo se houver
    if (this._activeProdutoId) {
      const p = produtos.find(p => p.id === this._activeProdutoId);
      if (p) this.selectProduto(p);
    }
  },

  /* ── API pública usada por ProdutosModule ──────────────────── */

  preload() {
    this._ingredientes = Stores.ingredientes.get();
    this._fichas       = Stores.fichas.get();
  },

  getByProduto(produtoId) {
    return this._fichas.find(f => f.produtoId === produtoId) || null;
  },

  calcCusto(ficha) {
    if (!ficha || !ficha.itens) return 0;
    return ficha.itens.reduce((sum, item) => {
      const ing = this._ingredientes.find(i => i.id === item.ingredienteId);
      if (!ing) return sum;
      const cost = calcIngredienteCost(ing, item.quantidade, item.unidade);
      return sum + (cost || 0);
    }, 0);
  },

  deleteByProduto(produtoId) {
    this._fichas = this._fichas.filter(f => f.produtoId !== produtoId);
    Stores.fichas.set(this._fichas);
  },

  /* ── Seleção de produto ────────────────────────────────────── */

  selectProduto(produto) {
    this._activeProdutoId = produto.id;
    this._activeProduto   = produto;
    document.querySelectorAll('.ficha-produto-item').forEach(el => {
      el.classList.toggle('active', el.dataset.pid === produto.id);
    });
    this._renderEditor(produto);
  },

  /* ── Lista de produtos (sidebar) ───────────────────────────── */

  _renderProdutoList(produtos, filter = '') {
    const container = document.getElementById('ficha-produto-list');
    if (!container) return;

    const filtered = filter
      ? produtos.filter(p => p.nome.toLowerCase().includes(filter.toLowerCase()))
      : produtos;

    if (!filtered.length) {
      container.innerHTML = '<div style="padding:16px 12px;color:var(--text-muted);font-size:var(--text-sm)">Nenhum produto encontrado.</div>';
      return;
    }

    container.innerHTML = filtered.map(p => `
      <div class="ficha-produto-item ${this._activeProdutoId === p.id ? 'active' : ''}" data-pid="${p.id}">
        <span class="product-photo-icon product-photo-icon--small" title="Foto do produto" aria-label="Foto do produto">
          <svg><use href="#icon-product-photo"></use></svg>
        </span>
        <div class="ficha-produto-item__info">
          <div class="ficha-produto-item__nome">${Utils.escapeHtml(p.nome)}</div>
          <div class="ficha-produto-item__cat">${Utils.escapeHtml(p.categoria)}</div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.ficha-produto-item').forEach(el => {
      el.addEventListener('click', () => {
        const p = produtos.find(p => p.id === el.dataset.pid);
        if (p) this.selectProduto(p);
      });
    });
  },

  _bindSearch(produtos) {
    const input = document.getElementById('ficha-produto-search');
    if (!input) return;
    input.addEventListener('input', Utils.debounce(() => {
      this._renderProdutoList(produtos, input.value);
    }, 200));
  },

  /* ── Editor ────────────────────────────────────────────────── */

  _getOrCreate(produtoId) {
    let ficha = this.getByProduto(produtoId);
    if (!ficha) {
      ficha = { id: `f-${Utils.uid()}`, produtoId, rendimento: 1, itens: [] };
      this._fichas.push(ficha);
      Stores.fichas.set(this._fichas);
    }
    return ficha;
  },

  _renderEditor(produto) {
    const container = document.getElementById('ficha-editor');
    if (!container) return;

    const ficha  = this._getOrCreate(produto.id);
    const custo  = this.calcCusto(ficha);
    const preco  = produto.precoVenda || 0;
    const lucro  = preco - custo;
    const margem = preco ? Math.round((lucro / preco) * 100) : 0;
    const cmvPct = preco ? Math.round((custo / preco) * 100) : 0;
    const cmvW   = Math.min(100, cmvPct);
    const cmvCls = cmvPct > this._cmvGoal
      ? 'cmv-bar__fill--danger'
      : cmvPct > this._cmvGoal * 0.85
        ? 'cmv-bar__fill--warn'
        : '';

    container.innerHTML = `
      <div class="ficha-editor__product-heading">
        <span class="product-photo-icon product-photo-icon--large" title="Foto do produto" aria-label="Foto do produto">
          <svg><use href="#icon-product-photo"></use></svg>
        </span>
        <div>
          <div class="ficha-editor__title">${Utils.escapeHtml(produto.nome)}</div>
          <div class="ficha-editor__sub">${Utils.escapeHtml(produto.categoria)} &middot; Preço de venda: ${Utils.currency(preco)}</div>
        </div>
      </div>

      <div>
        <table class="ficha-table">
          <thead>
            <tr>
              <th style="width:40%">Ingrediente</th>
              <th style="width:90px">Qtd.</th>
              <th style="width:70px">Un.</th>
              <th style="width:110px">Custo Unit.</th>
              <th style="width:90px">Subtotal</th>
              <th style="width:40px"></th>
            </tr>
          </thead>
          <tbody id="ficha-tbody">
            ${ficha.itens.map((item, idx) => this._renderRow(item, idx)).join('')}
          </tbody>
        </table>
        <button class="ficha-table__add" id="ficha-add-item">+ Adicionar ingrediente</button>
      </div>

      <div class="ficha-summary">
        <div>
          <span class="ficha-summary__label">Custo (Ficha)</span>
          <span class="ficha-summary__value ficha-summary__value--gold" id="fs-custo">${Utils.currency(custo)}</span>
        </div>
        <div>
          <span class="ficha-summary__label">Preço de Venda</span>
          <span class="ficha-summary__value">${Utils.currency(preco)}</span>
        </div>
        <div>
          <span class="ficha-summary__label">Lucro Est.</span>
          <span class="ficha-summary__value ${lucro < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'}" id="fs-lucro">${Utils.currency(lucro)}</span>
        </div>
        <div>
          <span class="ficha-summary__label">Margem</span>
          <span class="ficha-summary__value ${margem < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'}" id="fs-margem">${margem}%</span>
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">CMV sobre preço</span>
          <span style="font-size:var(--text-xs);color:var(--text-muted)">meta: ${this._cmvGoal}%</span>
        </div>
        <div class="cmv-bar">
          <div class="cmv-bar__track">
            <div class="cmv-bar__fill ${cmvCls}" id="fs-cmv-fill" style="width:${cmvW}%"></div>
          </div>
          <span class="cmv-bar__value" id="fs-cmv-value">${cmvPct}%</span>
        </div>
      </div>
    `;

    this._bindEditorEvents(ficha, produto);
  },

  _renderRow(item, idx) {
    const ing   = this._ingredientes.find(i => i.id === item.ingredienteId);
    const custo = ing ? calcIngredienteCost(ing, item.quantidade, item.unidade) : null;

    const ingOptions = this._ingredientes.map(i =>
      `<option value="${i.id}" ${i.id === item.ingredienteId ? 'selected' : ''}>${Utils.escapeHtml(i.nome)} (${i.unidade})</option>`
    ).join('');

    const unitOptions = UNIDADES.map(u =>
      `<option value="${u}" ${u === item.unidade ? 'selected' : ''}>${u}</option>`
    ).join('');

    return `
      <tr data-idx="${idx}">
        <td>
          <select class="ficha-ing-select" data-field="ingredienteId">
            <option value="">— selecione —</option>
            ${ingOptions}
          </select>
        </td>
        <td>
          <input type="number" class="ficha-qty-input" data-field="quantidade"
            value="${item.quantidade || ''}" step="0.001" min="0">
        </td>
        <td>
          <select class="ficha-unit-select" data-field="unidade">
            ${unitOptions}
          </select>
        </td>
        <td style="color:var(--text-muted);font-size:var(--text-sm)">
          ${ing ? `${Utils.currency(ing.custoUnitario)}/${ing.unidade}` : '—'}
        </td>
        <td style="font-weight:600;font-size:var(--text-sm)">
          ${custo !== null ? Utils.currency(custo) : '—'}
        </td>
        <td>
          <button class="btn-icon btn-icon--danger" data-action="remove-item" data-idx="${idx}" title="Remover">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  },

  _bindEditorEvents(ficha, produto) {
    const container = document.getElementById('ficha-editor');
    if (!container) return;

    document.getElementById('ficha-add-item')?.addEventListener('click', () => {
      ficha.itens.push({ ingredienteId: '', quantidade: 0, unidade: 'g' });
      Stores.fichas.set(this._fichas);
      this._renderEditor(produto);
    });

    container.querySelectorAll('[data-action="remove-item"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        ficha.itens.splice(idx, 1);
        Stores.fichas.set(this._fichas);
        this._renderEditor(produto);
      });
    });

    const tbody = document.getElementById('ficha-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('[data-field]').forEach(el => {
      const ev = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, e => {
        const row   = e.target.closest('tr[data-idx]');
        if (!row) return;
        const idx   = parseInt(row.dataset.idx, 10);
        const field = el.dataset.field;
        const val   = e.target.value;

        if (field === 'quantidade') {
          ficha.itens[idx].quantidade = parseFloat(val) || 0;
          Stores.fichas.set(this._fichas);
          this._refreshSummary(ficha, produto);
        } else if (field === 'unidade') {
          ficha.itens[idx].unidade = val;
          Stores.fichas.set(this._fichas);
          this._refreshSummary(ficha, produto);
        } else if (field === 'ingredienteId') {
          ficha.itens[idx].ingredienteId = val;
          const ing = this._ingredientes.find(i => i.id === val);
          if (ing) ficha.itens[idx].unidade = ing.unidade;
          Stores.fichas.set(this._fichas);
          this._renderEditor(produto);
        }
      });
    });
  },

  _refreshSummary(ficha, produto) {
    const custo  = this.calcCusto(ficha);
    const preco  = produto.precoVenda || 0;
    const lucro  = preco - custo;
    const margem = preco ? Math.round((lucro / preco) * 100) : 0;
    const cmvPct = preco ? Math.round((custo / preco) * 100) : 0;
    const cmvW   = Math.min(100, cmvPct);
    const cmvCls = cmvPct > this._cmvGoal
      ? 'cmv-bar__fill--danger'
      : cmvPct > this._cmvGoal * 0.85
        ? 'cmv-bar__fill--warn'
        : '';

    const $ = id => document.getElementById(id);
    const setCls = (el, base, cls) => { if (el) el.className = `${base} ${cls}`; };

    if ($('fs-custo'))    $('fs-custo').textContent    = Utils.currency(custo);
    if ($('fs-lucro'))  { $('fs-lucro').textContent  = Utils.currency(lucro);  setCls($('fs-lucro'),  'ficha-summary__value', lucro  < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'); }
    if ($('fs-margem')) { $('fs-margem').textContent = `${margem}%`;           setCls($('fs-margem'), 'ficha-summary__value', margem < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'); }
    if ($('fs-cmv-fill')) {
      $('fs-cmv-fill').style.width = `${cmvW}%`;
      $('fs-cmv-fill').className   = `cmv-bar__fill ${cmvCls}`;
    }
    if ($('fs-cmv-value')) $('fs-cmv-value').textContent = `${cmvPct}%`;
  },
};
