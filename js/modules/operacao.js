const OperacaoModule = {
  _tab: 'caixa',

  init() {
    document.querySelectorAll('[data-operation-tab]').forEach(button => {
      button.addEventListener('click', () => {
        this._tab = button.dataset.operationTab;
        document.querySelectorAll('[data-operation-tab]').forEach(item => item.classList.toggle('active', item === button));
        this._render();
      });
    });
    this._render();
  },

  _orders() { return Stores.pedidos.get(); },
  _today() { return new Date().toISOString().slice(0, 10); },
  _money(value) { return Utils.currency(Number(value) || 0); },

  _render() {
    this._renderSummary();
    const content = document.getElementById('operation-content');
    if (!content) return;
    const renderer = this[`_render${this._tab[0].toUpperCase()}${this._tab.slice(1)}`];
    content.innerHTML = renderer ? renderer.call(this) : '';
    this._bindCurrentTab();
  },

  _renderSummary() {
    const orders = this._orders();
    const today = this._today();
    const openCash = Stores.caixa.get().find(session => !session.fechadoEm);
    const tables = Stores.mesas.get();
    const scheduled = orders.filter(order => order.agendadoPara && !['Entregue', 'Cancelado'].includes(order.status));
    const deliveries = orders.filter(order => order.status === 'Saiu para Entrega').length;
    document.getElementById('operation-summary').innerHTML = [
      ['Caixa', openCash ? 'Aberto' : 'Fechado', openCash ? `desde ${new Date(openCash.abertoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'abra antes de vender'],
      ['Mesas ocupadas', tables.filter(table => table.status === 'ocupada').length, `${tables.length} cadastradas`],
      ['Agendados', scheduled.length, 'aguardando horário'],
      ['Em entrega', deliveries, `${orders.filter(order => order.dataCriacao?.startsWith(today)).length} pedidos hoje`],
    ].map(([label,value,sub]) => `<article class="operation-card"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`).join('');
  },

  _renderCaixa() {
    const sessions = Stores.caixa.get();
    const current = sessions.find(session => !session.fechadoEm);
    if (!current) return `<div class="cash-status"><div class="operation-toolbar"><div><h3>Caixa fechado</h3><p class="operation-item__meta">Abra o caixa informando o fundo inicial antes de registrar vendas.</p></div><button class="btn btn-primary" id="cash-open">Abrir caixa</button></div></div>${this._cashHistory(sessions)}`;
    const delivered = this._orders().filter(order => order.status === 'Entregue' && order.dataAtualizacao >= current.abertoEm);
    const sales = delivered.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const expected = Number(current.fundoInicial || 0) + sales + (current.movimentos || []).reduce((sum, movement) => sum + (movement.tipo === 'entrada' ? movement.valor : -movement.valor), 0);
    return `<div class="cash-status cash-status--open"><div class="operation-toolbar"><div><h3>Caixa aberto</h3><p class="operation-item__meta">Aberto em ${new Date(current.abertoEm).toLocaleString('pt-BR')}</p></div><button class="btn btn-danger" id="cash-close">Fechar caixa</button></div><div class="cash-values"><div><span>Fundo inicial</span><strong>${this._money(current.fundoInicial)}</strong></div><div><span>Vendas entregues</span><strong>${this._money(sales)}</strong></div><div><span>Saldo esperado</span><strong>${this._money(expected)}</strong></div></div><div class="operation-actions"><button class="btn btn-secondary" data-cash-move="entrada">+ Suprimento</button><button class="btn btn-secondary" data-cash-move="saida">− Sangria</button></div></div>${this._cashHistory(sessions)}`;
  },

  _cashHistory(sessions) {
    const closed = sessions.filter(session => session.fechadoEm).slice(0, 5);
    if (!closed.length) return '';
    return `<div class="panel" style="margin-top:16px"><div class="panel__header"><span class="panel__title">Últimos fechamentos</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Esperado</th><th>Informado</th><th>Diferença</th></tr></thead><tbody>${closed.map(session => `<tr><td>${new Date(session.fechadoEm).toLocaleString('pt-BR')}</td><td>${this._money(session.saldoEsperado)}</td><td>${this._money(session.saldoInformado)}</td><td>${this._money(session.diferenca)}</td></tr>`).join('')}</tbody></table></div></div>`;
  },

  _renderMesas() {
    const tables = Stores.mesas.get();
    return `<div class="operation-toolbar"><div><h3>Mesas e comandas digitais</h3><p class="operation-item__meta">Cada QR Code abre o cardápio já identificado com a mesa.</p></div><button class="btn btn-primary" id="table-add">+ Cadastrar mesa</button></div>${tables.length ? `<div class="operation-grid">${tables.map(table => { const link = `${location.origin}${location.pathname.replace(/pages\/operacao\.html.*$/, '')}cardapio.html?mesa=${encodeURIComponent(table.numero)}`; const qr = `https://quickchart.io/qr?size=220&text=${encodeURIComponent(link)}`; return `<article class="operation-item"><div class="operation-item__head"><div><h3>Mesa ${Utils.escapeHtml(table.numero)}</h3><span class="badge ${table.status === 'ocupada' ? 'badge-warning' : 'badge-success'}">${table.status}</span></div></div><div class="qr-preview"><img src="${qr}" alt="QR Code da mesa ${Utils.escapeHtml(table.numero)}"></div><p class="operation-item__meta">${Utils.escapeHtml(link)}</p><div class="operation-actions"><button class="btn btn-sm btn-secondary" data-table-toggle="${table.id}">${table.status === 'ocupada' ? 'Liberar' : 'Ocupar'}</button><button class="btn btn-sm btn-secondary" data-table-copy="${table.id}">Copiar link</button><button class="btn btn-sm btn-danger" data-table-remove="${table.id}">Excluir</button></div></article>`; }).join('')}</div>` : '<div class="operation-empty">Cadastre as mesas para gerar os links e QR Codes.</div>'}`;
  },

  _renderAgendados() {
    const orders = this._orders().filter(order => order.agendadoPara).sort((a,b) => a.agendadoPara.localeCompare(b.agendadoPara));
    return `<div class="operation-toolbar"><div><h3>Pedidos agendados</h3><p class="operation-item__meta">Os agendamentos são definidos ao criar o pedido no PDV.</p></div><a class="btn btn-primary" href="pedidos.html">+ Novo pedido</a></div>${orders.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Horário</th><th>Pedido</th><th>Cliente</th><th>Total</th><th>Status</th></tr></thead><tbody>${orders.map(order => `<tr><td><strong>${new Date(order.agendadoPara).toLocaleString('pt-BR')}</strong></td><td>#${order.numeroPedido}</td><td>${Utils.escapeHtml(order.clienteNome)}</td><td>${this._money(order.total)}</td><td><span class="badge badge-neutral">${Utils.escapeHtml(order.status)}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="operation-empty">Nenhum pedido agendado.</div>'}`;
  },

  _renderEntregadores() {
    const drivers = Stores.entregadores.get();
    return `<div class="operation-toolbar"><div><h3>Entregadores</h3><p class="operation-item__meta">Cadastre disponibilidade, telefone e veículo.</p></div><button class="btn btn-primary" id="driver-add">+ Entregador</button></div>${drivers.length ? `<div class="operation-grid">${drivers.map(driver => `<article class="operation-item"><div class="operation-item__head"><h3>${Utils.escapeHtml(driver.nome)}</h3><span class="badge ${driver.ativo ? 'badge-success' : 'badge-neutral'}">${driver.ativo ? 'disponível' : 'indisponível'}</span></div><p class="operation-item__meta">${Utils.escapeHtml(driver.telefone || 'Sem telefone')}<br>${Utils.escapeHtml(driver.veiculo || 'Veículo não informado')}</p><div class="operation-actions"><button class="btn btn-sm btn-secondary" data-driver-toggle="${driver.id}">Alterar disponibilidade</button><button class="btn btn-sm btn-danger" data-driver-remove="${driver.id}">Excluir</button></div></article>`).join('')}</div>` : '<div class="operation-empty">Nenhum entregador cadastrado. O plano Entrega do iFood continuará sendo tratado pela integração do iFood.</div>'}`;
  },

  _renderFidelidade() {
    const settings = Stores.fidelidade.get();
    const orders = this._orders().filter(order => order.status === 'Entregue' && order.clienteId);
    const clients = Stores.clientes.get();
    const totals = new Map();
    orders.forEach(order => totals.set(order.clienteId, (totals.get(order.clienteId) || 0) + Number(order.total || 0)));
    const ranked = [...totals.entries()].map(([id,total]) => ({client:clients.find(c=>c.id===id),total})).filter(item=>item.client).sort((a,b)=>b.total-a.total);
    return `<div class="loyalty-box"><section class="loyalty-settings"><h3>Cashback e fidelidade</h3><p class="operation-item__meta">Configure a regra agora. O crédito automático e o bloqueio de uso serão ativados no banco do VPS.</p><div class="form-group" style="margin-top:16px"><label class="form-label">Percentual de cashback</label><input class="form-input" id="loyalty-percent" type="number" min="0" max="30" step="0.5" value="${settings.percentualCashback}"></div><div class="form-group" style="margin-top:12px"><label class="form-label">Validade do crédito (dias)</label><input class="form-input" id="loyalty-days" type="number" min="1" max="365" value="${settings.validadeDias}"></div><label style="display:flex;gap:10px;align-items:center;margin-top:16px"><input id="loyalty-active" type="checkbox" ${settings.ativo?'checked':''}> Ativar programa ao subir o VPS</label><button class="btn btn-primary" id="loyalty-save" style="margin-top:16px">Salvar regra</button></section><section class="loyalty-list"><h3>Clientes recorrentes</h3><p class="operation-item__meta">Base para recuperação de vendas e campanhas.</p>${ranked.length ? `<div style="margin-top:14px">${ranked.slice(0,10).map(item=>`<div class="operation-item__head"><span>${Utils.escapeHtml(item.client.nome)}</span><strong>${this._money(item.total)}</strong></div>`).join('')}</div>` : '<div class="operation-empty" style="margin-top:16px">A lista aparecerá após as primeiras vendas identificadas.</div>'}</section></div>`;
  },

  _bindCurrentTab() {
    document.getElementById('cash-open')?.addEventListener('click', () => this._openCash());
    document.getElementById('cash-close')?.addEventListener('click', () => this._closeCash());
    document.querySelectorAll('[data-cash-move]').forEach(button => button.addEventListener('click', () => this._cashMovement(button.dataset.cashMove)));
    document.getElementById('table-add')?.addEventListener('click', () => this._addTable());
    document.querySelectorAll('[data-table-toggle]').forEach(button => button.addEventListener('click', () => this._toggleTable(button.dataset.tableToggle)));
    document.querySelectorAll('[data-table-remove]').forEach(button => button.addEventListener('click', () => this._remove('mesas', button.dataset.tableRemove)));
    document.querySelectorAll('[data-table-copy]').forEach(button => button.addEventListener('click', () => this._copyTable(button.dataset.tableCopy)));
    document.getElementById('driver-add')?.addEventListener('click', () => this._addDriver());
    document.querySelectorAll('[data-driver-toggle]').forEach(button => button.addEventListener('click', () => this._toggleDriver(button.dataset.driverToggle)));
    document.querySelectorAll('[data-driver-remove]').forEach(button => button.addEventListener('click', () => this._remove('entregadores', button.dataset.driverRemove)));
    document.getElementById('loyalty-save')?.addEventListener('click', () => this._saveLoyalty());
  },

  _openCash() { UI.openModal({title:'Abrir caixa',body:'<form><div class="form-group"><label class="form-label">Fundo inicial (R$)</label><input class="form-input" name="valor" type="number" min="0" step="0.01" value="0" required></div></form>',confirmLabel:'Abrir caixa',onConfirm:data=>{const amount=Number(data.valor);if(!Number.isFinite(amount)||amount<0)return UI.toast('Valor inválido.','warning');const all=Stores.caixa.get();all.unshift({id:`cx-${Utils.uid()}`,abertoEm:new Date().toISOString(),fundoInicial:amount,movimentos:[]});Stores.caixa.set(all);UI.closeModal();this._render();UI.toast('Caixa aberto.');}}); },
  _closeCash() { const all=Stores.caixa.get(),current=all.find(s=>!s.fechadoEm);if(!current)return;const delivered=this._orders().filter(o=>o.status==='Entregue'&&o.dataAtualizacao>=current.abertoEm);const sales=delivered.reduce((s,o)=>s+Number(o.total||0),0);const expected=Number(current.fundoInicial)+sales+(current.movimentos||[]).reduce((s,m)=>s+(m.tipo==='entrada'?m.valor:-m.valor),0);UI.openModal({title:'Fechar caixa',body:`<form><p class="operation-item__meta">Saldo esperado: <strong>${this._money(expected)}</strong></p><div class="form-group" style="margin-top:16px"><label class="form-label">Valor contado (R$)</label><input class="form-input" name="valor" type="number" min="0" step="0.01" value="${expected.toFixed(2)}" required></div></form>`,confirmLabel:'Confirmar fechamento',confirmClass:'btn-danger',onConfirm:data=>{const counted=Number(data.valor);if(!Number.isFinite(counted)||counted<0)return UI.toast('Valor inválido.','warning');Object.assign(current,{fechadoEm:new Date().toISOString(),saldoEsperado:expected,saldoInformado:counted,diferenca:counted-expected});Stores.caixa.set(all);UI.closeModal();this._render();UI.toast('Caixa fechado.');}}); },
  _cashMovement(type) { UI.openModal({title:type==='entrada'?'Registrar suprimento':'Registrar sangria',body:'<form><div class="form-group"><label class="form-label">Valor (R$)</label><input class="form-input" name="valor" type="number" min="0.01" step="0.01" required></div></form>',confirmLabel:'Registrar',onConfirm:data=>{const amount=Number(data.valor);if(!Number.isFinite(amount)||amount<=0)return UI.toast('Valor inválido.','warning');const all=Stores.caixa.get(),current=all.find(s=>!s.fechadoEm);if(!current)return UI.toast('Abra o caixa primeiro.','warning');current.movimentos.push({id:`mov-${Utils.uid()}`,tipo:type,valor:amount,data:new Date().toISOString()});Stores.caixa.set(all);UI.closeModal();this._render();UI.toast('Movimento registrado.');}}); },
  _addTable() { UI.openModal({title:'Cadastrar mesa',body:'<form><div class="form-group"><label class="form-label">Número ou nome da mesa</label><input class="form-input" name="numero" maxlength="20" required></div></form>',confirmLabel:'Cadastrar',onConfirm:data=>{const number=data.numero?.trim();if(!number)return UI.toast('Informe a mesa.','warning');const all=Stores.mesas.get();if(all.some(t=>String(t.numero).toLowerCase()===number.toLowerCase()))return UI.toast('Essa mesa já existe.','warning');all.push({id:`mesa-${Utils.uid()}`,numero:number,status:'livre'});Stores.mesas.set(all);UI.closeModal();this._render();UI.toast('Mesa cadastrada.');}}); },
  _toggleTable(id) { const all=Stores.mesas.get(),table=all.find(t=>t.id===id); if(table)table.status=table.status==='ocupada'?'livre':'ocupada'; Stores.mesas.set(all); this._render(); },
  async _copyTable(id) { const table=Stores.mesas.get().find(t=>t.id===id); if(!table)return; const link=`${location.origin}${location.pathname.replace(/pages\/operacao\.html.*$/,'')}cardapio.html?mesa=${encodeURIComponent(table.numero)}`; try { if(!navigator.clipboard?.writeText)throw new Error('clipboard_unavailable'); await navigator.clipboard.writeText(link); UI.toast('Link copiado.'); } catch { UI.openModal({title:'Link da mesa',body:`<form><div class="form-group"><label class="form-label">Copie este link</label><input class="form-input" value="${Utils.escapeHtml(link)}" readonly></div></form>`,confirmLabel:'Fechar',onConfirm:()=>UI.closeModal()}); } },
  _addDriver() { UI.openModal({title:'Novo entregador',body:'<form><div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="nome" required></div><div class="form-group" style="margin-top:12px"><label class="form-label">Telefone</label><input class="form-input" name="telefone"></div><div class="form-group" style="margin-top:12px"><label class="form-label">Veículo</label><input class="form-input" name="veiculo" placeholder="Moto, bicicleta..."></div></form>',onConfirm:data=>{if(!data.nome?.trim())return UI.toast('Informe o nome.','warning');const all=Stores.entregadores.get();all.push({id:`ent-${Utils.uid()}`,nome:data.nome.trim(),telefone:data.telefone.trim(),veiculo:data.veiculo.trim(),ativo:true});Stores.entregadores.set(all);UI.closeModal();this._render();}}); },
  _toggleDriver(id) { const all=Stores.entregadores.get(),driver=all.find(d=>d.id===id); if(driver)driver.ativo=!driver.ativo; Stores.entregadores.set(all); this._render(); },
  _remove(store,id) { if(!confirm('Excluir este cadastro?'))return; Stores[store].set(Stores[store].get().filter(item=>item.id!==id)); this._render(); },
  _saveLoyalty() { const percent=Number(document.getElementById('loyalty-percent').value),days=Number(document.getElementById('loyalty-days').value); if(!Number.isFinite(percent)||percent<0||percent>30||!Number.isInteger(days)||days<1)return UI.toast('Revise os valores.','warning'); Stores.fidelidade.set({ativo:document.getElementById('loyalty-active').checked,percentualCashback:percent,validadeDias:days}); UI.toast('Regra de fidelidade salva.'); this._render(); },
};
