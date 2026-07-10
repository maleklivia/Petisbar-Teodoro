/* ============================================================
   Distrito OS — MarketingModule
   Gestão de cupons, clientes VIP e reativação de inativos.
   ============================================================ */

const MarketingModule = {
  _tab: 'cupons',

  init() {
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
      </div>

      <div id="mkt-tab-body">
        ${this._renderTab(cupons, vips, inativos)}
      </div>
    `;
  },

  _renderTab(cupons, vips, inativos) {
    if (this._tab === 'vips')     return this._renderVIPs(vips);
    if (this._tab === 'inativos') return this._renderInativos(inativos);
    return this._renderCupons(cupons);
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
