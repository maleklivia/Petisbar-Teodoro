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
  _receitasCurso: [],
  _serverMode: false,
  _canWrite: true,
  _saveTimers: new Map(),
  _saveQueues: new Map(),

  _draftKey(produtoId) {
    return `petisbar-preparo-pendente:${produtoId}`;
  },

  _readDraft(produtoId) {
    try {
      const value = JSON.parse(localStorage.getItem(this._draftKey(produtoId)) || 'null');
      return value && typeof value.modoPreparo === 'string' ? value.modoPreparo : null;
    } catch {
      return null;
    }
  },

  _saveStatus(produtoId, message, state) {
    const status = document.getElementById('ficha-preparo-status');
    if (!status || this._activeProdutoId !== produtoId) return;
    status.textContent = message;
    status.dataset.state = state;
  },

  /* ── Inicialização ─────────────────────────────────────────── */

  init(produtos) {
    this._serverMode = API.isServerMode();
    this._canWrite = !this._serverMode || API.hasPermission('catalog.write');
    this._allProdutos = produtos;
    if (!this._serverMode) {
      this._ingredientes = Stores.ingredientes.get();
      this._fichas = Stores.fichas.get();
    }
    this._cmvGoal = (Storage.getState().settings || {}).cmvGoal || 35;
    this._renderProdutoList(produtos);
    this._renderCourseRecipes();
    this._bindSearch(produtos);

    // Re-seleciona produto ativo se houver
    if (this._activeProdutoId) {
      const p = produtos.find(p => p.id === this._activeProdutoId);
      if (p) this.selectProduto(p);
    }
  },

  /* ── API pública usada por ProdutosModule ──────────────────── */

  preload() {
    this._serverMode = API.isServerMode();
    this._ingredientes = Stores.ingredientes.get();
    this._fichas       = Stores.fichas.get();
  },

  setData({ ingredientes, fichas, receitasCurso } = {}) {
    if (ingredientes) this._ingredientes = ingredientes;
    if (fichas) this._fichas = fichas;
    if (receitasCurso) this._receitasCurso = receitasCurso;
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

  _persist(ficha, { debounce = false } = {}) {
    if (!this._serverMode) {
      Stores.fichas.set(this._fichas);
      return;
    }
    if (!this._canWrite || !ficha?.produtoId) return;
    const save = () => {
      const produtoId = ficha.produtoId;
      this._saveStatus(produtoId, 'Salvando no VPS…', 'saving');
      const previous = this._saveQueues.get(produtoId) || Promise.resolve();
      const pending = previous.catch(() => {}).then(async () => {
        const submitted = structuredClone(ficha);
        const saved = await API.saveServerTechnicalSheet(submitted);
        ficha.dataAtualizacao = saved.dataAtualizacao;
        if (this._readDraft(produtoId) === submitted.modoPreparo) {
          localStorage.removeItem(this._draftKey(produtoId));
          this._saveStatus(produtoId, 'Salvo no VPS.', 'saved');
        } else if (this._readDraft(produtoId) !== null) {
          this._saveStatus(produtoId, 'Alterações pendentes de envio ao VPS.', 'pending');
        } else {
          this._saveStatus(produtoId, 'Salvo no VPS.', 'saved');
        }
      }).catch(() => {
        UI.toast('Não foi possível salvar a ficha técnica.', 'danger');
        this._saveStatus(produtoId, 'Falha no envio. O rascunho continua neste navegador; tente salvar novamente.', 'error');
      });
      this._saveQueues.set(produtoId, pending);
    };
    if (!debounce) {
      save();
      return;
    }
    clearTimeout(this._saveTimers.get(ficha.produtoId));
    this._saveTimers.set(ficha.produtoId, setTimeout(save, 500));
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
        ${Utils.productPhoto(p, 'product-photo-icon--small')}
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

  _renderCourseRecipes() {
    const container=document.getElementById('course-recipes-list');
    const count=document.getElementById('course-recipes-count');
    if(!container)return;
    const section=container.closest('.course-recipes');
    if(section)section.hidden=!this._serverMode;
    if(!this._serverMode)return;
    const cards=this._receitasCurso||[];
    if(count)count.textContent=cards.length?`${cards.length} fichas`:'';
    if(!cards.length){
      container.innerHTML='<p class="course-recipes__empty">As receitas do curso aparecerão aqui após a atualização do banco do ERP.</p>';
      return;
    }
    const statusLabel=status=>status==='draft'?'Rascunho':status==='ready'?'Completa':'Incompleta';
    const quantity=item=>item.quantity===null?'Quantidade pendente':`${item.quantity} ${item.unit||''}`.trim();
    container.innerHTML=cards.map(card=>{
      const cost=card.cost||{};
      const costLabel=cost.complete
        ? card.recipeType==='preparation'
          ? `Lote: ${Utils.currency(cost.total)}${card.outputYield?` · ${Utils.currency(cost.unit)} por ${card.outputUnit||'unidade'}`:''}`
          : `Custo calculado: ${Utils.currency(cost.total)}`
        : cost.partialTotal>0?`Custo parcial: ${Utils.currency(cost.partialTotal)} · não é custo final`:'Custo final indisponível';
      return `<details class="course-recipe ${card.status==='draft'?'course-recipe--draft':'course-recipe--incomplete'}">
        <summary>
          <span class="course-recipe__identity"><strong>${Utils.escapeHtml(card.code)} · ${Utils.escapeHtml(card.name)}</strong><small>${card.recipeType==='preparation'?'Preparação intermediária':'Produto'}${card.linkedProductName?` · associado a ${Utils.escapeHtml(card.linkedProductName)}`:''}</small></span>
          <span class="course-recipe__state">${statusLabel(card.status)}</span>
        </summary>
        <div class="course-recipe__body">
          <div class="course-recipe__cost">${Utils.escapeHtml(costLabel)}</div>
          ${card.packagingCapacity?`<p class="course-recipe__note">Embalagem com capacidade de ${card.packagingCapacity} ${Utils.escapeHtml(card.packagingCapacityUnit||'')}; capacidade não representa peso do produto.</p>`:''}
          ${card.preparationMethod?`<p><strong>Preparo:</strong> ${Utils.escapeHtml(card.preparationMethod)}</p>`:''}
          <ul>${(card.items||[]).map(item=>`<li><span>${Utils.escapeHtml(item.itemName)}${item.isPackaging?' (material de venda)':''}</span><span>${Utils.escapeHtml(quantity(item))}</span>${item.pendingNote?`<small>${Utils.escapeHtml(item.pendingNote)}</small>`:''}</li>`).join('')}</ul>
          ${cost.notes?.length?`<div class="course-recipe__pending"><strong>Pendências de custo:</strong><ul>${cost.notes.map(note=>`<li>${Utils.escapeHtml(note)}</li>`).join('')}</ul></div>`:''}
          ${card.pendingNotes?`<p class="course-recipe__note"><strong>Observação:</strong> ${Utils.escapeHtml(card.pendingNotes)}</p>`:''}
          <small class="course-recipe__source">Fonte: ${Utils.escapeHtml(card.source||'material do curso')}</small>
        </div>
      </details>`;
    }).join('');
  },

  /* ── Editor ────────────────────────────────────────────────── */

  _getOrCreate(produtoId) {
    let ficha = this.getByProduto(produtoId);
    if (!ficha) {
      ficha = { id: `f-${Utils.uid()}`, produtoId, rendimento: 1, modoPreparo: '', itens: [] };
      this._fichas.push(ficha);
      this._persist(ficha, { debounce: true });
    }
    return ficha;
  },

  _renderEditor(produto) {
    const container = document.getElementById('ficha-editor');
    if (!container) return;

    const ficha  = this._getOrCreate(produto.id);
    const draft = this._serverMode ? this._readDraft(produto.id) : null;
    if (draft !== null && draft !== ficha.modoPreparo) ficha.modoPreparo = draft;
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
        ${Utils.productPhoto(produto, 'product-photo-icon--large')}
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
        <button class="ficha-table__add" id="ficha-add-item" ${this._canWrite ? '' : 'disabled'}>+ Adicionar ingrediente</button>
      </div>

      <div class="ficha-preparo">
        <label class="form-label" for="ficha-modo-preparo">Modo de preparo</label>
        <textarea class="form-input ficha-preparo__input" id="ficha-modo-preparo"
          rows="7" maxlength="10000" placeholder="Descreva o passo a passo de preparo e finalização deste produto."
          ${this._canWrite ? '' : 'disabled'}>${Utils.escapeHtml(ficha.modoPreparo || '')}</textarea>
        ${this._serverMode
          ? `<div class="ficha-preparo__feedback">
               <p class="ficha-preparo__status" id="ficha-preparo-status" role="status"
                 data-state="${draft !== null ? 'pending' : 'saved'}">${draft !== null ? 'Rascunho local pendente de envio ao VPS.' : 'Dados carregados do VPS.'}</p>
               <button class="btn btn-ghost" id="ficha-salvar-preparo" type="button" ${this._canWrite ? '' : 'disabled'}>Salvar no VPS</button>
             </div>`
          : `<p class="ficha-preparo__status" data-state="pending">Modo local: o texto fica somente neste navegador. Para salvar no VPS, use <a href="https://177-153-67-250.nip.io/pages/produtos.html">o ERP no VPS</a>.</p>`}
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
          <button class="btn-icon btn-icon--danger" data-action="remove-item" data-idx="${idx}" title="Remover" ${this._canWrite ? '' : 'disabled'}>
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

    document.getElementById('ficha-modo-preparo')?.addEventListener('input', event => {
      if (!this._canWrite) return;
      ficha.modoPreparo = event.target.value;
      if (this._serverMode) {
        try {
          localStorage.setItem(this._draftKey(ficha.produtoId), JSON.stringify({ modoPreparo: ficha.modoPreparo }));
          this._saveStatus(ficha.produtoId, 'Rascunho guardado neste navegador; enviando ao VPS…', 'pending');
        } catch {
          this._saveStatus(ficha.produtoId, 'Não foi possível guardar rascunho local. Confirme o salvamento no VPS antes de sair.', 'error');
        }
      }
      this._persist(ficha, { debounce: true });
    });

    document.getElementById('ficha-salvar-preparo')?.addEventListener('click', () => {
      if (!this._canWrite) return;
      clearTimeout(this._saveTimers.get(ficha.produtoId));
      this._persist(ficha);
    });

    document.getElementById('ficha-add-item')?.addEventListener('click', () => {
      if (!this._canWrite) return;
      ficha.itens.push({ ingredienteId: '', quantidade: 0, unidade: 'g' });
      this._persist(ficha, { debounce: true });
      this._renderEditor(produto);
    });

    container.querySelectorAll('[data-action="remove-item"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this._canWrite) return;
        const idx = parseInt(btn.dataset.idx, 10);
        ficha.itens.splice(idx, 1);
        this._persist(ficha, { debounce: true });
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
        if (!this._canWrite) return;

        if (field === 'quantidade') {
          ficha.itens[idx].quantidade = parseFloat(val) || 0;
          this._persist(ficha, { debounce: true });
          this._refreshSummary(ficha, produto);
        } else if (field === 'unidade') {
          ficha.itens[idx].unidade = val;
          this._persist(ficha, { debounce: true });
          this._refreshSummary(ficha, produto);
        } else if (field === 'ingredienteId') {
          ficha.itens[idx].ingredienteId = val;
          const ing = this._ingredientes.find(i => i.id === val);
          if (ing) ficha.itens[idx].unidade = ing.unidade;
          this._persist(ficha, { debounce: true });
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
