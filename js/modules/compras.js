/* ============================================================
   Petisbar Teodoro — ComprasModule
   Pedidos de compra: criação, aprovação, recebimento.
   Ao receber: atualiza estoque + custo + registra despesa.
   Gera automaticamente pedidos para ingredientes críticos.
   ============================================================ */

const ComprasModule = {
  _tab: 'compras',
  _filtroStatus: 'todos',

  init() {
    this._gerarSolicitacoesAutomaticas();
    this._render();
    this._bindEvents();
  },

  _render() {
    const el = document.getElementById('compras-content');
    if (!el) return;
    const compras = Stores.compras.get();
    const pendentes = compras.filter(c => ['Rascunho', 'Aprovado'].includes(c.status)).length;
    const totalMes  = compras.filter(c => c.status === 'Recebido' && (c.dataRecebimento || '').startsWith(Utils.currentMonth())).reduce((s, c) => s + (c.total || 0), 0);

    el.innerHTML = `
      <div class="kpi-row" style="margin-bottom:var(--sp-5)">
        <article class="kpi-card ${pendentes > 0 ? 'kpi-card--warn' : 'kpi-card--ok'}">
          <span class="kpi-card__label">Pendentes</span>
          <strong class="kpi-card__value">${pendentes}</strong>
          <small class="kpi-card__sub">aguardando ação</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Compras no Mês</span>
          <strong class="kpi-card__value">${compras.filter(c => c.status === 'Recebido' && (c.dataRecebimento || '').startsWith(Utils.currentMonth())).length}</strong>
          <small class="kpi-card__sub">pedidos recebidos</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Gasto no Mês</span>
          <strong class="kpi-card__value">${Utils.currency(totalMes)}</strong>
          <small class="kpi-card__sub">em compras</small>
        </article>
        <article class="kpi-card">
          <span class="kpi-card__label">Total Pedidos</span>
          <strong class="kpi-card__value">${compras.length}</strong>
          <small class="kpi-card__sub">registrados</small>
        </article>
      </div>

      <div class="module-tabs">
        <button class="tab-btn ${this._tab === 'compras' ? 'active' : ''}" data-cmp-tab="compras">
          Pedidos de Compra ${pendentes > 0 ? `<span class="count-badge">${pendentes}</span>` : ''}
        </button>
        <button class="tab-btn ${this._tab === 'historico' ? 'active' : ''}" data-cmp-tab="historico">Histórico</button>
      </div>

      <div id="cmp-tab-body">
        ${this._renderTab(compras)}
      </div>
    `;
  },

  _renderTab(compras) {
    if (this._tab === 'historico') return this._renderHistorico(compras);
    return this._renderCompras(compras);
  },

  _renderCompras(compras) {
    let data = compras.filter(c => c.status !== 'Recebido' && c.status !== 'Cancelado');
    if (this._filtroStatus !== 'todos') data = data.filter(c => c.status === this._filtroStatus);

    return `
      <div class="module-toolbar">
        <select class="form-input toolbar-filter" id="cmp-status-filter">
          <option value="todos" ${this._filtroStatus === 'todos' ? 'selected' : ''}>Todos os status</option>
          ${STATUS_COMPRA.slice(0,-1).map(s => `<option value="${s}" ${this._filtroStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span style="flex:1"></span>
        <button class="btn btn-ghost" id="btn-importar-cupom">📷 Importar Cupom</button>
        <button class="btn btn-ghost" id="btn-gerar-automatico">⚡ Gerar Automático</button>
        <button class="btn btn-primary" id="btn-nova-compra">+ Nova Compra</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        ${data.length ? data.map(c => this._cardCompra(c)).join('') :
          '<div class="empty-state"><p>Nenhum pedido pendente.</p></div>'}
      </div>
    `;
  },

  _renderHistorico(compras) {
    const data = [...compras].filter(c => c.status === 'Recebido' || c.status === 'Cancelado').sort((a, b) => (b.dataCompra || '').localeCompare(a.dataCompra || ''));
    return `
      <div class="table-wrap" style="margin-top:var(--sp-2)">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Fornecedor</th><th>Data</th><th>Tipo</th><th>Itens</th><th style="text-align:right">Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(c => `
              <tr>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">#${c.numeroPedidoCompra}</td>
                <td style="font-weight:600">${Utils.escapeHtml(c.fornecedorNome)}</td>
                <td style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.formatShortDate(c.dataCompra)}</td>
                <td><span class="badge ${c.tipo === 'automatico' ? 'badge-gold' : 'badge-neutral'}">${c.tipo}</span></td>
                <td style="font-size:var(--text-sm)">${c.itens.length} item(ns)</td>
                <td style="text-align:right;font-weight:700">${Utils.currency(c.total)}</td>
                <td><span class="badge ${c.status === 'Recebido' ? 'badge-success' : 'badge-danger'}">${c.status}</span></td>
              </tr>
            `).join('') :
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Sem histórico ainda.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  _cardCompra(c) {
    const statusColor = { Rascunho: 'badge-neutral', Aprovado: 'badge-gold', Pedido: 'badge-warning' };
    const acoes = {
      Rascunho: `<button class="btn btn-ghost" data-cmp-action="aprovar" data-cmp-id="${c.id}">Aprovar</button> <button class="btn btn-ghost" data-cmp-action="cancelar" data-cmp-id="${c.id}">Cancelar</button>`,
      Aprovado: `<button class="btn btn-primary" data-cmp-action="pedido" data-cmp-id="${c.id}">Marcar como Pedido</button> <button class="btn btn-ghost" data-cmp-action="cancelar" data-cmp-id="${c.id}">Cancelar</button>`,
      Pedido:   `<button class="btn btn-primary" data-cmp-action="receber" data-cmp-id="${c.id}">Confirmar Recebimento</button>`,
    };

    return `
      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-4) var(--sp-5)">
        <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-3)">
          <span style="font-weight:700">#${c.numeroPedidoCompra} — ${Utils.escapeHtml(c.fornecedorNome)}</span>
          <span class="badge ${statusColor[c.status] || 'badge-neutral'}">${c.status}</span>
          ${c.tipo === 'automatico' ? '<span class="badge badge-gold">⚡ automático</span>' : ''}
          <span style="flex:1"></span>
          <span style="font-weight:700;font-size:var(--text-lg)">${Utils.currency(c.total)}</span>
        </div>
        <div style="margin-bottom:var(--sp-3)">
          ${c.itens.map(i => `
            <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);padding:4px 0;border-bottom:1px solid var(--border-subtle)">
              <span>${Utils.escapeHtml(i.nome)}</span>
              <span style="color:var(--text-muted)">${i.quantidade} ${i.unidade} × ${Utils.currency(i.custoUnitario)} = <strong>${Utils.currency(i.subtotal)}</strong></span>
            </div>
          `).join('')}
        </div>
        ${c.observacoes ? `<p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--sp-3)">${Utils.escapeHtml(c.observacoes)}</p>` : ''}
        <div style="display:flex;gap:var(--sp-2)">
          ${acoes[c.status] || ''}
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('compras-content');
    if (!el) return;

    el.addEventListener('click', e => {
      const tab = e.target.closest('[data-cmp-tab]');
      if (tab) { this._tab = tab.dataset.cmpTab; this._render(); this._bindEvents(); return; }

      if (e.target.closest('#btn-nova-compra'))      { this._abrirModalNovaCompra(); return; }
      if (e.target.closest('#btn-importar-cupom'))  { this._importarCupom(); return; }
      if (e.target.closest('#btn-gerar-automatico')) { this._gerarSolicitacoesAutomaticas(true); this._render(); this._bindEvents(); return; }

      const action = e.target.closest('[data-cmp-action]');
      if (action) { this._executarAcao(action.dataset.cmpId, action.dataset.cmpAction); return; }
    });

    el.addEventListener('change', e => {
      if (e.target.id === 'cmp-status-filter') { this._filtroStatus = e.target.value; this._render(); this._bindEvents(); }
    });
  },

  _executarAcao(id, action) {
    const compras = Stores.compras.get();
    const compra  = compras.find(c => c.id === id);
    if (!compra) return;

    if (action === 'aprovar')  compra.status = 'Aprovado';
    if (action === 'pedido')   compra.status = 'Pedido';
    if (action === 'cancelar') { if (!confirm('Cancelar este pedido?')) return; compra.status = 'Cancelado'; }
    if (action === 'receber')  { this._confirmarRecebimento(compra); return; }

    Stores.compras.set(compras);
    this._render();
    this._bindEvents();
  },

  _confirmarRecebimento(compra) {
    compra.status = 'Recebido';
    compra.dataRecebimento = new Date().toISOString().slice(0, 10);

    const ings    = Stores.ingredientes.get();
    const movs    = Stores.movimentacoes.get();
    const alertas = []; // itens com alta ≥ 20%

    for (const item of compra.itens) {
      const ing = ings.find(i => i.id === item.ingredienteId);

      if (ing) {
        const custoAntigo = ing.custoUnitario;
        const custoNovo   = item.custoUnitario;
        const variacao    = custoAntigo > 0 ? (custoNovo - custoAntigo) / custoAntigo : 0;

        if (custoNovo < custoAntigo) {
          // Preço caiu: NÃO atualiza custo, registra streak de compras baratas
          ing._streakBarata = (ing._streakBarata || 0) + 1;
        } else {
          // Preço igual ou subiu: atualiza custo, reseta streak
          ing._streakBarata = 0;
          ing.custoUnitario = custoNovo;

          if (variacao >= 0.20) {
            // Alta significativa: salva alerta persistente no ingrediente
            ing._alertaCusto = {
              custoAnterior: custoAntigo,
              custoNovo,
              variacao,
              data: compra.dataRecebimento,
            };
            alertas.push({ ing: { ...ing, custoUnitario: custoAntigo }, custoAntigo, custoNovo, variacao, unidade: ing.unidade });
          } else if (ing._alertaCusto && custoNovo <= ing._alertaCusto.custoAnterior * 1.15) {
            // Preço voltou a nível aceitável: remove alerta
            delete ing._alertaCusto;
          }
        }

        ing.estoqueAtual += item.quantidade;
      }

      const maxMovId = movs.reduce((m, v) => Math.max(m, parseInt(v.id?.replace('mov-', '') || 0)), 0);
      movs.unshift({ id: `mov-${String(maxMovId + 1).padStart(3, '0')}`, tipo: 'entrada', ingredienteId: item.ingredienteId, ingredienteNome: item.nome, quantidade: item.quantidade, unidade: item.unidade, motivo: 'compra', referencia: compra.id, data: compra.dataRecebimento, usuario: 'admin' });
    }

    Stores.ingredientes.set(ings);
    Stores.movimentacoes.set(movs);
    this._recalcularCMV(ings);

    // Registra despesa no financeiro
    const state = Storage.getState();
    const maxId = state.finance.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0);
    state.finance.unshift({ id: maxId + 1, date: compra.dataRecebimento, description: `Compra #${compra.numeroPedidoCompra} · ${compra.fornecedorNome}`, category: 'Fornecedores', type: 'Saída', value: -compra.total });
    Storage.setState(state);

    const compras = Stores.compras.get();
    const idx = compras.findIndex(c => c.id === compra.id);
    if (idx >= 0) compras[idx] = compra;
    Stores.compras.set(compras);

    if (typeof EventBus !== 'undefined') EventBus.emit('compra.recebida', { compraId: compra.id, fornecedor: compra.fornecedorNome, total: compra.total });

    if (alertas.length) {
      this._mostrarAlertaCusto(alertas, compra.numeroPedidoCompra);
    } else {
      UI.toast(`Compra #${compra.numeroPedidoCompra} recebida! Estoque e financeiro atualizados.`, 'success');
    }

    this._render();
    this._bindEvents();
  },

  _mostrarAlertaCusto(alertas, numPedido) {
    const fichas   = Stores.fichas.get();
    const produtos = Stores.produtos.get();
    const ings     = Stores.ingredientes.get();

    const secoes = alertas.map(a => {
      // Produtos afetados via fichas técnicas
      const fichasAfetadas = fichas.filter(f => f.itens.some(i => i.ingredienteId === a.ing.id));
      const produtosAfetados = fichasAfetadas.map(f => {
        const produto = produtos.find(p => p.id === f.produtoId);
        if (!produto) return null;
        let custoAntes = 0, custoDepois = 0;
        for (const fi of f.itens) {
          const ing = ings.find(i => i.id === fi.ingredienteId);
          if (!ing) continue;
          const fator = (typeof convertUnits === 'function' ? convertUnits(fi.unidade, ing.unidade) : null) ?? 1;
          const custoBase = fi.ingredienteId === a.ing.id ? a.custoAntigo : ing.custoUnitario;
          const custoAtual = fi.ingredienteId === a.ing.id ? a.custoNovo  : ing.custoUnitario;
          custoAntes  += fi.quantidade * fator * custoBase;
          custoDepois += fi.quantidade * fator * custoAtual;
        }
        const pv = produto.precoVenda || 0;
        return {
          nome:        produto.nome,
          precoVenda:  pv,
          custoAntes,
          custoDepois,
          margemAntes:  pv > 0 ? (1 - custoAntes  / pv) * 100 : 0,
          margemDepois: pv > 0 ? (1 - custoDepois / pv) * 100 : 0,
        };
      }).filter(Boolean);

      const tabelaProdutos = produtosAfetados.length ? `
        <div style="overflow-x:auto;margin-top:var(--sp-3)">
          <table class="data-table" style="font-size:var(--text-sm)">
            <thead>
              <tr><th>Produto</th><th style="text-align:right">Preço Venda</th><th style="text-align:right">Custo Antes</th><th style="text-align:right">Custo Agora</th><th style="text-align:right">Margem Antes</th><th style="text-align:right">Margem Agora</th></tr>
            </thead>
            <tbody>
              ${produtosAfetados.map(p => `
                <tr>
                  <td style="font-weight:600">${Utils.escapeHtml(p.nome)}</td>
                  <td style="text-align:right">${Utils.currency(p.precoVenda)}</td>
                  <td style="text-align:right;color:var(--text-muted)">${Utils.currency(p.custoAntes)}</td>
                  <td style="text-align:right;font-weight:700;color:var(--color-danger)">${Utils.currency(p.custoDepois)}</td>
                  <td style="text-align:right">${p.margemAntes.toFixed(1)}%</td>
                  <td style="text-align:right;font-weight:700;color:${p.margemDepois < 40 ? 'var(--color-danger)' : 'var(--color-success)'}">${p.margemDepois.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<p style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--sp-2)">Nenhuma ficha técnica usa este insumo.</p>`;

      return `
        <div style="background:var(--bg-surface);border:1px solid var(--color-danger);border-radius:var(--radius-lg);padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-4)">
          <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2)">
            <span style="font-size:20px">🚨</span>
            <span style="font-weight:700;font-size:var(--text-lg)">${Utils.escapeHtml(a.ing.nome)}</span>
            <span class="badge badge-danger">+${Math.round(a.variacao * 100)}%</span>
            <span style="color:var(--text-muted);font-size:var(--text-sm)">${Utils.currency(a.custoAntigo)}/${a.unidade} → <strong>${Utils.currency(a.custoNovo)}/${a.unidade}</strong></span>
          </div>
          ${tabelaProdutos}
        </div>
      `;
    });

    UI.openModal({
      title: '🚨 Alerta de Custo — Alta Significativa',
      size: 'wide',
      body: `
        <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-4)">
          A compra <strong>#${numPedido}</strong> registrou insumos com aumento ≥ 20%. Confira o impacto nas margens e avalie se precisa reajustar preços.
        </p>
        ${secoes.join('')}
        <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--sp-2)">
          Este alerta também aparece no Dashboard enquanto o custo estiver elevado.
        </p>
      `,
      confirmLabel: 'Entendido',
      onConfirm: () => {},
    });
  },

  _recalcularCMV(ings) {
    // Quando o custo de um ingrediente muda, recalcula o custo de produção de produtos vinculados
    if (typeof Stores === 'undefined') return;
    // Fichas técnicas: custo é calculado em tempo real no FichasModule via calcIngredienteCost
    // Aqui apenas emitimos o evento para quem quiser reagir
    if (typeof EventBus !== 'undefined') EventBus.emit('estoque.custoAtualizado', { ingredientes: ings.length });
  },

  _gerarSolicitacoesAutomaticas(mostrarFeedback = false) {
    const ings    = Stores.ingredientes.get();
    const criticos = ings.filter(i => i.ativo && i.estoqueAtual <= i.estoqueMinimo);
    if (!criticos.length) {
      if (mostrarFeedback) UI.toast('Nenhum ingrediente abaixo do mínimo.', 'success');
      return;
    }

    const compras = Stores.compras.get();
    const pendentes = compras.filter(c => c.status !== 'Recebido' && c.status !== 'Cancelado');
    let gerados = 0;

    for (const ing of criticos) {
      const jaExiste = pendentes.some(p => p.itens.some(i => i.ingredienteId === ing.id));
      if (jaExiste) continue;

      const fornecedores = Stores.fornecedores.get();
      const forn = fornecedores.find(f => f.nome === ing.fornecedor) || fornecedores[0];
      const maxNum = compras.reduce((m, c) => Math.max(m, c.numeroPedidoCompra || 0), 0);
      const qtdSugerida = Math.max(ing.estoqueMinimo * 2 - ing.estoqueAtual, ing.estoqueMinimo);

      compras.unshift({
        id: `cmp-auto-${Date.now()}-${ing.id}`,
        numeroPedidoCompra: maxNum + 1 + gerados,
        fornecedorId: forn?.id || '',
        fornecedorNome: forn?.nome || ing.fornecedor || 'A definir',
        status: 'Rascunho',
        tipo: 'automatico',
        itens: [{ ingredienteId: ing.id, nome: ing.nome, quantidade: qtdSugerida, unidade: ing.unidade, custoUnitario: ing.custoUnitario, subtotal: qtdSugerida * ing.custoUnitario }],
        total: qtdSugerida * ing.custoUnitario,
        observacoes: `Gerado automaticamente — estoque crítico (${ing.estoqueAtual} ${ing.unidade})`,
        dataCompra: new Date().toISOString().slice(0, 10),
        dataRecebimento: '',
        notaFiscal: '',
        formaPagamento: forn?.condicoesPagamento || 'À vista',
      });
      gerados++;
    }

    if (gerados > 0) {
      Stores.compras.set(compras);
      if (mostrarFeedback) UI.toast(`${gerados} solicitação(ões) gerada(s) automaticamente.`, 'success');
    } else if (mostrarFeedback) {
      UI.toast('Todas as solicitações já foram criadas.', 'success');
    }
  },

  _abrirModalNovaCompra() {
    const fornecedores = Stores.fornecedores.get().filter(f => f.ativo);
    const ings = Stores.ingredientes.get().filter(i => i.ativo);
    let itens  = [];

    const renderItens = () => {
      const cont = document.getElementById('cmp-itens');
      if (!cont) return;
      cont.innerHTML = itens.map((it, idx) => `
        <div style="display:grid;grid-template-columns:1fr 80px 60px 90px 28px;gap:6px;align-items:center;margin-bottom:6px">
          <select class="form-input" data-cmp-it-ing="${idx}">
            ${ings.map(i => `<option value="${i.id}" ${i.id === it.ingredienteId ? 'selected' : ''}>${Utils.escapeHtml(i.nome)}</option>`).join('')}
          </select>
          <input type="number" class="form-input" data-cmp-it-qty="${idx}" min="0.001" step="0.001" value="${it.quantidade}" placeholder="Qtd">
          <input type="text" class="form-input" data-cmp-it-un="${idx}" value="${it.unidade}" placeholder="un">
          <input type="number" class="form-input" data-cmp-it-custo="${idx}" min="0" step="0.01" value="${it.custoUnitario}" placeholder="R$/un">
          <button class="btn-icon btn-icon--danger" data-cmp-it-del="${idx}" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      `).join('') + `<button class="btn btn-ghost" id="cmp-add-item" type="button" style="font-size:var(--text-sm)">+ Adicionar item</button>`;

      cont.querySelectorAll('[data-cmp-it-ing]').forEach(sel => {
        sel.addEventListener('change', e => {
          const idx = parseInt(e.target.dataset.cmpItIng);
          const ing = ings.find(i => i.id === e.target.value);
          if (ing) { itens[idx].ingredienteId = ing.id; itens[idx].unidade = ing.unidade; itens[idx].custoUnitario = ing.custoUnitario; renderItens(); }
        });
      });
      cont.querySelectorAll('[data-cmp-it-qty]').forEach(el => el.addEventListener('input', e => { itens[parseInt(e.target.dataset.cmpItQty)].quantidade = parseFloat(e.target.value) || 0; }));
      cont.querySelectorAll('[data-cmp-it-un]').forEach(el => el.addEventListener('input', e => { itens[parseInt(e.target.dataset.cmpItUn)].unidade = e.target.value; }));
      cont.querySelectorAll('[data-cmp-it-custo]').forEach(el => el.addEventListener('input', e => { itens[parseInt(e.target.dataset.cmpItCusto)].custoUnitario = parseFloat(e.target.value) || 0; }));
      cont.querySelectorAll('[data-cmp-it-del]').forEach(btn => btn.addEventListener('click', e => { itens.splice(parseInt(e.target.closest('[data-cmp-it-del]').dataset.cmpItDel), 1); renderItens(); }));
      const addBtn = cont.querySelector('#cmp-add-item');
      if (addBtn) addBtn.addEventListener('click', () => { const i = ings[0]; itens.push({ ingredienteId: i.id, nome: i.nome, quantidade: 1, unidade: i.unidade, custoUnitario: i.custoUnitario }); renderItens(); });
    };

    UI.openModal({
      title: 'Nova Compra',
      size: 'wide',
      body: `
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Fornecedor</label>
            <select class="form-input" id="cmp-forn">
              ${fornecedores.map(f => `<option value="${f.id}">${Utils.escapeHtml(f.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data</label>
            <input type="date" class="form-input" id="cmp-data" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Pagamento</label>
            <input type="text" class="form-input" id="cmp-pgto" placeholder="À vista, 30 dias…">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Itens da Compra</label>
          <div id="cmp-itens"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <input type="text" class="form-input" id="cmp-obs" placeholder="Opcional">
        </div>
      `,
      confirmLabel: 'Criar Pedido',
      onConfirm: () => {
        const fornId   = document.getElementById('cmp-forn')?.value;
        const data     = document.getElementById('cmp-data')?.value;
        const pgto     = document.getElementById('cmp-pgto')?.value?.trim();
        const obs      = document.getElementById('cmp-obs')?.value?.trim();
        const forn     = fornecedores.find(f => f.id === fornId);

        if (!itens.length) { UI.toast('Adicione pelo menos um item.', 'error'); return; }

        // Calculate subtotals and total
        const itensFinal = itens.map(it => {
          const ing = ings.find(i => i.id === it.ingredienteId);
          const sub = it.quantidade * it.custoUnitario;
          return { ...it, nome: ing?.nome || '?', subtotal: sub };
        });
        const total = itensFinal.reduce((s, i) => s + i.subtotal, 0);

        const compras = Stores.compras.get();
        const maxNum  = compras.reduce((m, c) => Math.max(m, c.numeroPedidoCompra || 0), 0);
        compras.unshift({ id: `cmp-${Date.now()}`, numeroPedidoCompra: maxNum + 1, fornecedorId: fornId, fornecedorNome: forn?.nome || 'Desconhecido', status: 'Aprovado', tipo: 'manual', itens: itensFinal, total, observacoes: obs, dataCompra: data, dataRecebimento: '', notaFiscal: '', formaPagamento: pgto });
        Stores.compras.set(compras);
        UI.toast('Pedido de compra criado!', 'success');
        this._render();
        this._bindEvents();
      },
    });

    // Start with one empty item
    if (ings.length) { itens = [{ ingredienteId: ings[0].id, nome: ings[0].nome, quantidade: 1, unidade: ings[0].unidade, custoUnitario: ings[0].custoUnitario }]; }
    setTimeout(() => renderItens(), 50);
  },

  _importarCupom() {
    if (typeof OcrService === 'undefined') {
      UI.toast('OCR não disponível nesta página.', 'error');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (file) this._processarCupomOCR(file);
    };
    input.click();
  },

  async _processarCupomOCR(file) {
    // Overlay de progresso
    const overlay = document.createElement('div');
    overlay.id = 'ocr-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;font-family:var(--font-body)';
    overlay.innerHTML = `
      <div style="font-size:18px;font-weight:600">Lendo cupom fiscal…</div>
      <div style="width:260px;height:8px;background:rgba(255,255,255,.2);border-radius:4px;overflow:hidden">
        <div id="ocr-bar" style="height:100%;width:0%;background:var(--color-brand);transition:width .2s"></div>
      </div>
      <div id="ocr-pct" style="font-size:13px;color:rgba(255,255,255,.7)">0%</div>
    `;
    document.body.appendChild(overlay);

    try {
      const texto = await OcrService.processar(file, pct => {
        const bar = document.getElementById('ocr-bar');
        const pctEl = document.getElementById('ocr-pct');
        if (bar) bar.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
      });
      const { itens, total } = OcrService.parsearCupom(texto);
      document.body.removeChild(overlay);

      if (!itens.length) {
        UI.toast('Não foi possível identificar itens no cupom. Tente uma foto mais nítida.', 'warning');
        return;
      }

      // Auto-match ingredientes
      const ings = Stores.ingredientes.get().filter(i => i.ativo);
      itens.forEach(it => {
        const match = OcrService.matchIngrediente(it.nome, ings);
        if (match) it.ingredienteId = match.id;
      });

      this._mostrarRevisaoCupom(itens, total);
    } catch (err) {
      if (document.getElementById('ocr-overlay')) document.body.removeChild(overlay);
      UI.toast('Erro ao processar imagem: ' + (err.message || 'desconhecido'), 'error');
    }
  },

  _mostrarRevisaoCupom(itens, total) {
    const ings = Stores.ingredientes.get().filter(i => i.ativo);
    const fornecedores = Stores.fornecedores.get().filter(f => f.ativo);

    const optsIng = `<option value="">— Não vincular —</option>` +
      ings.map(i => `<option value="${i.id}">${Utils.escapeHtml(i.nome)}</option>`).join('');

    const renderLinhas = (its) => its.map((it, idx) => `
      <tr>
        <td style="padding:4px 6px">
          <input type="text" class="form-input" style="font-size:var(--text-sm)" data-ocr-nome="${idx}" value="${Utils.escapeHtml(it.nome)}">
        </td>
        <td style="padding:4px 6px">
          <input type="number" class="form-input" style="font-size:var(--text-sm);width:80px" data-ocr-qty="${idx}" value="${it.quantidade}" min="0.001" step="0.001">
        </td>
        <td style="padding:4px 6px">
          <input type="text" class="form-input" style="font-size:var(--text-sm);width:60px" data-ocr-un="${idx}" value="${it.unidade}">
        </td>
        <td style="padding:4px 6px">
          <input type="number" class="form-input" style="font-size:var(--text-sm);width:90px" data-ocr-cu="${idx}" value="${it.custoUnitario}" min="0" step="0.01">
        </td>
        <td style="padding:4px 6px">
          <select class="form-input" style="font-size:var(--text-sm)" data-ocr-ing="${idx}">
            ${optsIng.replace(`value="${it.ingredienteId}"`, `value="${it.ingredienteId}" selected`)}
          </select>
        </td>
        <td style="padding:4px 6px;text-align:center">
          <button type="button" class="btn-icon btn-icon--danger" data-ocr-del="${idx}">✕</button>
        </td>
      </tr>
    `).join('');

    UI.openModal({
      title: '📷 Revisão do Cupom Fiscal',
      size: 'wide',
      body: `
        <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-3)">
          Confira e corrija os itens detectados antes de importar. Vincule cada item a um ingrediente do estoque.
        </p>
        <div style="overflow-x:auto;margin-bottom:var(--sp-4)">
          <table class="data-table" id="ocr-table">
            <thead>
              <tr>
                <th>Descrição</th><th>Qtd</th><th>Un</th><th>R$/un</th><th>Ingrediente</th><th></th>
              </tr>
            </thead>
            <tbody id="ocr-tbody">
              ${renderLinhas(itens)}
            </tbody>
          </table>
        </div>
        ${total > 0 ? `<p style="text-align:right;font-weight:700;margin-bottom:var(--sp-3)">Total do cupom: ${Utils.currency(total)}</p>` : ''}
        <div class="form-row" style="margin-bottom:var(--sp-3)">
          <div class="form-group" style="flex:2">
            <label class="form-label">Fornecedor</label>
            <select class="form-input" id="ocr-forn">
              <option value="">Selecionar…</option>
              ${fornecedores.map(f => `<option value="${f.id}">${Utils.escapeHtml(f.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data da Compra</label>
            <input type="date" class="form-input" id="ocr-data" value="${new Date().toISOString().slice(0,10)}">
          </div>
        </div>
      `,
      onConfirm: () => {
        // Coleta dados revisados da tabela
        const tbody = document.getElementById('ocr-tbody');
        if (!tbody) return;
        const linhas = tbody.querySelectorAll('tr');
        const itensFinal = [];
        linhas.forEach((tr, idx) => {
          const nome   = tr.querySelector(`[data-ocr-nome="${idx}"]`)?.value?.trim() || '';
          const qty    = parseFloat(tr.querySelector(`[data-ocr-qty="${idx}"]`)?.value || 0);
          const un     = tr.querySelector(`[data-ocr-un="${idx}"]`)?.value?.trim() || 'un';
          const cu     = parseFloat(tr.querySelector(`[data-ocr-cu="${idx}"]`)?.value || 0);
          const ingId  = tr.querySelector(`[data-ocr-ing="${idx}"]`)?.value || '';
          if (nome && qty > 0) {
            itensFinal.push({ ingredienteId: ingId, nome, quantidade: qty, unidade: un, custoUnitario: cu, subtotal: qty * cu });
          }
        });

        if (!itensFinal.length) { UI.toast('Nenhum item válido para importar.', 'error'); return; }

        const fornId   = document.getElementById('ocr-forn')?.value || '';
        const forn     = fornecedores.find(f => f.id === fornId);
        const data     = document.getElementById('ocr-data')?.value || new Date().toISOString().slice(0,10);
        const totalFinal = itensFinal.reduce((s, i) => s + i.subtotal, 0);

        const compras  = Stores.compras.get();
        const maxNum   = compras.reduce((m, c) => Math.max(m, c.numeroPedidoCompra || 0), 0);
        const novaCompra = {
          id: `cmp-ocr-${Date.now()}`,
          numeroPedidoCompra: maxNum + 1,
          fornecedorId: fornId,
          fornecedorNome: forn?.nome || 'Importado via OCR',
          status: 'Pedido',
          tipo: 'manual',
          itens: itensFinal,
          total: totalFinal,
          observacoes: 'Importado via OCR (cupom fiscal)',
          dataCompra: data,
          dataRecebimento: '',
          notaFiscal: '',
          formaPagamento: 'À vista',
        };
        compras.unshift(novaCompra);
        Stores.compras.set(compras);

        // Confirmar recebimento imediatamente (atualiza estoque + financeiro)
        this._confirmarRecebimento(novaCompra);
        UI.toast(`${itensFinal.length} item(ns) importados do cupom. Estoque atualizado!`, 'success');
      },
    });

    // Bind delete em linhas da tabela após renderizar
    setTimeout(() => {
      document.getElementById('ocr-tbody')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-ocr-del]');
        if (btn) btn.closest('tr').remove();
      });
    }, 50);
  },
};
