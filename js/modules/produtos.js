/* ============================================================
   Petisbar Teodoro — Módulo Produtos
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
  _serverMode: false,
  _canWrite: true,
  _photoDraft: null,
  _photoRemove: false,
  _photoPreviewUrl: null,

  /* ── Inicialização ─────────────────────────────────────────── */

  async init() {
    this._serverMode = API.isServerMode();
    this._canWrite = !this._serverMode || API.hasPermission('catalog.write');
    if (this._serverMode) {
      const tbody = document.getElementById('tbody-cardapio');
      if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted)">Carregando catálogo…</td></tr>';
      try {
        const [produtos, ingredientes, fichas, receitasCurso] = await Promise.all([
          API.getServerProducts(),
          API.getServerIngredients(),
          API.getServerTechnicalSheets(),
          API.getServerRecipeCards(),
        ]);
        this._items = produtos;
        IngredientesModule.setItems(ingredientes);
        FichasModule.setData({ ingredientes, fichas, receitasCurso });
      } catch (error) {
        UI.toast('Falha ao carregar catálogo do servidor.', 'danger');
        this._items = [];
      }
    } else {
      this._items = Stores.produtos.get();
      FichasModule.preload();
    }
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
      IngredientesModule.init(this._serverMode ? IngredientesModule._items : null);
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
          <td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted);font-size:var(--text-sm)">
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

      const custoStr    = custo !== null
        ? `<div>${Utils.currency(custo)}</div>${p.precoStatus ? `<div style="font-size:var(--text-xs);color:${p.precoStatus === 'provisório' ? 'var(--color-warning)' : 'var(--text-muted)'}">${Utils.escapeHtml(p.precoStatus)} · ${p.precoRevisadoEm ? Utils.formatDate(p.precoRevisadoEm) : ''}</div>` : ''}${p.fontePreco ? `<a href="${Utils.escapeHtml(p.fontePreco)}" target="_blank" rel="noopener" style="font-size:var(--text-xs)">ver fonte</a>` : ''}`
        : '<span style="color:var(--text-muted)">—</span>';
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
            <div class="product-name-cell">
              ${Utils.productPhoto(p)}
              <div>
                <div style="font-weight:600;color:var(--text-primary)">${Utils.escapeHtml(p.nome)}</div>
                ${p.sku ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.escapeHtml(p.sku)}</div>` : (p.codigo ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.escapeHtml(p.codigo)}</div>` : '')}
              </div>
            </div>
          </td>
          <td style="color:var(--text-muted)">${Utils.escapeHtml(p.categoria)}</td>
          <td style="font-weight:600">${Utils.currency(p.precoVenda)}</td>
          <td><strong>${Utils.currency(p.precoIfood ?? Math.ceil((p.precoVenda / 0.738) * 100) / 100)}</strong><div style="font-size:var(--text-xs);color:var(--text-muted)">${p.ativoIfood ? 'Ativo' : 'Aguardando integração'}</div></td>
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
        ${this._canWrite ? `
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
        ` : '<span style="color:var(--text-muted);font-size:var(--text-sm)">Somente leitura</span>'}
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
    this._releaseProductPhotoPreview();
    this._photoDraft = null;
    this._photoRemove = false;

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
            <input class="form-input" name="nome" required placeholder="ex: Caipirinha de Limão 500ml"
              value="${Utils.escapeHtml(item?.nome || '')}">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Categoria *</label>
              <select class="form-select" name="categoria" required>${catOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Código</label>
              <input class="form-input" name="codigo" placeholder="ex: CAI-LIM"
                value="${Utils.escapeHtml(item?.codigo || '')}">
            </div>
          </div>

          <div style="padding:var(--sp-3);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:var(--sp-3)">
            <div class="form-group">
              <label class="form-label">Preço no iFood — Plano Entrega (R$)</label>
              <input class="form-input" name="precoIfood" type="number" step="0.01" min="0.01"
                value="${item?.precoIfood ?? (item?.precoVenda ? Math.ceil((item.precoVenda / 0.738) * 100) / 100 : '')}">
              <small style="color:var(--text-muted)">Sugestão para preservar o valor líquido após 23% + 3,2%. Mensalidade não incluída.</small>
            </div>
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer"><input type="checkbox" name="ativoIfood" value="true" ${item?.ativoIfood ? 'checked' : ''}><span class="form-label" style="margin:0">Disponível no iFood após ativar a integração</span></label>
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
            <label class="form-label" for="product-photo-file">Imagem do produto</label>
            <div class="product-photo-editor">
              <div id="product-photo-preview">${Utils.productPhoto(item || { nome: 'Produto', foto: '' }, 'product-photo-icon--editor')}</div>
              <div class="product-photo-editor__controls">
                <input class="form-input" id="product-photo-file" type="file" accept="image/jpeg,image/png,image/webp">
                <small>Escolha uma foto JPG, PNG ou WebP. Ela será ajustada para o cardápio e salva no VPS.</small>
                <button type="button" class="btn btn-secondary btn-sm" id="remove-product-photo">Remover imagem</button>
                <small id="product-photo-status" aria-live="polite">${item?.foto ? 'Imagem atual do produto.' : 'Nenhuma imagem personalizada.'}</small>
              </div>
            </div>
          </div>

          <div class="form-group"><label class="form-label">Opções para o cliente</label><div id="product-option-groups"></div><button type="button" class="btn btn-secondary btn-sm" id="add-product-option-group">+ Grupo de opções</button><small style="display:block;margin-top:8px;color:var(--text-muted)">Preços usam o cadastro do produto escolhido no ERP. Escolha “Somar” para adicional ou “Substituir” para variação de preço.</small></div>

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
    this._bindProductPhotoEditor(item);
    this._drawOptionGroups(item?.optionGroups||[]);
    document.getElementById('product-option-groups').addEventListener('click',event=>{
      const button=event.target.closest('[data-option-action]');if(!button)return;
      const groups=this._collectOptionGroups(),groupIndex=Number(button.dataset.group),optionIndex=Number(button.dataset.option),action=button.dataset.optionAction;
      if(action==='add-group')groups.push({key:`grupo${groups.length+1}`,label:'Novo grupo',type:'radio',required:false,options:[{value:'opcao1',label:'Opção 1',priceMode:'base'}]});
      if(action==='remove-group')groups.splice(groupIndex,1);
      if(action==='add-option')groups[groupIndex]?.options.push({value:`opcao${groups[groupIndex].options.length+1}`,label:'Nova opção',priceMode:'base'});
      if(action==='remove-option')groups[groupIndex]?.options.splice(optionIndex,1);
      this._drawOptionGroups(groups);
    });
    document.getElementById('add-product-option-group').addEventListener('click',()=>{const groups=this._collectOptionGroups();groups.push({key:`grupo${groups.length+1}`,label:'Novo grupo',type:'radio',required:false,options:[{value:'opcao1',label:'Opção 1',priceMode:'base'}]});this._drawOptionGroups(groups)});
  },

  _collectOptionGroups(){return [...document.querySelectorAll('[data-option-group]')].map(group=>({
    key:group.querySelector('[data-option-key]').value.trim(),label:group.querySelector('[data-option-label]').value.trim(),
    type:group.querySelector('[data-option-type]').value,required:group.querySelector('[data-option-required]').checked,
    options:[...group.querySelectorAll('[data-option-row]')].map(row=>({value:row.querySelector('[data-option-value]').value.trim(),label:row.querySelector('[data-option-text]').value.trim(),priceMode:row.querySelector('[data-option-price-mode]').value,stockMode:row.querySelector('[data-option-stock-mode]').value,priceProductId:row.querySelector('[data-option-product]').value||null})),
  }))},

  _releaseProductPhotoPreview() {
    if (this._photoPreviewUrl) URL.revokeObjectURL(this._photoPreviewUrl);
    this._photoPreviewUrl = null;
  },

  _renderProductPhotoPreview(photo, name, objectUrl = null) {
    const preview = document.getElementById('product-photo-preview');
    if (!preview) return;
    this._releaseProductPhotoPreview();
    if (objectUrl) {
      this._photoPreviewUrl = objectUrl;
      preview.innerHTML = `<span class="product-photo-icon product-photo-icon--editor"><img src="${Utils.escapeHtml(objectUrl)}" alt="Prévia da foto de ${Utils.escapeHtml(name)}"></span>`;
      return;
    }
    preview.innerHTML = Utils.productPhoto({ nome: name, foto: photo || '' }, 'product-photo-icon--editor');
  },

  async _encodeProductPhoto(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
    if (file.size > 12 * 1024 * 1024) throw new Error('A imagem deve ter até 12 MB antes do ajuste.');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1400 / bitmap.width, 1400 / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível processar a imagem.')), 'image/jpeg', 0.84));
      if (blob.size > 1_000_000) throw new Error('A foto continua muito grande após o ajuste. Escolha outra imagem.');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Não foi possível preparar a imagem.'));
        reader.readAsDataURL(blob);
      });
      return { dataUrl, blob };
    } finally { bitmap.close(); }
  },

  _bindProductPhotoEditor(item) {
    const input = document.getElementById('product-photo-file');
    const status = document.getElementById('product-photo-status');
    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const previousDraft = this._photoDraft;
      try {
        this._photoDraft = await this._encodeProductPhoto(file);
        this._photoRemove = false;
        this._renderProductPhotoPreview('', item?.nome || document.querySelector('[name="nome"]')?.value || 'Produto', URL.createObjectURL(this._photoDraft.blob));
        if (status) status.textContent = `Prévia pronta: ${file.name}`;
      } catch (error) {
        input.value = '';
        this._photoDraft = previousDraft;
        UI.toast(error.message || 'Não foi possível carregar essa imagem.', 'danger');
      }
    });
    document.getElementById('remove-product-photo')?.addEventListener('click', () => {
      input.value = '';
      this._photoDraft = null;
      this._photoRemove = true;
      this._renderProductPhotoPreview('', item?.nome || document.querySelector('[name="nome"]')?.value || 'Produto');
      if (status) status.textContent = 'A imagem personalizada será removida ao salvar.';
    });
  },

  _drawOptionGroups(groups){
    const container=document.getElementById('product-option-groups');if(!container)return;
    const products=this._items;
    container.innerHTML=groups.map((group,index)=>`<section class="product-option-group" data-option-group><header><strong>Grupo ${index+1}</strong><button type="button" class="btn btn-secondary btn-sm" data-option-action="remove-group" data-group="${index}">Remover grupo</button></header><div class="product-option-grid"><label>Identificador<input class="form-input" data-option-key value="${Utils.escapeHtml(group.key||'')}" placeholder="tamanho"></label><label>Nome exibido<input class="form-input" data-option-label value="${Utils.escapeHtml(group.label||'')}" placeholder="Escolha o tamanho"></label><label>Seleção<select class="form-select" data-option-type><option value="radio" ${group.type!=='checkbox'?'selected':''}>Uma opção</option><option value="checkbox" ${group.type==='checkbox'?'selected':''}>Várias opções</option></select></label><label class="product-option-required"><input type="checkbox" data-option-required ${group.required?'checked':''}> Obrigatório</label></div>${(group.options||[]).map((option,optionIndex)=>`<div class="product-option-row" data-option-row><label>Valor interno<input class="form-input" data-option-value value="${Utils.escapeHtml(option.value||'')}" placeholder="G"></label><label>Nome para cliente<input class="form-input" data-option-text value="${Utils.escapeHtml(option.label||'')}" placeholder="Grande"></label><label>Preço<select class="form-select" data-option-price-mode><option value="base" ${option.priceMode==='base'?'selected':''}>Preço base</option><option value="replace" ${option.priceMode==='replace'?'selected':''}>Substituir</option><option value="add" ${option.priceMode==='add'?'selected':''}>Somar</option></select></label><label>Produto de preço<select class="form-select" data-option-product><option value="">Sem produto</option>${products.map(product=>`<option value="${Utils.escapeHtml(product.id)}" ${option.priceProductId===product.id?'selected':''}>${Utils.escapeHtml(product.nome)} · ${Utils.currency(product.precoVenda)}${product.ativo?'':' (inativo)'}</option>`).join('')}</select></label><label>Estoque<select class="form-select" data-option-stock-mode><option value="none" ${(option.stockMode||'none')==='none'?'selected':''}>Sem alteração</option><option value="replace" ${option.stockMode==='replace'?'selected':''}>Substituir item/receita</option><option value="add" ${option.stockMode==='add'?'selected':''}>Consumir junto</option></select></label><button type="button" class="btn btn-secondary btn-sm" data-option-action="remove-option" data-group="${index}" data-option="${optionIndex}">×</button></div>`).join('')}<button type="button" class="btn btn-secondary btn-sm" data-option-action="add-option" data-group="${index}">+ Opção</button></section>`).join('');
  },

  async _submitForm(editing, original) {
    const form = document.getElementById('form-produto');
    if (!form) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd        = new FormData(form);
    const nome      = fd.get('nome').trim();
    const precoVenda = parseFloat(fd.get('precoVenda'));
    const optionGroups=this._collectOptionGroups();

    if (!nome)              { UI.toast('Nome é obrigatório', 'danger'); return; }
    if (!precoVenda || precoVenda <= 0) { UI.toast('Preço deve ser maior que zero', 'danger'); return; }

    const data = {
      ...original,
      id:           fd.get('id') || `p-${Utils.uid()}`,
      nome,
      categoria:    fd.get('categoria'),
      codigo:       fd.get('codigo').trim(),
      descricao:    fd.get('descricao').trim(),
      precoVenda,
      optionGroups,
      precoIfood:   parseFloat(fd.get('precoIfood')) || Math.ceil((precoVenda / 0.738) * 100) / 100,
      ativoIfood:   fd.get('ativoIfood') === 'true',
      tempoPreparo: parseFloat(fd.get('tempoPreparo')) || 0,
      peso:         parseFloat(fd.get('peso')) || 0,
      dataCadastro: fd.get('dataCadastro') || Utils.today(),
      ativo:        fd.get('ativo') === 'true',
      foto:         this._photoDraft?.dataUrl || (this._photoRemove ? null : original?.foto || ''),
      fotoProvisoria: this._photoDraft ? false : (this._photoRemove ? true : original?.fotoProvisoria || false),
    };

    if (this._serverMode) {
      try {
        const saved = await API.saveServerProduct(data);
        const idx = this._items.findIndex(p => p.id === saved.id);
        if (idx >= 0) this._items[idx] = saved;
        else this._items.push(saved);
        UI.toast(editing ? 'Produto atualizado' : 'Produto cadastrado', 'success');
        this._releaseProductPhotoPreview();
        UI.closeModal();
        this._render();
      } catch (error) {
        const messages = {
          validation_error: 'Revise os campos do produto.',
          product_used_by_active_promotion: 'Este produto está em uma promoção ativa. Encerre a promoção antes de desativá-lo.',
          product_used_by_product_options: 'Este produto está vinculado às opções de outro produto. Remova o vínculo antes de desativá-lo.',
          product_option_price_product_missing: 'Uma opção do produto aponta para um cadastro inexistente. Revise os grupos de opções.',
          product_photo_invalid: 'A imagem não foi aceita. Escolha uma foto JPG, PNG ou WebP e tente novamente.',
        };
        const message = messages[error.code]
          || (error.status ? `Não foi possível salvar o produto (erro ${error.status}${error.code ? `: ${error.code}` : ''}).` : 'Não foi possível salvar o produto. Verifique a conexão e tente novamente.');
        UI.toast(message, 'danger');
      }
      return;
    }

    const idx = this._items.findIndex(p => p.id === data.id);
    if (idx >= 0) {
      this._items[idx] = data;
      UI.toast('Produto atualizado', 'success');
    } else {
      this._items.push(data);
      UI.toast('Produto cadastrado', 'success');
    }

    Stores.produtos.set(this._items);
    this._releaseProductPhotoPreview();
    UI.closeModal();
    this._render();
  },

  /* ── Duplicar ──────────────────────────────────────────────── */

  async _duplicate(id) {
    const item = this._items.find(p => p.id === id);
    if (!item) return;

    const copy = {
      ...item,
      id:           `p-${Utils.uid()}`,
      nome:         `${item.nome} (cópia)`,
      codigo:       item.codigo ? `${item.codigo}-C` : '',
      dataCadastro: Utils.today(),
    };
    if (this._serverMode) {
      try {
        const saved = await API.saveServerProduct(copy);
        this._items.push(saved);
        UI.toast('Produto duplicado', 'success');
        this._render();
      } catch {
        UI.toast('Não foi possível duplicar o produto.', 'danger');
      }
      return;
    }

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
      onConfirm: async () => {
        if (this._serverMode) {
          try {
            const saved = await API.deactivateServerProduct(id);
            const idx = this._items.findIndex(p => p.id === id);
            if (idx >= 0) this._items[idx] = saved;
            UI.closeModal();
            UI.toast('Produto inativado', 'info');
            this._render();
          } catch {
            UI.toast('Não foi possível inativar o produto.', 'danger');
          }
          return;
        }
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
      newBtn.hidden = !this._canWrite;
      if (!this._canWrite) return;
      newBtn.addEventListener('click', () => this._openForm());
    }
  },
};
