/* ============================================================
   Distrito OS — RelatoriosModule
   Relatórios analíticos: Vendas, CMV, Estoque e Clientes.
   Todos read-only, com opção de impressão.
   ============================================================ */

const RelatoriosModule = {
  _tab: 'vendas',
  _periodo: 'mes',

  init() {
    this._render();
    this._bindEvents();
  },

  _render() {
    const el = document.getElementById('relatorios-content');
    if (!el) return;

    el.innerHTML = `
      <div class="module-tabs">
        <button class="tab-btn ${this._tab === 'vendas' ? 'active' : ''}" data-rel-tab="vendas">Vendas</button>
        <button class="tab-btn ${this._tab === 'cmv' ? 'active' : ''}" data-rel-tab="cmv">CMV</button>
        <button class="tab-btn ${this._tab === 'estoque' ? 'active' : ''}" data-rel-tab="estoque">Estoque</button>
        <button class="tab-btn ${this._tab === 'clientes' ? 'active' : ''}" data-rel-tab="clientes">Clientes</button>
      </div>
      <div id="rel-tab-body">
        ${this._renderTab()}
      </div>
    `;
  },

  _renderTab() {
    if (this._tab === 'cmv')      return this._renderCMV();
    if (this._tab === 'estoque')  return this._renderEstoque();
    if (this._tab === 'clientes') return this._renderClientes();
    return this._renderVendas();
  },

  _renderVendas() {
    const state   = Storage.getState();
    const finance = state.finance || [];
    const mes     = Utils.currentMonth();

    const filtrar = (f) => {
      if (this._periodo === 'hoje') return (f.date || '').startsWith(Utils.today());
      if (this._periodo === 'semana') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return (f.date || '') >= d.toISOString().slice(0, 10);
      }
      return (f.date || '').startsWith(mes);
    };

    const data      = finance.filter(filtrar);
    const receita   = data.filter(f => f.type === 'Entrada').reduce((s, f) => s + (f.value || 0), 0);
    const despesas  = data.filter(f => f.type === 'Saída').reduce((s, f) => s + Math.abs(f.value || 0), 0);
    const lucro     = receita - despesas;

    // Group by day
    const porDia = {};
    for (const f of data.filter(f2 => f2.type === 'Entrada' && f2.category === 'Vendas')) {
      const d = f.date || 'S/D';
      if (!porDia[d]) porDia[d] = 0;
      porDia[d] += f.value || 0;
    }
    const dias = Object.entries(porDia).sort((a, b) => b[0].localeCompare(a[0]));

    return `
      <div class="module-toolbar">
        <select class="form-input toolbar-filter" id="rel-periodo">
          <option value="hoje" ${this._periodo === 'hoje' ? 'selected' : ''}>Hoje</option>
          <option value="semana" ${this._periodo === 'semana' ? 'selected' : ''}>Últimos 7 dias</option>
          <option value="mes" ${this._periodo === 'mes' ? 'selected' : ''}>Este mês</option>
        </select>
        <span style="flex:1"></span>
        <button class="btn btn-ghost" onclick="window.print()">↓ Imprimir</button>
      </div>

      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card kpi-card--ok">
          <span class="kpi-card__label">Receita</span>
          <strong class="kpi-card__value">${Utils.currency(receita)}</strong>
          <small class="kpi-card__sub">entradas</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Despesas</span>
          <strong class="kpi-card__value">${Utils.currency(despesas)}</strong>
          <small class="kpi-card__sub">saídas</small>
        </article>
        <article class="kpi-card ${lucro < 0 ? 'kpi-card--warn' : 'kpi-card--ok'}">
          <span class="kpi-card__label">Resultado</span>
          <strong class="kpi-card__value">${Utils.currency(lucro)}</strong>
          <small class="kpi-card__sub">${Utils.pct(receita > 0 ? lucro / receita : 0)} margem</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Pedidos (v0.3)</span>
          <strong class="kpi-card__value">${Stores.pedidos.get().filter(p => p.status === 'Entregue').length}</strong>
          <small class="kpi-card__sub">entregues</small>
        </article>
      </div>

      ${dias.length > 0 ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Data</th><th style="text-align:right">Faturamento</th><th style="text-align:right">Barra</th></tr></thead>
            <tbody>
              ${(() => {
                const maxVal = Math.max(...dias.map(([,v]) => v), 1);
                return dias.map(([d, v]) => `
                  <tr>
                    <td style="font-size:var(--text-sm)">${Utils.formatShortDate(d)}</td>
                    <td style="text-align:right;font-weight:700">${Utils.currency(v)}</td>
                    <td style="width:200px">
                      <div style="height:8px;background:var(--bg-raised);border-radius:4px;overflow:hidden">
                        <div style="width:${(v/maxVal*100).toFixed(0)}%;height:100%;background:var(--color-gold);border-radius:4px"></div>
                      </div>
                    </td>
                  </tr>
                `).join('');
              })()}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><p>Nenhum dado de venda no período.</p></div>'}
    `;
  },

  _renderCMV() {
    const fichas     = Stores.fichas.get();
    const produtos   = Stores.produtos.get();
    const ings       = Stores.ingredientes.get();
    const config     = Stores.config.get();
    const meta       = config.metas?.cmvMeta || 35;

    const rows = produtos.filter(p => p.ativo).map(p => {
      const ficha = fichas.find(f => f.produtoId === p.id);
      let custo = 0;
      if (ficha) {
        for (const it of ficha.itens) {
          const ing = ings.find(i => i.id === it.ingredienteId);
          if (!ing) continue;
          const c = calcIngredienteCost(ing, it.quantidade, it.unidade);
          if (c !== null) custo += c;
        }
      }
      const cmvPct = p.precoVenda > 0 ? (custo / p.precoVenda) * 100 : 0;
      return { ...p, custo, cmvPct };
    }).sort((a, b) => b.cmvPct - a.cmvPct);

    const acimaMeta = rows.filter(r => r.cmvPct > meta).length;

    return `
      <div style="margin-bottom:var(--sp-4);color:var(--text-muted);font-size:var(--text-sm)">
        Meta de CMV: <strong>${meta}%</strong> · Produtos acima da meta: <strong style="color:${acimaMeta > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${acimaMeta}</strong>
        <button class="btn btn-ghost" onclick="window.print()" style="float:right;font-size:var(--text-sm)">↓ Imprimir</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th style="text-align:right">Preço Venda</th>
              <th style="text-align:right">Custo</th>
              <th style="text-align:right">CMV%</th>
              <th style="text-align:right">Margem</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(r => {
              const sobre = r.cmvPct > meta;
              const margem = r.precoVenda > 0 ? ((r.precoVenda - r.custo) / r.precoVenda * 100).toFixed(1) : 0;
              return `
                <tr>
                  <td style="font-weight:600">${Utils.escapeHtml(r.nome)}</td>
                  <td style="font-size:var(--text-sm);color:var(--text-muted)">${Utils.escapeHtml(r.categoria)}</td>
                  <td style="text-align:right">${Utils.currency(r.precoVenda)}</td>
                  <td style="text-align:right">${Utils.currency(r.custo)}</td>
                  <td style="text-align:right;font-weight:700;color:${sobre ? 'var(--color-danger)' : 'var(--color-success)'}">${r.cmvPct.toFixed(1)}%</td>
                  <td style="text-align:right">${margem}%</td>
                  <td>${sobre ? '<span class="badge badge-danger">Acima da meta</span>' : '<span class="badge badge-success">OK</span>'}</td>
                </tr>
              `;
            }).join('') :
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum produto com ficha técnica.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderEstoque() {
    const ings = Stores.ingredientes.get().filter(i => i.ativo);
    const valorTotal = ings.reduce((s, i) => s + (i.estoqueAtual * i.custoUnitario), 0);
    const criticos   = ings.filter(i => i.estoqueAtual <= i.estoqueMinimo).length;

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4)">
        <div>
          Valor total em estoque: <strong>${Utils.currency(valorTotal)}</strong> ·
          Itens críticos: <strong style="color:${criticos > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${criticos}</strong>
        </div>
        <button class="btn btn-ghost" onclick="window.print()" style="font-size:var(--text-sm)">↓ Imprimir</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Categoria</th>
              <th style="text-align:right">Estoque</th>
              <th style="text-align:right">Mínimo</th>
              <th style="text-align:right">Custo/Un</th>
              <th style="text-align:right">Valor Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${ings.map(i => {
              const crit = i.estoqueAtual <= i.estoqueMinimo;
              return `
                <tr>
                  <td style="font-weight:600">${Utils.escapeHtml(i.nome)}</td>
                  <td style="font-size:var(--text-sm);color:var(--text-muted)">${Utils.escapeHtml(i.categoria)}</td>
                  <td style="text-align:right;font-weight:700;color:${crit ? 'var(--color-danger)' : 'var(--text-primary)'}">${i.estoqueAtual} ${i.unidade}</td>
                  <td style="text-align:right;color:var(--text-muted)">${i.estoqueMinimo} ${i.unidade}</td>
                  <td style="text-align:right;font-size:var(--text-sm)">${Utils.currency(i.custoUnitario)}</td>
                  <td style="text-align:right;font-weight:600">${Utils.currency(i.estoqueAtual * i.custoUnitario)}</td>
                  <td>${crit ? '<span class="badge badge-danger">Crítico</span>' : '<span class="badge badge-success">OK</span>'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--bg-raised)">
              <td colspan="5" style="font-weight:700">Total</td>
              <td style="text-align:right;font-weight:700">${Utils.currency(valorTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  },

  _renderClientes() {
    const clientes = Stores.clientes.get();
    const pedidos  = Stores.pedidos.get();

    const rows = clientes.map(c => {
      const ped = pedidos.filter(p => p.clienteId === c.id && p.status === 'Entregue');
      const total = ped.reduce((s, p) => s + (p.total || 0), 0);
      const datas = ped.map(p => p.dataCriacao).sort().reverse();
      return { ...c, _pedidos: ped.length, _total: total, _ticket: ped.length > 0 ? total / ped.length : 0, _ultimo: datas[0]?.slice(0, 10) || null };
    }).sort((a, b) => b._total - a._total);

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4)">
        <div>Total de clientes: <strong>${clientes.length}</strong></div>
        <button class="btn btn-ghost" onclick="window.print()" style="font-size:var(--text-sm)">↓ Imprimir</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th style="text-align:right">Pedidos</th>
              <th style="text-align:right">Total Gasto</th>
              <th style="text-align:right">Ticket Médio</th>
              <th>Último Pedido</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((c, i) => `
              <tr>
                <td style="font-family:var(--font-display);color:${i < 3 ? 'var(--color-gold)' : 'var(--text-muted)'};font-size:var(--text-xl)">${i + 1}</td>
                <td>
                  <div style="font-weight:600">${Utils.escapeHtml(c.nome)}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.escapeHtml(c.telefone || '')}</div>
                </td>
                <td style="text-align:right;font-weight:700">${c._pedidos}</td>
                <td style="text-align:right;font-weight:700;color:var(--color-success)">${Utils.currency(c._total)}</td>
                <td style="text-align:right">${Utils.currency(c._ticket)}</td>
                <td style="font-size:var(--text-sm);color:var(--text-muted)">${c._ultimo ? Utils.formatShortDate(c._ultimo) : '—'}</td>
              </tr>
            `).join('') :
              '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum cliente.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('relatorios-content');
    if (!el) return;

    el.addEventListener('click', e => {
      const tab = e.target.closest('[data-rel-tab]');
      if (tab) { this._tab = tab.dataset.relTab; this._render(); this._bindEvents(); return; }
    });

    el.addEventListener('change', e => {
      if (e.target.id === 'rel-periodo') { this._periodo = e.target.value; this._render(); this._bindEvents(); }
    });
  },
};
