// Uses the existing operational tables; local demo mode retains the original module.
if(API.isServerMode())Object.assign(OperacaoModule,{
  _data:null,_busy:false,
  async init(){
    this._canCash=API.hasPermission('finance.write');this._canManage=API.hasPermission('settings.manage');
    document.querySelectorAll('[data-operation-tab]').forEach(b=>b.onclick=()=>{this._tab=b.dataset.operationTab;document.querySelectorAll('[data-operation-tab]').forEach(x=>x.classList.toggle('active',x===b));this._render();});
    await this._load();
  },
  async _load(){
    try{this._data=(await API._request('/operations')).data;this._render();}
    catch{document.getElementById('operation-content').textContent='Não foi possível carregar a operação. Atualize a página para tentar novamente.';}
  },
  _field(name,label,type='text',value=''){return `<label class="form-group"><span class="form-label">${Utils.escapeHtml(label)}</span><input class="form-input" name="${name}" type="${type}" value="${Utils.escapeHtml(value)}" ${type==='number'?'min="0" step="0.01"':''} required></label>`;},
  _form(title,fields,path,method='POST',convert=x=>x){UI.openModal({title,body:`<form>${fields}</form>`,onConfirm:async data=>{
    try{await API._request(path,{method,body:JSON.stringify(convert(data))});UI.closeModal();await this._load();UI.toast('Salvo no servidor.');}
    catch(e){UI.toast(({cash_already_open:'Já existe um caixa aberto.',cash_closed:'Este caixa já foi fechado.',table_already_exists:'Essa mesa já está cadastrada.'})[e.code]||'Não foi possível salvar. Confira os dados.','danger');}
  }});},
  _render(){
    if(!this._data)return;
    const d=this._data,esc=Utils.escapeHtml,money=this._money;
    const current=d.cash.find(s=>!s.closed_at);
    document.getElementById('operation-summary').innerHTML=[['Caixa',current?'Aberto':'Fechado'],['Mesas ocupadas',d.tables.filter(t=>t.status==='ocupada').length],['Agendados',d.scheduled.filter(o=>!['Entregue','Concluído','Cancelado'].includes(o.status)).length],['Entregadores disponíveis',d.drivers.filter(t=>t.available).length]].map(([l,v])=>`<article class="operation-card"><span>${esc(l)}</span><strong>${esc(v)}</strong><small>dados do servidor</small></article>`).join('');
    let html='';
    if(this._tab==='caixa'){
      html=current?`<h3>Caixa aberto</h3><p>Fundo inicial: ${money(current.opening_amount)} · Saldo esperado em dinheiro: ${money(d.expected)}</p><p>Somente vendas concluídas em dinheiro compõem o numerário do caixa.</p>${this._canCash?'<button class="btn btn-secondary" data-op="cash-entry">Suprimento</button> <button class="btn btn-secondary" data-op="cash-exit">Sangria</button> <button class="btn btn-primary" data-op="cash-close">Fechar caixa</button>':''}`:`<h3>Caixa fechado</h3>${this._canCash?'<button class="btn btn-primary" data-op="cash-open">Abrir caixa</button>':'<p>Consulte um usuário com permissão financeira para abrir o caixa.</p>'}`;
      html+=`<h3 style="margin-top:24px">Histórico de caixa</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Abertura</th><th>Fechamento</th><th>Esperado</th><th>Contado</th><th>Diferença</th></tr></thead><tbody>${d.cash.map(s=>`<tr><td>${new Date(s.opened_at).toLocaleString('pt-BR')}</td><td>${s.closed_at?new Date(s.closed_at).toLocaleString('pt-BR'):'Aberto'}</td><td>${s.closed_at?money(s.expected_amount):'—'}</td><td>${s.closed_at?money(s.counted_amount):'—'}</td><td>${s.closed_at?money(Number(s.counted_amount)-Number(s.expected_amount)):'—'}</td></tr>`).join('')}</tbody></table></div>`;
    }else if(this._tab==='mesas'){
      html=`<h3>Mesas e comandas digitais</h3>${this._canManage?'<button class="btn btn-primary" data-op="table-add">+ Cadastrar mesa</button>':''}<div class="operation-grid">${d.tables.map(t=>`<article class="operation-item"><h3>Mesa ${esc(t.table_number)}</h3><p>${esc(t.status)}</p><a href="../cardapio.html?mesa=${encodeURIComponent(t.table_number)}" target="_blank" rel="noopener">Abrir cardápio da mesa</a><p><button class="btn btn-secondary" data-op="table-copy" data-id="${t.id}">Copiar link</button>${this._canManage?` <button class="btn btn-secondary" data-op="table-toggle" data-id="${t.id}">${t.status==='ocupada'?'Liberar':'Ocupar'}</button> <button class="btn btn-ghost" data-op="table-remove" data-id="${t.id}">Inativar</button>`:''}</p></article>`).join('')}</div><p>O link identifica a mesa no pedido. Você pode imprimir o QR Code pelo seu gerador de preferência.</p>`;
    }else if(this._tab==='agendados'){
      html=`<h3>Pedidos agendados</h3><a class="btn btn-primary" href="pedidos.html">Novo pedido</a><div class="table-wrap"><table class="data-table"><thead><tr><th>Horário</th><th>Pedido</th><th>Cliente</th><th>Status</th></tr></thead><tbody>${d.scheduled.map(o=>`<tr><td>${new Date(o.scheduled_for).toLocaleString('pt-BR')}</td><td>#${o.order_number}</td><td>${esc(o.client_name)}</td><td>${esc(o.status)}</td></tr>`).join('')}</tbody></table></div>`;
    }else if(this._tab==='entregadores'){
      html=`<h3>Entregadores</h3>${this._canManage?'<button class="btn btn-primary" data-op="driver-add">+ Entregador</button>':''}<div class="operation-grid">${d.drivers.map(t=>`<article class="operation-item"><h3>${esc(t.name)}</h3><p>${esc(t.phone)} · ${esc(t.vehicle)}</p><p>${t.available?'Disponível':'Indisponível'}</p>${this._canManage?`<button class="btn btn-secondary" data-op="driver-toggle" data-id="${t.id}">Alterar disponibilidade</button> <button class="btn btn-ghost" data-op="driver-remove" data-id="${t.id}">Inativar</button>`:''}</article>`).join('')}</div>`;
    }else{
      html=`<h3>Regra de fidelidade</h3><p>Regra armazenada no servidor. A concessão e o resgate de créditos ainda aguardam homologação; o programa permanece inativo.</p><form id="loyalty-rule">${this._field('percent','Percentual de cashback','number',d.loyalty.cashback_percent)}${this._field('days','Validade em dias','number',d.loyalty.expires_in_days)}${this._canManage?'<button type="submit" class="btn btn-primary">Salvar regra</button>':''}</form>`;
    }
    const content=document.getElementById('operation-content');content.innerHTML=html;
    content.onclick=e=>{const b=e.target.closest('[data-op]');if(b)this._action(b).catch(()=>UI.toast('Não foi possível concluir a ação.','danger'));};
    content.onsubmit=async e=>{e.preventDefault();if(e.target.id==='loyalty-rule'){const f=new FormData(e.target);try{await API._request('/operations/loyalty',{method:'PUT',body:JSON.stringify({active:false,percent:Number(f.get('percent')),days:Number(f.get('days'))})});UI.toast('Regra salva no servidor.');}catch{UI.toast('Não foi possível salvar a regra.','danger');}}};
  },
  async _action(b){
    if(this._busy)return;const a=b.dataset.op,d=this._data,s=d.cash.find(s=>!s.closed_at);
    if(a==='cash-open')return this._form('Abrir caixa',this._field('amount','Fundo inicial (R$)','number',0),'/operations/cash/open','POST',x=>({id:crypto.randomUUID(),amount:Number(x.amount)}));
    if(a==='cash-close')return this._form('Fechar caixa',this._field('amount','Valor contado em dinheiro (R$)','number',d.expected),`/operations/cash/${s.id}/close`,'POST',x=>({amount:Number(x.amount)}));
    if(a==='cash-entry'||a==='cash-exit')return this._form(a==='cash-entry'?'Suprimento':'Sangria',this._field('amount','Valor (R$)','number')+this._field('reason','Motivo'),`/operations/cash/${s.id}/movements`,'POST',x=>({...x,id:crypto.randomUUID(),type:a==='cash-entry'?'entrada':'saida',amount:Number(x.amount)}));
    if(a==='table-add')return this._form('Cadastrar mesa',this._field('number','Número ou nome da mesa'),'/operations/tables');
    if(a==='driver-add')return this._form('Novo entregador',this._field('name','Nome')+this._field('phone','Telefone')+this._field('vehicle','Veículo'),'/operations/drivers');
    if(a==='table-copy'){await navigator.clipboard.writeText(new URL(`../cardapio.html?mesa=${encodeURIComponent(d.tables.find(t=>t.id===b.dataset.id).table_number)}`,location.href).href);UI.toast('Link copiado.');return;}
    const resource=a.startsWith('table')?'tables':'drivers';const item=d[resource].find(x=>x.id===b.dataset.id);
    const payload=a==='table-toggle'?{status:item.status==='ocupada'?'livre':'ocupada'}:a==='table-remove'?{status:'inativa'}:a==='driver-toggle'?{available:!item.available}:{active:false};
    this._busy=true;b.disabled=true;try{await API._request(`/operations/${resource}/${item.id}`,{method:'PATCH',body:JSON.stringify(payload)});await this._load();}finally{this._busy=false;b.disabled=false;}
  },
});
