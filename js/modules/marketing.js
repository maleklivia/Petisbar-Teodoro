/* ============================================================
   Petisbar Teodoro — MarketingModule
   Gestão de cupons, clientes VIP e reativação de inativos.
   ============================================================ */

const MarketingModule = {
  _tab: 'cupons',
  _serverMode: false,
  _canReadPromotions: false,
  _canWritePromotions: false,
  _promotions: [],
  _promotionProducts: [],

  async init() {
    this._serverMode = API.isServerMode();
    this._canReadPromotions = API.hasPermission('promotions.read');
    this._canWritePromotions = API.hasPermission('promotions.write');
    if (this._serverMode && this._canReadPromotions) {
      const el=document.getElementById('marketing-content');
      if(el)el.innerHTML='<div class="empty-state"><p>Carregando promoções…</p></div>';
      try { [this._promotions,this._promotionProducts]=await Promise.all([API.getServerPromotions(),API.getServerPromotionProducts()]); }
      catch { if(el)el.innerHTML='<div class="empty-state"><p>Não foi possível carregar as promoções do ERP.</p></div>';return; }
    }
    this._render();
    this._bindEvents();
  },

  _render() {
    const el = document.getElementById('marketing-content');
    if (!el) return;
    const cupons   = Stores.cupons.get();
    const clientes = Stores.clientes.get();
    const pedidos  = Stores.pedidos.get();
    const hoje     = new Date().toISOString().slice(0, 10);
    const inativos = this._getInativos(clientes, pedidos);
    const vips     = this._getVIPs(clientes, pedidos);

    el.innerHTML = `
      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card">
          <span class="kpi-card__label">Cupons Ativos</span>
          <strong class="kpi-card__value">${cupons.filter(c => c.ativo && c.validade >= hoje).length}</strong>
          <small class="kpi-card__sub">disponíveis</small>
        </article>
        <article class="kpi-card kpi-card--ok">
          <span class="kpi-card__label">Clientes VIP</span>
          <strong class="kpi-card__value">${vips.length}</strong>
          <small class="kpi-card__sub">top clientes</small>
        </article>
        <article class="kpi-card ${inativos.length > 0 ? 'kpi-card--warn' : ''}">
          <span class="kpi-card__label">Inativos</span>
          <strong class="kpi-card__value">${inativos.length}</strong>
          <small class="kpi-card__sub">sem pedido recente</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Total Clientes</span>
          <strong class="kpi-card__value">${clientes.length}</strong>
          <small class="kpi-card__sub">cadastrados</small>
        </article>
      </div>

      <div class="module-tabs">
        <button class="tab-btn ${this._tab === 'cupons' ? 'active' : ''}" data-mkt-tab="cupons">Cupons</button>
        <button class="tab-btn ${this._tab === 'vips' ? 'active' : ''}" data-mkt-tab="vips">VIP ${vips.length > 0 ? `<span class="count-badge">${vips.length}</span>` : ''}</button>
        <button class="tab-btn ${this._tab === 'inativos' ? 'active' : ''}" data-mkt-tab="inativos">
          Inativos ${inativos.length > 0 ? `<span class="count-badge">${inativos.length}</span>` : ''}
        </button>
        ${this._serverMode&&this._canReadPromotions?`<button class="tab-btn ${this._tab === 'promocoes' ? 'active' : ''}" data-mkt-tab="promocoes">Promoções e combos</button>`:''}
      </div>

      <div id="mkt-tab-body">
        ${this._renderTab(cupons, vips, inativos)}
      </div>
    `;
  },

  _renderTab(cupons, vips, inativos) {
    if (this._tab === 'vips')     return this._renderVIPs(vips);
    if (this._tab === 'inativos') return this._renderInativos(inativos);
    if (this._tab === 'promocoes') return this._renderPromotions();
    return this._renderCupons(cupons);
  },

  _renderPromotions() {
    if (!this._canReadPromotions) return '<div class="empty-state"><p>Seu usuário não possui permissão para consultar promoções.</p></div>';
    const missingSkol=!this._promotionProducts.some(product=>product.name.toLowerCase().includes('skol'));
    return `
      <div class="module-toolbar"><div style="flex:1;color:var(--text-muted);font-size:var(--text-sm)">O preço normal continua vindo do cadastro do produto. Promoções só entram no pedido quando estiverem ativas e dentro do período.</div>
        ${this._canWritePromotions?'<button class="btn btn-primary" id="btn-nova-promocao">+ Nova promoção</button>':''}</div>
      ${missingSkol?'<div class="alert alert-warning" style="margin-bottom:var(--sp-4)">Skol não está cadastrada como produto ativo; ela não aparece nas opções do rascunho de cervejas.</div>':''}
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Promoção</th><th>Regra</th><th>Preço / desconto</th><th>Período</th><th>Margem estimada</th><th>Status</th><th></th></tr></thead><tbody>
        ${this._promotions.length?this._promotions.map(p=>{
          const type={percentage:'Percentual',fixed:'Desconto fixo',combo:'Combo fechado'}[p.rule_type]||p.rule_type;
          const value=p.rule_type==='percentage'?`${p.discount_percent}%`:p.rule_type==='fixed'?Utils.currency(Number(p.discount_amount||0)):p.combo_price==null?'Preço pendente':Utils.currency(Number(p.combo_price));
          const active=p.active&&(!p.ends_at||new Date(p.ends_at)>=new Date())&&(!p.starts_at||new Date(p.starts_at)<=new Date());
          const margin=p.estimatedMargin==null?'Não calculável':`${Utils.currency(Number(p.estimatedMargin))} · margem ${Number(p.marginPercent).toFixed(1)}%${p.estimatedCmvPercent==null?'':` · CMV ${Number(p.estimatedCmvPercent).toFixed(1)}%`}`;
          const period=`${p.starts_at?Utils.formatShortDate(p.starts_at):'Sem início'} – ${p.ends_at?Utils.formatShortDate(p.ends_at):'Sem fim'}`;
          const incomplete=p.costComplete===false?`<small style="display:block;color:var(--color-warning)">${p.cmv_estimate_percent==null?'Custo/ficha pendente; margem não calculável.':'Margem estimada com CMV de referência; substitua quando cadastrar custos reais.'} ${(p.missingCostProductNames||p.missingCostProductIds||[]).map(name=>Utils.escapeHtml(name)).join(', ')||''}</small>`:`<small style="display:block;color:var(--text-muted)">${Utils.escapeHtml(p.marginBasis||'')}</small>`;
          return `<tr><td><strong>${Utils.escapeHtml(p.name)}</strong><small style="display:block;color:var(--text-muted)">${Utils.escapeHtml(p.code)}${p.description?` · ${Utils.escapeHtml(p.description)}`:''}</small></td>
            <td>${type}${p.rule_type==='combo'?`<small style="display:block;color:var(--text-muted)">${(p.groups||[]).map(group=>`${Utils.escapeHtml(group.name)}: ${group.requiredQuantity}`).join(' · ')}</small>`:''}</td>
            <td>${value}</td><td>${period}</td><td>${margin}${incomplete}</td>
            <td>${active?'<span class="badge badge-success">Ativa</span>':p.active?'<span class="badge badge-warning">Fora do período</span>':'<span class="badge badge-neutral">Rascunho / inativa</span>'}</td>
            <td><div class="row-actions">${this._canWritePromotions?`<button class="btn btn-sm btn-secondary" data-promo-edit="${p.id}">Editar</button><button class="btn btn-sm ${p.active?'btn-ghost':'btn-primary'}" data-promo-toggle="${p.id}" data-active="${!p.active}">${p.active?'Desativar':'Ativar'}</button>`:''}</div></td></tr>`;
        }).join(''):'<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma promoção cadastrada.</td></tr>'}
      </tbody></table></div>`;
  },

  _renderCupons(cupons) {
    const hoje = new Date().toISOString().slice(0, 10);
    return `
      <div class="module-toolbar">
        <span style="flex:1"></span>
        <button class="btn btn-primary" id="btn-novo-cupom">+ Novo Cupom</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Usos</th>
              <th>Validade</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${cupons.length ? cupons.map(c => {
              const expirado = c.validade < hoje;
              const esgotado = c.usos >= c.limite;
              const ativo    = c.ativo && !expirado && !esgotado;
              return `
                <tr>
                  <td>
                    <code style="background:var(--bg-raised);padding:2px 8px;border-radius:4px;font-size:var(--text-sm);font-weight:700">${Utils.escapeHtml(c.codigo)}</code>
                  </td>
                  <td style="font-size:var(--text-sm);color:var(--text-muted)">${c.tipo}</td>
                  <td style="font-weight:700">${c.tipo === 'percentual' ? `${c.valor}%` : Utils.currency(c.valor)}</td>
                  <td style="font-size:var(--text-sm)">${c.usos} / ${c.limite}</td>
                  <td style="font-size:var(--text-sm);color:${expirado ? 'var(--color-danger)' : 'var(--text-muted)'}">${Utils.formatShortDate(c.validade)}</td>
                  <td>
                    ${ativo ? '<span class="badge badge-success">Ativo</span>' : ''}
                    ${expirado ? '<span class="badge badge-danger">Expirado</span>' : ''}
                    ${esgotado && !expirado ? '<span class="badge badge-neutral">Esgotado</span>' : ''}
                    ${!c.ativo && !expirado ? '<span class="badge badge-neutral">Inativo</span>' : ''}
                  </td>
                  <td>
                    <div class="row-actions">
                      <button class="btn-icon" data-mkt-toggle="${c.id}" title="${c.ativo ? 'Desativar' : 'Ativar'}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>
                      </button>
                      <button class="btn-icon btn-icon--danger" data-mkt-del-cupom="${c.id}" title="Excluir">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') :
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum cupom cadastrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderVIPs(vips) {
    if (!vips.length) return '<div class="empty-state"><p>Nenhum cliente com pedidos suficientes para VIP.</p></div>';
    return `
      <div style="margin-bottom:var(--sp-3);color:var(--text-muted);font-size:var(--text-sm)">
        Clientes com 3+ pedidos, ordenados por total gasto.
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Cliente</th><th>Pedidos</th><th style="text-align:right">Total Gasto</th><th style="text-align:right">Ticket Médio</th><th>Último Pedido</th></tr>
          </thead>
          <tbody>
            ${vips.map((c, i) => `
              <tr>
                <td style="font-family:var(--font-display);font-size:var(--text-2xl);color:${i === 0 ? 'var(--color-gold)' : i < 3 ? 'var(--text-secondary)' : 'var(--text-muted)'}">${i + 1}</td>
                <td>
                  <div style="font-weight:700">${Utils.escapeHtml(c.nome)}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.escapeHtml(c.telefone || '')}</div>
                </td>
                <td style="font-weight:700">${c._pedidosCount}</td>
                <td style="text-align:right;font-weight:700;color:var(--color-success)">${Utils.currency(c._totalGasto)}</td>
                <td style="text-align:right;color:var(--text-secondary)">${Utils.currency(c._ticketMedio)}</td>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">${c._ultimoPedido ? Utils.formatShortDate(c._ultimoPedido) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderInativos(inativos) {
    if (!inativos.length) return '<div class="empty-state"><p style="color:var(--color-success);font-weight:600">✓ Nenhum cliente inativo no período configurado.</p></div>';
    const config = Stores.config.get();
    const dias   = config.metas?.clientesInativosDias || 30;

    return `
      <div style="margin-bottom:var(--sp-3);color:var(--text-muted);font-size:var(--text-sm)">
        Clientes sem pedido nos últimos <strong>${dias} dias</strong>. Configure em Configurações → Metas.
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Cliente</th><th>Telefone</th><th>Último Pedido</th><th>Dias Inativo</th><th style="text-align:right">Total Histórico</th></tr>
          </thead>
          <tbody>
            ${inativos.map(c => `
              <tr>
                <td style="font-weight:600">${Utils.escapeHtml(c.nome)}</td>
                <td style="font-size:var(--text-sm);color:var(--text-muted)">${Utils.escapeHtml(c.telefone || '—')}</td>
                <td style="font-size:var(--text-sm);color:var(--color-warning)">${c._ultimoPedido ? Utils.formatShortDate(c._ultimoPedido) : 'Nunca pediu'}</td>
                <td style="font-weight:700;color:var(--color-warning)">${c._diasInativo}d</td>
                <td style="text-align:right;color:var(--text-muted)">${Utils.currency(c._totalGasto)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:var(--sp-4);background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-4)">
        <strong style="font-size:var(--text-sm)">💡 Ação sugerida:</strong>
        <p style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--sp-1)">Envie um cupom de reativação via WhatsApp. Crie um cupom em <strong>Cupons</strong> e compartilhe o código com esses clientes.</p>
      </div>
    `;
  },

  _getVIPs(clientes, pedidos) {
    return clientes.map(c => {
      const ped = pedidos.filter(p => p.clienteId === c.id && p.status === 'Entregue');
      const totalGasto  = ped.reduce((s, p) => s + (p.total || 0), 0);
      const datas       = ped.map(p => p.dataCriacao).sort().reverse();
      return { ...c, _pedidosCount: ped.length, _totalGasto: totalGasto, _ticketMedio: ped.length > 0 ? totalGasto / ped.length : 0, _ultimoPedido: datas[0] || null };
    }).filter(c => c._pedidosCount >= 3).sort((a, b) => b._totalGasto - a._totalGasto);
  },

  _getInativos(clientes, pedidos) {
    const config = Stores.config.get();
    const diasInativo = config.metas?.clientesInativosDias || 30;
    const limite  = new Date();
    limite.setDate(limite.getDate() - diasInativo);
    const limiteStr = limite.toISOString().slice(0, 10);
    const hoje      = new Date().toISOString().slice(0, 10);

    return clientes.map(c => {
      const ped   = pedidos.filter(p => p.clienteId === c.id).sort((a, b) => (b.dataCriacao || '').localeCompare(a.dataCriacao || ''));
      const ultimo = ped[0]?.dataCriacao?.slice(0, 10) || null;
      const total  = ped.filter(p => p.status === 'Entregue').reduce((s, p) => s + (p.total || 0), 0);
      const diasInativo2 = ultimo ? Math.floor((new Date(hoje) - new Date(ultimo)) / 86400000) : 9999;
      return { ...c, _ultimoPedido: ultimo, _diasInativo: diasInativo2, _totalGasto: total };
    }).filter(c => !c._ultimoPedido || c._ultimoPedido < limiteStr).sort((a, b) => b._diasInativo - a._diasInativo);
  },

  _bindEvents() {
    const el = document.getElementById('marketing-content');
    if (!el) return;

    el.addEventListener('click', e => {
      const tab = e.target.closest('[data-mkt-tab]');
      if (tab) { this._tab = tab.dataset.mktTab; this._render(); this._bindEvents(); return; }

      if (e.target.closest('#btn-novo-cupom')) { this._openFormCupom(); return; }
      if (e.target.closest('#btn-nova-promocao')) { this._openPromotionForm(); return; }

      const editPromotion=e.target.closest('[data-promo-edit]');
      if(editPromotion){this._openPromotionForm(this._promotions.find(p=>p.id===editPromotion.dataset.promoEdit));return;}
      const togglePromotion=e.target.closest('[data-promo-toggle]');
      if(togglePromotion){this._setPromotionActive(togglePromotion.dataset.promoToggle,togglePromotion.dataset.active==='true');return;}

      const toggle = e.target.closest('[data-mkt-toggle]');
      if (toggle) {
        const cupons = Stores.cupons.get();
        const cup = cupons.find(c => c.id === toggle.dataset.mktToggle);
        if (cup) { cup.ativo = !cup.ativo; Stores.cupons.set(cupons); this._render(); this._bindEvents(); }
        return;
      }

      const del = e.target.closest('[data-mkt-del-cupom]');
      if (del) {
        if (!confirm('Excluir este cupom?')) return;
        Stores.cupons.set(Stores.cupons.get().filter(c => c.id !== del.dataset.mktDelCupom));
        this._render();
        this._bindEvents();
        return;
      }
    });
  },

  _renderPromotionGroup(group={}) {
    const selected=new Map((group.products||[]).map(product=>[product.id,product]));
    const cards=this._promotionProducts.map(product=>{
      const value=selected.get(product.id),unitCost=product.purchase_cost;
      const costLabel=unitCost!=null?`Custo de compra ${Utils.currency(Number(unitCost))}`:product.has_sheet&&product.sheet_items?`${product.sheet_items} ingrediente(s) na ficha`:'Custo/ficha incompleto';
      return `<label class="promo-product-choice"><input type="checkbox" data-group-product value="${this._esc(product.id)}" ${value?'checked':''}>
        <span><strong>${this._esc(product.name)}</strong><small>${this._esc(product.category)} · ${Utils.currency(Number(product.sale_price))} · ${this._esc(costLabel)}</small></span>
        <span class="form-group promo-surcharge"><small>Acréscimo</small><input class="form-input" data-group-surcharge type="number" min="0" step="0.01" value="${Number(value?.surcharge||0)}" aria-label="Acréscimo em ${this._esc(product.name)}"></span></label>`;
    }).join('');
    return `<fieldset class="promo-group" data-promo-group><legend>Grupo de escolha</legend>
      <div class="form-row"><div class="form-group" style="flex:2"><label class="form-label">Nome do grupo</label><input class="form-input" data-group-name maxlength="100" value="${this._esc(group.name||'')}" placeholder="Ex.: Bebidas" required></div>
      <div class="form-group"><label class="form-label">Quantidade obrigatória</label><input class="form-input" data-group-required type="number" min="1" max="30" value="${Number(group.requiredQuantity||1)}" required></div>
      <div class="form-group"><label class="form-label">Máximo de escolhas</label><input class="form-input" data-group-maximum type="number" min="1" max="30" value="${Number(group.maxQuantity||group.requiredQuantity||1)}" required></div></div>
      <label class="form-check"><input type="checkbox" data-group-same ${group.allowSameProduct===false?'':'checked'}> Permitir repetir o mesmo produto (cada unidade pode ter opções diferentes)</label>
      <div class="form-group"><label class="form-label">Opções válidas para este grupo (JSON, opcional)</label><input class="form-input" data-group-options value="${this._esc(JSON.stringify(group.allowedOptions||{}))}" placeholder='{"flavor":["natural","morango"]}'></div>
      <div class="form-group"><label class="form-label">Produtos permitidos e acréscimos</label><div class="promo-products">${cards}</div></div>
      <button type="button" class="btn btn-ghost" data-group-remove>Remover grupo</button></fieldset>`;
  },

  _esc(value){return Utils.escapeHtml(String(value??''));},

  _openPromotionForm(promotion=null) {
    if(!this._canWritePromotions)return;
    const groups=promotion?.groups||[],targetIds=(promotion?.products||[]).map(product=>product.id);
    const targetProducts=this._promotionProducts.map(product=>`<label class="promo-product-choice"><input type="checkbox" data-promo-target value="${this._esc(product.id)}" ${targetIds.includes(product.id)?'checked':''}><span><strong>${this._esc(product.name)}</strong><small>${this._esc(product.category)} · ${Utils.currency(Number(product.sale_price))}</small></span></label>`).join('');
    const localDate=value=>{if(!value)return'';const date=new Date(value);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,16)};
    UI.openModal({title:promotion?'Editar promoção':'Nova promoção',size:'wide',confirmLabel:'Salvar rascunho',body:`
      <form id="promotion-form"><div class="form-row"><div class="form-group"><label class="form-label">Código interno</label><input class="form-input" name="code" value="${this._esc(promotion?.code||'')}" placeholder="COMBO-EXEMPLO" maxlength="40" required></div>
      <div class="form-group" style="flex:2"><label class="form-label">Nome comercial</label><input class="form-input" name="name" value="${this._esc(promotion?.name||'')}" maxlength="120" required></div></div>
      <div class="form-group"><label class="form-label">Descrição para o cliente</label><textarea class="form-input" name="description" maxlength="2000">${this._esc(promotion?.description||'')}</textarea></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Tipo de regra</label><select class="form-input" name="ruleType" data-promo-rule><option value="combo" ${promotion?.rule_type==='combo'||!promotion?'selected':''}>Combo com preço fechado</option><option value="percentage" ${promotion?.rule_type==='percentage'?'selected':''}>Desconto percentual</option><option value="fixed" ${promotion?.rule_type==='fixed'?'selected':''}>Desconto fixo</option></select></div>
      <div class="form-group promo-value" data-rule-value="combo"><label class="form-label">Preço fechado do combo</label><input class="form-input" name="comboPrice" type="number" min="0" step="0.01" value="${promotion?.combo_price??''}" placeholder="Deixe vazio até definir"></div>
      <div class="form-group promo-value" data-rule-value="percentage"><label class="form-label">Desconto (%)</label><input class="form-input" name="discountPercent" type="number" min="0.01" max="100" step="0.01" value="${promotion?.discount_percent??''}"></div>
      <div class="form-group promo-value" data-rule-value="fixed"><label class="form-label">Desconto (R$)</label><input class="form-input" name="discountAmount" type="number" min="0.01" step="0.01" value="${promotion?.discount_amount??''}"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Início</label><input class="form-input" name="startsAt" type="datetime-local" value="${this._esc(localDate(promotion?.starts_at))}"></div><div class="form-group"><label class="form-label">Fim</label><input class="form-input" name="endsAt" type="datetime-local" value="${this._esc(localDate(promotion?.ends_at))}"></div><div class="form-group"><label class="form-label">Prioridade</label><input class="form-input" name="priority" type="number" value="${Number(promotion?.priority??100)}"></div></div>
      <div class="form-group"><label class="form-label">CMV de referência para estimativa (%)</label><input class="form-input" name="cmvEstimatePercent" type="number" min="0.01" max="99" step="0.01" value="${promotion?.cmv_estimate_percent??''}" placeholder="Vazio usa custos cadastrados"><small class="form-hint">Estimativa comercial; não altera custos dos produtos nem substitui o CMV realizado.</small></div>
      <label class="form-check"><input type="checkbox" name="stackWithCoupon" ${promotion?.stack_with_coupon?'checked':''}> Permitir acumular com cupom</label>
      <section data-rule-section="combo"><div style="display:flex;align-items:center;justify-content:space-between;margin:var(--sp-4) 0"><strong>Grupos e produtos permitidos</strong><button type="button" id="promo-add-group" class="btn btn-secondary">+ Adicionar grupo</button></div><div id="promo-groups">${groups.map(group=>this._renderPromotionGroup(group)).join('')}</div></section>
      <section data-rule-section="targets"><div class="form-group"><label class="form-label">Produtos que recebem o desconto</label><div class="promo-products">${targetProducts}</div></div></section>
      ${promotion?.active?'<p class="form-hint">Salvar alterações deixará a promoção inativa; reative depois de revisar preço e margem.</p>':''}</form>
    `,onConfirm:()=>this._savePromotion(promotion?.id||'')});
    const dialog=UI._activeModal;
    dialog.querySelector('[data-promo-rule]')?.addEventListener('change',()=>this._syncPromotionForm(dialog));
    dialog.querySelector('#promo-add-group')?.addEventListener('click',()=>{dialog.querySelector('#promo-groups').insertAdjacentHTML('beforeend',this._renderPromotionGroup());});
    dialog.querySelector('#promo-groups')?.addEventListener('click',event=>{if(event.target.closest('[data-group-remove]'))event.target.closest('[data-promo-group]').remove();});
    this._syncPromotionForm(dialog);
  },

  _syncPromotionForm(dialog){const type=dialog.querySelector('[data-promo-rule]').value;dialog.querySelectorAll('[data-rule-section]').forEach(section=>section.hidden=section.dataset.ruleSection!==type);dialog.querySelectorAll('[data-rule-value]').forEach(field=>field.hidden=field.dataset.ruleValue!==type);},

  async _savePromotion(id){
    const form=UI._activeModal?.querySelector('#promotion-form');if(!form)return;
    try{
      const value=name=>form.elements[name]?.value||'';
      const type=value('ruleType');
      const groups=type==='combo'?[...form.querySelectorAll('[data-promo-group]')].map((group,index)=>{
        let allowedOptions={};try{allowedOptions=JSON.parse(group.querySelector('[data-group-options]').value||'{}');}catch{throw new Error('As opções do grupo precisam estar em JSON válido.');}
        const selected=[...group.querySelectorAll('[data-group-product]:checked')].map(check=>({productId:check.value,surcharge:Number(check.closest('.promo-product-choice').querySelector('[data-group-surcharge]').value||0),allowedOptions}));
        const name=group.querySelector('[data-group-name]').value.trim();return{code:name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||`grupo-${index+1}`,name,requiredQuantity:Number(group.querySelector('[data-group-required]').value),maxQuantity:Number(group.querySelector('[data-group-maximum]').value),allowSameProduct:group.querySelector('[data-group-same]').checked,allowedOptions,products:selected};
      }):[];
      const starts=value('startsAt'),ends=value('endsAt');
      const data={code:value('code').trim().toUpperCase(),name:value('name').trim(),description:value('description').trim(),ruleType:type,
        discountPercent:type==='percentage'?Number(value('discountPercent')):null,discountAmount:type==='fixed'?Number(value('discountAmount')):null,
        comboPrice:type==='combo'&&value('comboPrice')!==''?Number(value('comboPrice')):null,startsAt:starts?new Date(starts).toISOString():null,endsAt:ends?new Date(ends).toISOString():null,
        priority:Number(value('priority')||100),stackWithCoupon:form.elements.stackWithCoupon.checked,
        cmvEstimatePercent:value('cmvEstimatePercent')===''?null:Number(value('cmvEstimatePercent')),
        productIds:type==='combo'?[]:[...form.querySelectorAll('[data-promo-target]:checked')].map(check=>check.value),groups};
      if(type==='combo'&&(!groups.length||groups.some(group=>!group.products.length)))throw new Error('Cada grupo precisa ter pelo menos um produto permitido.');
      if(type!=='combo'&&!data.productIds.length)throw new Error('Selecione os produtos que recebem o desconto.');
      const saveButton=UI._activeModal.querySelector('#modal-confirm');saveButton.disabled=true;
      await API.saveServerPromotion(data,id);this._promotions=await API.getServerPromotions();UI.closeModal();this._tab='promocoes';this._render();this._bindEvents();UI.toast('Promoção salva como rascunho.', 'success');
    }catch(error){UI.toast(this._promotionError(error.code||error.message),'danger');}
    finally{if(UI._activeModal)UI._activeModal.querySelector('#modal-confirm').disabled=false;}
  },

  async _setPromotionActive(id,active){
    try{await API.setServerPromotionActive(id,active);this._promotions=await API.getServerPromotions();this._render();this._bindEvents();UI.toast(active?'Promoção ativada.':'Promoção desativada.','success');}
    catch(error){const detail=(error.details?.productNames||error.details?.productIds?.map(productId=>this._promotionProducts.find(product=>product.id===productId)?.name||productId)||[]).join(', ');UI.toast(this._promotionError(error.code,detail),'danger');}
  },

  _promotionError(code,detail='') {return ({promotion_code_exists:'Este código já está em uso.',promotion_product_inactive_or_missing:'Revise os produtos permitidos; todos precisam estar ativos.',promotion_price_unconfigured:'Informe o preço fechado antes de ativar.',promotion_value_unconfigured:'Informe o valor do desconto antes de ativar.',combo_group_empty:'Todos os grupos precisam ter produtos permitidos.',promotion_cost_incomplete:`Não é possível calcular a margem. Complete os custos e fichas: ${detail||'veja a lista na promoção'}.`,promotion_estimate_no_margin:'O preço estimado não cobre o custo indicado pelo CMV de referência.',invalid_period:'A data final precisa ser posterior ao início.',coupon_not_combinable:'O cupom não pode ser usado junto com esta promoção.'})[code]||code||'Não foi possível salvar a promoção.';},

  _openFormCupom() {
    UI.openModal({
      title: 'Novo Cupom',
      body: `
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Código do Cupom</label>
            <input type="text" class="form-input" id="cup-codigo" placeholder="Ex: DESCONTO20" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-input" id="cup-tipo">
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Fixo (R$)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Valor</label>
            <input type="number" class="form-input" id="cup-valor" min="0.01" step="0.01" placeholder="10">
          </div>
          <div class="form-group">
            <label class="form-label">Limite de Usos</label>
            <input type="number" class="form-input" id="cup-limite" min="1" value="100">
          </div>
          <div class="form-group">
            <label class="form-label">Validade</label>
            <input type="date" class="form-input" id="cup-validade" value="${new Date(Date.now() + 90*86400000).toISOString().slice(0,10)}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <input type="text" class="form-input" id="cup-desc" placeholder="Ex: Desconto para novos clientes">
        </div>
      `,
      confirmLabel: 'Criar Cupom',
      onConfirm: () => {
        const codigo   = document.getElementById('cup-codigo')?.value?.trim().toUpperCase();
        const tipo     = document.getElementById('cup-tipo')?.value;
        const valor    = parseFloat(document.getElementById('cup-valor')?.value || 0);
        const limite   = parseInt(document.getElementById('cup-limite')?.value || 100);
        const validade = document.getElementById('cup-validade')?.value;
        const desc     = document.getElementById('cup-desc')?.value?.trim();

        if (!codigo || !valor || valor <= 0 || !validade) { UI.toast('Preencha todos os campos.', 'error'); return; }

        const cupons  = Stores.cupons.get();
        if (cupons.some(c => c.codigo === codigo)) { UI.toast('Código já existe.', 'error'); return; }
        const maxNum  = cupons.reduce((m, c) => Math.max(m, parseInt(c.id?.replace('cup-', '') || 0)), 0);
        cupons.unshift({ id: `cup-${String(maxNum + 1).padStart(3, '0')}`, codigo, tipo, valor, ativo: true, usos: 0, limite, validade, descricao: desc });
        Stores.cupons.set(cupons);
        UI.toast('Cupom criado!', 'success');
        this._render();
        this._bindEvents();
      },
    });
  },
};
