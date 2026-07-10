/* ============================================================
   Distrito OS — ConfiguracoesModule
   Dados do restaurante, metas, horário e integrações.
   ============================================================ */

const ConfiguracoesModule = {
  _tab: 'restaurante',

  init() {
    this._render();
    this._bindEvents();
  },

  _render() {
    const el = document.getElementById('config-content');
    if (!el) return;
    const cfg = Stores.config.get();

    el.innerHTML = `
      <div class="module-tabs">
        <button class="tab-btn ${this._tab === 'restaurante' ? 'active' : ''}" data-cfg-tab="restaurante">Restaurante</button>
        <button class="tab-btn ${this._tab === 'metas' ? 'active' : ''}" data-cfg-tab="metas">Metas</button>
        <button class="tab-btn ${this._tab === 'horario' ? 'active' : ''}" data-cfg-tab="horario">Horário</button>
        <button class="tab-btn ${this._tab === 'integracoes' ? 'active' : ''}" data-cfg-tab="integracoes">Integrações</button>
        <button class="tab-btn ${this._tab === 'seguranca' ? 'active' : ''}" data-cfg-tab="seguranca">Segurança</button>
      </div>
      <div id="cfg-tab-body">
        ${this._renderTab(cfg)}
      </div>
    `;
  },

  _renderTab(cfg) {
    if (this._tab === 'metas')       return this._renderMetas(cfg);
    if (this._tab === 'horario')     return this._renderHorario(cfg);
    if (this._tab === 'integracoes') return this._renderIntegracoes(cfg);
    if (this._tab === 'seguranca')   return this._renderSeguranca();
    return this._renderRestaurante(cfg);
  },

  _renderRestaurante(cfg) {
    const r = cfg.restaurante || {};
    return `
      <div style="max-width:560px">
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-6)">
          <h3 style="font-family:var(--font-display);letter-spacing:.04em;margin-bottom:var(--sp-5)">Dados do Restaurante</h3>
          <div class="form-row">
            <div class="form-group" style="flex:2">
              <label class="form-label">Nome do Estabelecimento</label>
              <input type="text" class="form-input" id="cfg-nome" value="${Utils.escapeHtml(r.nome || '')}" placeholder="Distrito XVII">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">CNPJ</label>
              <input type="text" class="form-input" id="cfg-cnpj" value="${Utils.escapeHtml(r.cnpj || '')}" placeholder="00.000.000/0001-00">
            </div>
            <div class="form-group">
              <label class="form-label">Telefone</label>
              <input type="text" class="form-input" id="cfg-tel" value="${Utils.escapeHtml(r.telefone || '')}" placeholder="(11) 9 9999-0000">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input type="email" class="form-input" id="cfg-email" value="${Utils.escapeHtml(r.email || '')}" placeholder="contato@distrito17.com.br">
          </div>
          <div class="form-group">
            <label class="form-label">Endereço</label>
            <input type="text" class="form-input" id="cfg-end" value="${Utils.escapeHtml(r.endereco || '')}" placeholder="Rua, número, bairro">
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:2">
              <label class="form-label">Cidade</label>
              <input type="text" class="form-input" id="cfg-cidade" value="${Utils.escapeHtml(r.cidade || '')}" placeholder="São Paulo">
            </div>
            <div class="form-group">
              <label class="form-label">Estado</label>
              <input type="text" class="form-input" id="cfg-estado" value="${Utils.escapeHtml(r.estado || '')}" placeholder="SP" maxlength="2">
            </div>
            <div class="form-group">
              <label class="form-label">CEP</label>
              <input type="text" class="form-input" id="cfg-cep" value="${Utils.escapeHtml(r.cep || '')}" placeholder="00000-000">
            </div>
          </div>
          <div style="margin-top:var(--sp-4)">
            <button class="btn btn-primary" id="btn-salvar-restaurante">Salvar Alterações</button>
          </div>
        </div>
      </div>
    `;
  },

  _renderMetas(cfg) {
    const m = cfg.metas || {};
    const t = cfg.taxas || {};
    return `
      <div style="max-width:560px;display:flex;flex-direction:column;gap:var(--sp-4)">
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-6)">
          <h3 style="font-family:var(--font-display);letter-spacing:.04em;margin-bottom:var(--sp-5)">Metas Financeiras</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">CMV Meta (%)</label>
              <input type="number" class="form-input" id="cfg-cmv-meta" value="${m.cmvMeta || 35}" min="1" max="100">
              <small style="color:var(--text-muted);font-size:var(--text-xs)">Alerta quando CMV superar este valor</small>
            </div>
            <div class="form-group">
              <label class="form-label">Margem Meta (%)</label>
              <input type="number" class="form-input" id="cfg-margem-meta" value="${m.margemMeta || 60}" min="1" max="100">
            </div>
            <div class="form-group">
              <label class="form-label">Ticket Médio Meta (R$)</label>
              <input type="number" class="form-input" id="cfg-ticket-meta" value="${m.ticketMedioMeta || 60}" min="1">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dias para cliente inativo</label>
            <input type="number" class="form-input" id="cfg-inativos-dias" value="${m.clientesInativosDias || 30}" min="1" style="max-width:120px">
            <small style="color:var(--text-muted);font-size:var(--text-xs)">Usado em Marketing → Inativos</small>
          </div>
        </div>

        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-6)">
          <h3 style="font-family:var(--font-display);letter-spacing:.04em;margin-bottom:var(--sp-5)">Taxas</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Taxa de Entrega Padrão (R$)</label>
              <input type="number" class="form-input" id="cfg-taxa-entrega" value="${t.taxaEntregaPadrao || 5}" min="0" step="0.50">
            </div>
            <div class="form-group">
              <label class="form-label">Comissão iFood (%)</label>
              <input type="number" class="form-input" id="cfg-taxa-ifood" value="${t.taxaIfood || 15}" min="0" max="100">
            </div>
          </div>
        </div>

        <button class="btn btn-primary" id="btn-salvar-metas">Salvar Metas</button>
      </div>
    `;
  },

  _renderHorario(cfg) {
    const h   = cfg.horario || {};
    const dias = [
      { key: 'segunda', label: 'Segunda-feira' },
      { key: 'terca',   label: 'Terça-feira'   },
      { key: 'quarta',  label: 'Quarta-feira'   },
      { key: 'quinta',  label: 'Quinta-feira'   },
      { key: 'sexta',   label: 'Sexta-feira'    },
      { key: 'sabado',  label: 'Sábado'         },
      { key: 'domingo', label: 'Domingo'        },
    ];
    return `
      <div style="max-width:480px">
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-6)">
          <h3 style="font-family:var(--font-display);letter-spacing:.04em;margin-bottom:var(--sp-5)">Horário de Funcionamento</h3>
          ${dias.map(d => `
            <div style="display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-3)">
              <span style="width:130px;font-size:var(--text-sm);color:var(--text-secondary)">${d.label}</span>
              <input type="text" class="form-input" id="cfg-hr-${d.key}" value="${Utils.escapeHtml(h[d.key] || 'Fechado')}" placeholder="18:00 – 23:00 ou Fechado">
            </div>
          `).join('')}
          <button class="btn btn-primary" id="btn-salvar-horario" style="margin-top:var(--sp-2)">Salvar Horário</button>
        </div>
      </div>
    `;
  },

  _renderIntegracoes(cfg) {
    const int = cfg.integracoes || {};
    const integracoes = [
      { key: 'whatsapp',  icon: '💬', nome: 'WhatsApp Business API', desc: 'Receber pedidos e enviar atualizações automáticas via WhatsApp.', status: int.whatsapp },
      { key: 'pix',       icon: '💳', nome: 'PIX / Mercado Pago',    desc: 'Gerar cobranças PIX e confirmar pagamentos automaticamente.', status: int.pix },
      { key: 'impressora',icon: '🖨', nome: 'Impressora Térmica',    desc: 'Imprimir comandas na cozinha via PrinterService.', status: int.impressora },
      { key: 'ifood',     icon: '🛵', nome: 'iFood',                 desc: 'Receber pedidos do iFood diretamente no sistema.', status: int.ifood },
      { key: 'ocr',       icon: '🔍', nome: 'OCR / Leitura de NF-e', desc: 'Ler XML de NF-e e cupons fiscais automaticamente.', status: int.ocr },
    ];

    return `
      <div style="max-width:600px">
        <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-5)">
          Integrações futuras — a arquitetura está preparada. Ative quando disponível.
        </p>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
          ${integracoes.map(i => `
            <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-4) var(--sp-5);display:flex;align-items:center;gap:var(--sp-4)">
              <span style="font-size:28px">${i.icon}</span>
              <div style="flex:1">
                <div style="font-weight:700">${i.nome}</div>
                <div style="font-size:var(--text-sm);color:var(--text-muted)">${i.desc}</div>
              </div>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--text-sm);white-space:nowrap">
                <input type="checkbox" class="cfg-int-toggle" data-cfg-int="${i.key}" ${i.status ? 'checked' : ''}>
                ${i.status ? '<span style="color:var(--color-success);font-weight:600">Ativo</span>' : '<span style="color:var(--text-muted)">Inativo</span>'}
              </label>
            </div>
          `).join('')}
        </div>
        <p style="margin-top:var(--sp-5);font-size:var(--text-sm);color:var(--text-muted)">
          Para ativar uma integração, entre em contato com o suporte técnico ou configure via API.
        </p>
      </div>
    `;
  },

  _renderSeguranca() {
    return `
      <div style="max-width:400px">
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-6)">
          <h3 style="font-family:var(--font-display);letter-spacing:.04em;margin-bottom:var(--sp-5)">Alterar Senha</h3>
          <div class="form-group">
            <label class="form-label">Senha Atual</label>
            <input type="password" class="form-input" id="cfg-senha-atual" placeholder="••••••••">
          </div>
          <div class="form-group">
            <label class="form-label">Nova Senha</label>
            <input type="password" class="form-input" id="cfg-senha-nova" placeholder="••••••••" minlength="6">
          </div>
          <div class="form-group">
            <label class="form-label">Confirmar Nova Senha</label>
            <input type="password" class="form-input" id="cfg-senha-conf" placeholder="••••••••">
          </div>
          <button class="btn btn-primary" id="btn-salvar-senha">Alterar Senha</button>
        </div>

        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--sp-5);margin-top:var(--sp-4)">
          <h4 style="font-weight:700;margin-bottom:var(--sp-3)">Dados do Sistema</h4>
          <div style="font-size:var(--text-sm);color:var(--text-muted);display:flex;flex-direction:column;gap:6px">
            <div>Versão: <strong>v0.4.0</strong></div>
            <div>Armazenamento: <strong>localStorage</strong></div>
            <div>Usuário: <strong>admin</strong></div>
          </div>
          <button class="btn btn-ghost" id="btn-reset-dados" style="margin-top:var(--sp-4);color:var(--color-danger);font-size:var(--text-sm)">
            ⚠ Resetar todos os dados (seed)
          </button>
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const el = document.getElementById('config-content');
    if (!el) return;

    el.addEventListener('click', e => {
      const tab = e.target.closest('[data-cfg-tab]');
      if (tab) { this._tab = tab.dataset.cfgTab; this._render(); this._bindEvents(); return; }

      if (e.target.closest('#btn-salvar-restaurante')) { this._salvarRestaurante(); return; }
      if (e.target.closest('#btn-salvar-metas'))       { this._salvarMetas(); return; }
      if (e.target.closest('#btn-salvar-horario'))     { this._salvarHorario(); return; }
      if (e.target.closest('#btn-salvar-senha'))       { this._salvarSenha(); return; }
      if (e.target.closest('#btn-reset-dados')) {
        if (!confirm('ATENÇÃO: Todos os dados serão apagados e substituídos pelo seed inicial. Esta ação é irreversível. Confirmar?')) return;
        ['distrito-os-v5','distrito-produtos-v1','distrito-ingredientes-v1','distrito-fichas-v1','distrito-pedidos-v1','distrito-clientes-v1','distrito-fornecedores-v1','distrito-compras-v1','distrito-movimentacoes-v1','distrito-cupons-v1','distrito-documentos-v1','distrito-config-v1'].forEach(k => localStorage.removeItem(k));
        UI.toast('Dados resetados. Recarregando…', 'success');
        setTimeout(() => location.reload(), 1500);
        return;
      }
    });

    // Integrations toggles
    el.addEventListener('change', e => {
      const toggle = e.target.closest('.cfg-int-toggle');
      if (toggle) {
        const cfg = Stores.config.get();
        if (!cfg.integracoes) cfg.integracoes = {};
        cfg.integracoes[toggle.dataset.cfgInt] = e.target.checked;
        Stores.config.set(cfg);
        UI.toast(`Integração ${e.target.checked ? 'ativada' : 'desativada'}.`, 'success');
        this._render();
        this._bindEvents();
      }
    });
  },

  _salvarRestaurante() {
    const cfg = Stores.config.get();
    cfg.restaurante = {
      nome:     document.getElementById('cfg-nome')?.value?.trim()   || '',
      cnpj:     document.getElementById('cfg-cnpj')?.value?.trim()   || '',
      telefone: document.getElementById('cfg-tel')?.value?.trim()    || '',
      email:    document.getElementById('cfg-email')?.value?.trim()  || '',
      endereco: document.getElementById('cfg-end')?.value?.trim()    || '',
      cidade:   document.getElementById('cfg-cidade')?.value?.trim() || '',
      estado:   document.getElementById('cfg-estado')?.value?.trim() || '',
      cep:      document.getElementById('cfg-cep')?.value?.trim()    || '',
    };
    Stores.config.set(cfg);
    UI.toast('Dados do restaurante salvos.', 'success');
  },

  _salvarMetas() {
    const cfg = Stores.config.get();
    cfg.metas = {
      cmvMeta:              parseFloat(document.getElementById('cfg-cmv-meta')?.value || 35),
      margemMeta:           parseFloat(document.getElementById('cfg-margem-meta')?.value || 60),
      ticketMedioMeta:      parseFloat(document.getElementById('cfg-ticket-meta')?.value || 60),
      clientesInativosDias: parseInt(document.getElementById('cfg-inativos-dias')?.value || 30),
    };
    cfg.taxas = {
      taxaEntregaPadrao: parseFloat(document.getElementById('cfg-taxa-entrega')?.value || 5),
      taxaIfood:         parseFloat(document.getElementById('cfg-taxa-ifood')?.value || 15),
      comissaoEntregador: 0,
    };
    Stores.config.set(cfg);
    UI.toast('Metas e taxas salvas.', 'success');
  },

  _salvarHorario() {
    const cfg  = Stores.config.get();
    const dias = ['segunda','terca','quarta','quinta','sexta','sabado','domingo'];
    cfg.horario = {};
    for (const d of dias) {
      cfg.horario[d] = document.getElementById(`cfg-hr-${d}`)?.value?.trim() || 'Fechado';
    }
    Stores.config.set(cfg);
    UI.toast('Horário salvo.', 'success');
  },

  _salvarSenha() {
    const atual = document.getElementById('cfg-senha-atual')?.value;
    const nova  = document.getElementById('cfg-senha-nova')?.value;
    const conf  = document.getElementById('cfg-senha-conf')?.value;

    // Check current password against stored
    const cfg = Stores.config.get();
    const senhaAtual = cfg.seguranca?.senha || 'distrito17';
    if (atual !== senhaAtual) { UI.toast('Senha atual incorreta.', 'error'); return; }
    if (!nova || nova.length < 6) { UI.toast('Nova senha deve ter pelo menos 6 caracteres.', 'error'); return; }
    if (nova !== conf) { UI.toast('Confirmação de senha não confere.', 'error'); return; }

    if (!cfg.seguranca) cfg.seguranca = {};
    cfg.seguranca.senha = nova;
    Stores.config.set(cfg);
    UI.toast('Senha alterada com sucesso!', 'success');
    document.getElementById('cfg-senha-atual').value = '';
    document.getElementById('cfg-senha-nova').value  = '';
    document.getElementById('cfg-senha-conf').value  = '';
  },
};
