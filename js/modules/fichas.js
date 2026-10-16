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
  _activeCourseRecipeId: null,
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
    this._bindSearch(produtos);

    // Re-seleciona produto ativo se houver
    if (this._activeProdutoId) {
      const p = produtos.find(p => p.id === this._activeProdutoId);
      if (p) this.selectProduto(p);
    } else if(this._activeCourseRecipeId){
      const card=this._receitasCurso.find(item=>item.id===this._activeCourseRecipeId);
      if(card)this.selectCourseRecipe(card);
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
      if (ing) {
        const cost = calcIngredienteCost(ing, item.quantidade, item.unidade);
        return sum + (cost || 0);
      }
      const prep = this._receitasCurso.find(i => i.id === item.preparacaoId);
      if (!prep || prep.cost?.partialUnit == null) return sum;
      const cost = calcIngredienteCost({ unidade: prep.outputUnit, custoUnitario: prep.cost.partialUnit }, item.quantidade, item.unidade);
      return sum + (cost || 0);
    }, 0);
  },

  _costComplete(ficha) {
    if (!ficha?.itens?.length) return false;
    return ficha.itens.every(item => {
      if (!(Number(item.quantidade) > 0) || !(item.unidade || '').trim()) return false;
      const hasIngredient = Boolean(item.ingredienteId);
      const hasPreparation = Boolean(item.preparacaoId);
      if (hasIngredient === hasPreparation) return false;
      if (hasIngredient) {
        const ingredient = this._ingredientes.find(row => row.id === item.ingredienteId && row.ativo);
        return Boolean(ingredient && Number(ingredient.custoUnitario) > 0 && calcIngredienteCost(ingredient, Number(item.quantidade), item.unidade) !== null);
      }
      const preparation = this._receitasCurso.find(row => row.id === item.preparacaoId && row.recipeType === 'preparation');
      return Boolean(preparation && preparation.status === 'ready' && preparation.cost?.complete && preparation.cost?.unit != null
        && calcIngredienteCost({ unidade: preparation.outputUnit, custoUnitario: preparation.cost.unit }, Number(item.quantidade), item.unidade) !== null);
    });
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
    this._activeCourseRecipeId = null;
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

    const query=filter.trim().toLocaleLowerCase('pt-BR');
    const filtered = filter
      ? produtos.filter(p => p.nome.toLocaleLowerCase('pt-BR').includes(query))
      : produtos;
    const courseCards=this._serverMode?(this._receitasCurso||[]).filter(card=>!query||`${card.name} ${card.code}`.toLocaleLowerCase('pt-BR').includes(query)):[];

    if (!filtered.length&&!courseCards.length) {
      container.innerHTML = '<div style="padding:16px 12px;color:var(--text-muted);font-size:var(--text-sm)">Nenhum produto encontrado.</div>';
      return;
    }

    container.innerHTML = `${filtered.map(p => `
      <div class="ficha-produto-item ${this._activeProdutoId === p.id ? 'active' : ''}" data-pid="${p.id}">
        ${Utils.productPhoto(p, 'product-photo-icon--small')}
        <div class="ficha-produto-item__info">
          <div class="ficha-produto-item__nome">${Utils.escapeHtml(p.nome)}</div>
          <div class="ficha-produto-item__cat">${Utils.escapeHtml(p.categoria)}</div>
        </div>
      </div>
    `).join('')}${courseCards.length?`<div class="ficha-list-heading">Preparações e receitas</div>${courseCards.map(card=>`
      <button type="button" class="ficha-produto-item ${this._activeCourseRecipeId===card.id?'active':''}" data-course-id="${Utils.escapeHtml(card.id)}">
        <span class="ficha-course-icon">ƒ</span><span class="ficha-produto-item__info"><span class="ficha-produto-item__nome">${Utils.escapeHtml(card.name)}</span><span class="ficha-produto-item__cat">${Utils.escapeHtml(card.code)} · ${card.recipeType==='preparation'?'Preparação':'Produto'} · ${card.status==='ready'?'Completa':card.status==='draft'?'Rascunho':'Incompleta'}</span></span>
      </button>`).join('')}`:''}`;

    container.querySelectorAll('[data-pid]').forEach(el => el.addEventListener('click', () => {
      const p = produtos.find(p => p.id === el.dataset.pid);
      if (p) this.selectProduto(p);
    }));
    container.querySelectorAll('[data-course-id]').forEach(el => el.addEventListener('click', () => {
      const card=this._receitasCurso.find(item=>item.id===el.dataset.courseId);
      if(card)this.selectCourseRecipe(card);
    }));
  },

  _bindSearch(produtos) {
    const input = document.getElementById('ficha-produto-search');
    if (!input) return;
    input.addEventListener('input', Utils.debounce(() => {
      this._renderProdutoList(produtos, input.value);
    }, 200));
  },

  selectCourseRecipe(card){
    this._activeProdutoId=null;
    this._activeProduto=null;
    this._activeCourseRecipeId=card.id;
    document.querySelectorAll('.ficha-produto-item').forEach(el=>el.classList.toggle('active',el.dataset.courseId===card.id));
    this._renderCourseRecipeEditor(card);
  },

  _renderCourseRecipeEditor(card){
    const container=document.getElementById('ficha-editor');
    if(!container)return;
    const items=card.items||[];
    const cost=card.cost||{};
    const disabled=this._canWrite?'':'disabled';
    container.innerHTML=`<div class="ficha-editor__product-heading"><span class="ficha-course-icon ficha-course-icon--large">ƒ</span><div><div class="ficha-editor__title">${Utils.escapeHtml(card.name)}</div><div class="ficha-editor__sub">${Utils.escapeHtml(card.code)} · ${card.recipeType==='preparation'?'Preparação intermediária':'Receita de produto'} · ${card.status==='ready'?'Completa':card.status==='draft'?'Rascunho':'Incompleta'}</div></div></div>
      <div class="ficha-course-meta"><label>Rendimento<input data-card-field="outputYield" type="number" min="0.001" step="any" value="${card.outputYield??''}" placeholder="Pesar rendimento" ${disabled}></label><label>Unidade<input data-card-field="outputUnit" value="${Utils.escapeHtml(card.outputUnit||'')}" placeholder="g, ml, un" ${disabled}></label><label>Capacidade da embalagem<input data-card-field="packagingCapacity" type="number" min="0.001" step="any" value="${card.packagingCapacity??''}" ${disabled}></label><label>Unidade da embalagem<input data-card-field="packagingCapacityUnit" value="${Utils.escapeHtml(card.packagingCapacityUnit||'')}" placeholder="ml" ${disabled}></label><label>Status<select data-card-field="status" ${disabled}><option value="incomplete" ${card.status==='incomplete'?'selected':''}>Incompleta</option><option value="draft" ${card.status==='draft'?'selected':''}>Rascunho</option><option value="ready" ${card.status==='ready'?'selected':''}>Completa</option></select></label></div>
      <div class="ficha-table-wrap"><table class="ficha-table"><thead><tr><th style="width:40%">Ingrediente</th><th>Qtd.</th><th>Un.</th><th>Custo Unit.</th><th>Subtotal</th><th></th></tr></thead><tbody id="course-ficha-tbody">${items.map((item,index)=>this._renderCourseRecipeRow(card,item,index)).join('')}</tbody></table><button type="button" class="ficha-table__add" data-course-add-row ${this._canWrite?'':'disabled'}>+ Adicionar ingrediente</button></div>
      <div class="ficha-preparo"><label class="form-label" for="course-ficha-method">Modo de preparo</label><textarea class="form-input ficha-preparo__input" id="course-ficha-method" rows="7" maxlength="10000" data-card-field="preparationMethod" ${this._canWrite?'':'disabled'}>${Utils.escapeHtml(card.preparationMethod||'')}</textarea><label class="form-label" for="course-ficha-notes">Pendências e observações</label><textarea class="form-input ficha-preparo__input" id="course-ficha-notes" rows="3" maxlength="5000" data-card-field="pendingNotes" ${this._canWrite?'':'disabled'}>${Utils.escapeHtml(card.pendingNotes||'')}</textarea><div class="ficha-preparo__feedback"><p class="ficha-preparo__status" data-course-save-status role="status">${cost.complete?'Custo completo':`Custo não final: ${Utils.escapeHtml((cost.notes||[]).join(' '))}`}</p><button type="button" class="btn btn-primary" data-course-save ${this._canWrite?'':'disabled'}>Salvar ficha técnica</button></div></div>`;
    if(!container.dataset.courseEditorBound){
      container.dataset.courseEditorBound='1';
      container.addEventListener('click',event=>{
        if(event.target.closest('[data-course-add-row]')){
          const current=this._receitasCurso.find(item=>item.id===this._activeCourseRecipeId);if(!current)return;
          const tbody=container.querySelector('#course-ficha-tbody');tbody.insertAdjacentHTML('beforeend',this._renderCourseRecipeRow(current,{itemName:'',quantity:null,unit:'',pendingNote:''},tbody.children.length));return;
        }
        const remove=event.target.closest('[data-course-remove-row]');
        if(remove){remove.closest('[data-course-row]')?.remove();return;}
        if(event.target.closest('[data-course-save]'))this._saveCourseRecipeEditor();
      });
      const refreshRow=event=>{if(event.target.closest('[data-course-row]'))this._updateCourseRecipeRowCost(event.target.closest('[data-course-row]'));};
      container.addEventListener('input',refreshRow);
      container.addEventListener('change',refreshRow);
    }
  },

  _updateCourseRecipeRowCost(row){
    const get=name=>row.querySelector(`[data-row-field="${name}"]`);
    const nameChanged=get('itemName').value.trim()!==row.dataset.originalItemName;
    const ingredient=this._ingredientes.find(item=>item.id===(nameChanged?'':row.dataset.ingredientId));
    const preparation=this._receitasCurso.find(item=>item.id===(nameChanged?'':row.dataset.preparationId));
    const quantity=Number(get('quantity').value);
    const unit=get('unit').value;
    const unitCost=ingredient?calcIngredienteCost(ingredient,1,unit):preparation?.cost?.unit??null;
    const subtotal=!(quantity>0)?null:ingredient?calcIngredienteCost(ingredient,quantity,unit):preparation?.cost?.unit!=null?preparation.cost.unit*quantity:null;
    row.cells[3].textContent=unitCost==null?'—':Utils.currency(unitCost);
    row.cells[4].textContent=subtotal==null?'—':Utils.currency(subtotal);
  },

  _renderCourseRecipeRow(card,item,index){
    const ingredient=this._ingredientes.find(row=>row.id===item.ingredientId);
    const preparation=this._receitasCurso.find(row=>row.id===item.preparationId);
    const unitCost=ingredient&&item.quantity!==null?calcIngredienteCost(ingredient,1,item.unit):preparation?.cost?.unit??null;
    const subtotal=ingredient&&item.quantity!==null?calcIngredienteCost(ingredient,item.quantity,item.unit):preparation&&item.quantity!==null&&preparation.cost?.unit!=null?preparation.cost.unit*item.quantity:null;
    const disabled=this._canWrite?'':'disabled';
    const relation=ingredient?`<span class="ficha-course-link">Insumo: ${Utils.escapeHtml(ingredient.nome)} (${Utils.escapeHtml(ingredient.unidade)})</span>`:preparation?`<span class="ficha-course-link">Preparação: ${Utils.escapeHtml(preparation.name)}</span>`:'<span class="ficha-course-link ficha-course-link--pending">Sem vínculo no cadastro de estoque</span>';
    const packaging=item.isPackaging?'<span class="ficha-course-link">Material de venda/embalagem</span>':'';
    return `<tr data-course-row data-original-item-name="${Utils.escapeHtml(item.itemName||'')}" data-ingredient-id="${Utils.escapeHtml(item.ingredientId||'')}" data-preparation-id="${Utils.escapeHtml(item.preparationId||'')}" data-is-packaging="${item.isPackaging?'true':'false'}"><td><input class="ficha-course-item-name" data-row-field="itemName" value="${Utils.escapeHtml(item.itemName||'')}" placeholder="Nome do item" ${disabled}><input type="hidden" data-row-field="id" value="${Utils.escapeHtml(item.id||'')}">${relation}${packaging}<input class="ficha-course-item-note" data-row-field="pendingNote" value="${Utils.escapeHtml(item.pendingNote||'')}" placeholder="Observação ou quantidade pendente" ${disabled}></td><td><input type="number" class="ficha-qty-input" data-row-field="quantity" value="${item.quantity??''}" min="0.001" step="any" placeholder="—" ${disabled}></td><td><input class="ficha-unit-select" data-row-field="unit" value="${Utils.escapeHtml(item.unit||'')}" placeholder="un" ${disabled}></td><td>${unitCost===null?'—':Utils.currency(unitCost)}</td><td>${subtotal===null?'—':Utils.currency(subtotal)}</td><td><button class="btn-icon" type="button" data-course-remove-row aria-label="Remover ingrediente" ${disabled}>×</button></td></tr>`;
  },

  async _saveCourseRecipeEditor(){
    const container=document.getElementById('ficha-editor');
    const card=this._receitasCurso.find(item=>item.id===this._activeCourseRecipeId);
    if(!container||!card)return;
    const button=container.querySelector('[data-course-save]');const status=container.querySelector('[data-course-save-status]');
    const field=name=>container.querySelector(`[data-card-field="${name}"]`);
    const value=name=>field(name)?.value||'';
    const items=[...container.querySelectorAll('[data-course-row]')].map(row=>{
      const get=name=>row.querySelector(`[data-row-field="${name}"]`);
      const qty=get('quantity').value.trim();
      const itemName=get('itemName').value.trim();
      const nameChanged=itemName!==row.dataset.originalItemName;
      return {id:get('id').value||undefined,itemName,ingredientId:nameChanged?null:row.dataset.ingredientId||null,preparationId:nameChanged?null:row.dataset.preparationId||null,quantity:qty===''?null:Number(qty),unit:get('unit').value.trim()||null,isPackaging:!nameChanged&&row.dataset.isPackaging==='true',pendingNote:get('pendingNote').value.trim()};
    });
    if(items.some(item=>!item.itemName||item.quantity===null&&!item.pendingNote)){
      UI.toast('Informe o nome dos itens e registre a pendência quando a quantidade não for conhecida.','warning');return;
    }
    button.disabled=true;status.textContent='Salvando no ERP…';
    try{
      await API.saveServerRecipeCard({...card,status:value('status'),outputYield:value('outputYield')===''?null:Number(value('outputYield')),outputUnit:value('outputUnit').trim()||null,packagingCapacity:value('packagingCapacity')===''?null:Number(value('packagingCapacity')),packagingCapacityUnit:value('packagingCapacityUnit').trim()||null,preparationMethod:value('preparationMethod'),pendingNotes:value('pendingNotes'),items});
      this._receitasCurso=await API.getServerRecipeCards();
      this._renderProdutoList(this._allProdutos,document.getElementById('ficha-produto-search')?.value||'');
      const saved=this._receitasCurso.find(item=>item.id===card.id);if(saved)this.selectCourseRecipe(saved);
      UI.toast('Ficha técnica salva no ERP.','success');
    }catch(error){button.disabled=false;status.textContent='Falha ao salvar. As alterações ainda estão na tela.';UI.toast('Não foi possível salvar a ficha técnica.','danger');}
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
    const custoCompleto = this._costComplete(ficha);
    const preco  = produto.precoVenda || 0;
    const lucro  = custoCompleto ? preco - custo : null;
    const margem = custoCompleto && preco ? Math.round((lucro / preco) * 100) : null;
    const cmvPct = custoCompleto && preco ? Math.round((custo / preco) * 100) : null;
    const cmvW   = cmvPct === null ? 0 : Math.min(100, cmvPct);
    const cmvCls = cmvPct !== null && cmvPct > this._cmvGoal
      ? 'cmv-bar__fill--danger'
      : cmvPct !== null && cmvPct > this._cmvGoal * 0.85
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
          <span class="ficha-summary__label">${custoCompleto ? 'Custo (Ficha)' : 'Custo parcial'}</span>
          <span class="ficha-summary__value ficha-summary__value--gold" id="fs-custo">${Utils.currency(custo)}</span>
        </div>
        <div>
          <span class="ficha-summary__label">Preço de Venda</span>
          <span class="ficha-summary__value">${Utils.currency(preco)}</span>
        </div>
        <div>
          <span class="ficha-summary__label">Lucro Est.</span>
          <span class="ficha-summary__value ${lucro === null ? '' : lucro < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'}" id="fs-lucro">${lucro === null ? '—' : Utils.currency(lucro)}</span>
        </div>
        <div>
          <span class="ficha-summary__label">Margem</span>
          <span class="ficha-summary__value ${margem === null ? '' : margem < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'}" id="fs-margem">${margem === null ? '—' : `${margem}%`}</span>
        </div>
      </div>

      ${custoCompleto ? '' : '<p class="ficha-preparo__status" data-state="pending">Custo parcial: há rendimento, ingrediente, unidade ou custo de preparação pendente. Não use este valor como custo final.</p>'}

      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">CMV sobre preço</span>
          <span style="font-size:var(--text-xs);color:var(--text-muted)">meta: ${this._cmvGoal}%</span>
        </div>
        <div class="cmv-bar">
          <div class="cmv-bar__track">
            <div class="cmv-bar__fill ${cmvCls}" id="fs-cmv-fill" style="width:${cmvW}%"></div>
          </div>
          <span class="cmv-bar__value" id="fs-cmv-value">${cmvPct === null ? '—' : `${cmvPct}%`}</span>
        </div>
      </div>
    `;

    this._bindEditorEvents(ficha, produto);
  },

  _renderRow(item, idx) {
    const ing   = this._ingredientes.find(i => i.id === item.ingredienteId);
    const prep  = this._receitasCurso.find(i => i.id === item.preparacaoId && i.recipeType === 'preparation');
    const costBase = ing || (prep && prep.cost?.partialUnit != null ? { unidade: prep.outputUnit, custoUnitario: prep.cost.partialUnit } : null);
    const custo = costBase ? calcIngredienteCost(costBase, item.quantidade, item.unidade) : null;

    const ingOptions = this._ingredientes.filter(i=>i.ativo).map(i =>
      `<option value="ingredient:${i.id}" ${i.id === item.ingredienteId ? 'selected' : ''}>${Utils.escapeHtml(i.nome)} (${i.unidade})</option>`
    ).join('');
    const prepOptions = this._receitasCurso.filter(i=>i.recipeType==='preparation').map(i =>
      `<option value="preparation:${i.id}" ${i.id === item.preparacaoId ? 'selected' : ''}>${Utils.escapeHtml(i.code)} · ${Utils.escapeHtml(i.name)}${i.status==='ready'?'':' · custo pendente'}</option>`
    ).join('');
    const selectedComponent = item.ingredienteId ? `ingredient:${item.ingredienteId}` : item.preparacaoId ? `preparation:${item.preparacaoId}` : '';

    const unitOptions = UNIDADES.map(u =>
      `<option value="${u}" ${u === item.unidade ? 'selected' : ''}>${u}</option>`
    ).join('');

    return `
      <tr data-idx="${idx}">
        <td>
          <select class="ficha-ing-select" data-field="componentId">
            <option value="" ${selectedComponent?'':'selected'}>— selecione insumo ou preparação —</option>
            <optgroup label="Insumos">${ingOptions}</optgroup>
            <optgroup label="Preparações do curso">${prepOptions}</optgroup>
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
          ${ing ? `${Utils.currency(ing.custoUnitario)}/${ing.unidade}` : prep?.cost?.partialUnit != null ? `${Utils.currency(prep.cost.partialUnit)}/${Utils.escapeHtml(prep.outputUnit||'un')}${prep.cost.complete?'':' · parcial'}` : '—'}
        </td>
        <td style="font-weight:600;font-size:var(--text-sm)">
          ${custo !== null ? `${Utils.currency(custo)}${prep&&!prep.cost?.complete?'*':''}` : '—'}
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
      ficha.itens.push({ ingredienteId: '', preparacaoId: '', quantidade: 0, unidade: 'g' });
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
        } else if (field === 'componentId') {
          const [kind, id] = val.split(':', 2);
          ficha.itens[idx].ingredienteId = kind === 'ingredient' ? id : '';
          ficha.itens[idx].preparacaoId = kind === 'preparation' ? id : '';
          const ing = this._ingredientes.find(i => i.id === ficha.itens[idx].ingredienteId);
          const prep = this._receitasCurso.find(i => i.id === ficha.itens[idx].preparacaoId);
          if (ing) ficha.itens[idx].unidade = ing.unidade;
          else if (prep?.outputUnit) ficha.itens[idx].unidade = prep.outputUnit;
          this._persist(ficha, { debounce: true });
          this._renderEditor(produto);
        }
      });
    });
  },

  _refreshSummary(ficha, produto) {
    const custo  = this.calcCusto(ficha);
    const custoCompleto = this._costComplete(ficha);
    const preco  = produto.precoVenda || 0;
    const lucro  = custoCompleto ? preco - custo : null;
    const margem = custoCompleto && preco ? Math.round((lucro / preco) * 100) : null;
    const cmvPct = custoCompleto && preco ? Math.round((custo / preco) * 100) : null;
    const cmvW   = cmvPct === null ? 0 : Math.min(100, cmvPct);
    const cmvCls = cmvPct !== null && cmvPct > this._cmvGoal
      ? 'cmv-bar__fill--danger'
      : cmvPct !== null && cmvPct > this._cmvGoal * 0.85
        ? 'cmv-bar__fill--warn'
        : '';

    const $ = id => document.getElementById(id);
    const setCls = (el, base, cls) => { if (el) el.className = `${base} ${cls}`; };

    if ($('fs-custo'))    $('fs-custo').textContent    = Utils.currency(custo);
    const costLabel = document.querySelector('#ficha-editor .ficha-summary__label');
    if (costLabel) costLabel.textContent = custoCompleto ? 'Custo (Ficha)' : 'Custo parcial';
    if ($('fs-lucro'))  { $('fs-lucro').textContent  = custoCompleto ? Utils.currency(lucro) : '—';  setCls($('fs-lucro'),  'ficha-summary__value', !custoCompleto ? '' : lucro  < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'); }
    if ($('fs-margem')) { $('fs-margem').textContent = margem === null ? '—' : `${margem}%`;           setCls($('fs-margem'), 'ficha-summary__value', margem === null ? '' : margem < 0 ? 'ficha-summary__value--danger' : 'ficha-summary__value--success'); }
    if ($('fs-cmv-fill')) {
      $('fs-cmv-fill').style.width = `${cmvW}%`;
      $('fs-cmv-fill').className   = `cmv-bar__fill ${cmvCls}`;
    }
    if ($('fs-cmv-value')) $('fs-cmv-value').textContent = cmvPct === null ? '—' : `${cmvPct}%`;
  },
};
