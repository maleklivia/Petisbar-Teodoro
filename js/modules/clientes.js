/* ============================================================
   Petisbar Teodoro — ClientesModule
   CRUD completo de clientes com gestão de endereços.
   ============================================================ */

const ClientesModule = {
  _search: '',

  init() {
    this._render();
    this._bindToolbar();
  },

  /* ── Dados ────────────────────────────────────────────────── */

  _clientes() { return Stores.clientes.get(); },

  _filtered() {
    const q = this._search.toLowerCase();
    if (!q) return this._clientes();
    return this._clientes().filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.telefone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  },

  /* ── Renderização ─────────────────────────────────────────── */

  _render() {
    const container = document.getElementById('clientes-table');
    if (!container) return;

    const clientes = this._filtered();

    if (!clientes.length) {
      container.innerHTML = '<div class="empty-state"><p>Nenhum cliente encontrado.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nome</th><th>Telefone</th><th>Email</th>
              <th>Endereços</th><th>Cadastro</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>${clientes.map(c => this._renderRow(c)).join('')}</tbody>
        </table>
      </div>`;

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => this._openForm(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => this._confirmDelete(btn.dataset.id));
    });
  },

  _renderRow(c) {
    const nEnd = c.enderecos?.length || 0;
    return `
      <tr>
        <td><strong>${Utils.escapeHtml(c.nome)}</strong>${c.observacoes ? `<br><small style="color:var(--color-text-muted)">${Utils.escapeHtml(c.observacoes)}</small>` : ''}</td>
        <td>${Utils.escapeHtml(c.telefone || '—')}</td>
        <td>${Utils.escapeHtml(c.email || '—')}</td>
        <td>${nEnd} endereço${nEnd !== 1 ? 's' : ''}</td>
        <td>${Utils.formatShortDate(c.dataCadastro)}</td>
        <td class="row-actions">
          <button class="btn-icon" data-action="edit"   data-id="${c.id}" title="Editar">✎</button>
          <button class="btn-icon btn-icon--danger" data-action="delete" data-id="${c.id}" title="Excluir">✕</button>
        </td>
      </tr>`;
  },

  /* ── Toolbar ──────────────────────────────────────────────── */

  _bindToolbar() {
    document.getElementById('btn-novo-cliente')
      ?.addEventListener('click', () => this._openForm());
    document.getElementById('cliente-search')
      ?.addEventListener('input', e => { this._search = e.target.value; this._render(); });
  },

  /* ── Formulário (Criar / Editar) ──────────────────────────── */

  _openForm(id = null) {
    const cliente = id ? this._clientes().find(c => c.id === id) : null;

    UI.openModal({
      title:        id ? 'Editar Cliente' : 'Novo Cliente',
      body:         this._buildForm(cliente),
      confirmLabel: id ? 'Salvar' : 'Cadastrar',
      onConfirm:    () => this._submitForm(id),
    });

    this._bindAddressEditor();
  },

  _buildForm(c) {
    const enderecos = c?.enderecos || [];
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input type="text" id="cli-nome" class="form-input" value="${Utils.escapeHtml(c?.nome || '')}" required autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input type="text" id="cli-telefone" class="form-input" value="${Utils.escapeHtml(c?.telefone || '')}" placeholder="(11) 99999-0000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="cli-email" class="form-input" value="${Utils.escapeHtml(c?.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">CPF</label>
          <input type="text" id="cli-cpf" class="form-input" value="${Utils.escapeHtml(c?.cpf || '')}" placeholder="000.000.000-00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Observações</label>
        <textarea id="cli-obs" class="form-input" rows="2">${Utils.escapeHtml(c?.observacoes || '')}</textarea>
      </div>
      <div class="form-section-title">Endereços</div>
      <div id="enderecos-list">
        ${enderecos.map((e, i) => this._buildAddressRow(e, i)).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-add-endereco" style="margin-top:6px">+ Adicionar endereço</button>`;
  },

  _buildAddressRow(e, i) {
    const v = f => `value="${Utils.escapeHtml(e[f] || '')}"`;
    return `
      <div class="endereco-row" data-idx="${i}">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Rua</label>
            <input type="text" class="form-input end-rua" ${v('rua')} placeholder="Nome da rua">
          </div>
          <div class="form-group" style="flex:0.7">
            <label class="form-label">Número</label>
            <input type="text" class="form-input end-numero" ${v('numero')}>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Bairro</label>
            <input type="text" class="form-input end-bairro" ${v('bairro')}>
          </div>
          <div class="form-group">
            <label class="form-label">Cidade</label>
            <input type="text" class="form-input end-cidade" ${v('cidade')}>
          </div>
          <div class="form-group" style="flex:0.5">
            <label class="form-label">UF</label>
            <input type="text" class="form-input end-estado" ${v('estado')} maxlength="2" placeholder="SP">
          </div>
          <div class="form-group" style="flex:0.9">
            <label class="form-label">CEP</label>
            <input type="text" class="form-input end-cep" ${v('cep')} placeholder="00000-000">
          </div>
        </div>
        <div class="form-row" style="align-items:flex-end">
          <div class="form-group" style="flex:2">
            <label class="form-label">Complemento</label>
            <input type="text" class="form-input end-complemento" ${v('complemento')} placeholder="Apto, bloco…">
          </div>
          <button type="button" class="btn-icon btn-icon--danger end-rm" style="margin-bottom:4px" title="Remover">✕</button>
        </div>
      </div>`;
  },

  _bindAddressEditor() {
    const list = () => document.getElementById('enderecos-list');

    const bindRemove = () => {
      document.querySelectorAll('.end-rm').forEach(btn => {
        btn.onclick = () => btn.closest('.endereco-row').remove();
      });
    };

    bindRemove();

    document.getElementById('btn-add-endereco')?.addEventListener('click', () => {
      const idx = list().querySelectorAll('.endereco-row').length;
      const blank = { rua:'', numero:'', bairro:'', cidade:'', estado:'SP', cep:'', complemento:'' };
      list().insertAdjacentHTML('beforeend', this._buildAddressRow(blank, idx));
      bindRemove();
    });
  },

  _collectEnderecos() {
    return Array.from(document.querySelectorAll('.endereco-row')).map(() => ({
      // id is set per-entry below
    })).map((_, i, all) => {
      const row = document.querySelectorAll('.endereco-row')[i];
      return {
        id:          `end-${Utils.uid()}`,
        rua:         row.querySelector('.end-rua')?.value?.trim()         || '',
        numero:      row.querySelector('.end-numero')?.value?.trim()      || '',
        bairro:      row.querySelector('.end-bairro')?.value?.trim()      || '',
        cidade:      row.querySelector('.end-cidade')?.value?.trim()      || '',
        estado:      row.querySelector('.end-estado')?.value?.trim()      || '',
        cep:         row.querySelector('.end-cep')?.value?.trim()         || '',
        complemento: row.querySelector('.end-complemento')?.value?.trim() || '',
      };
    }).filter(e => e.rua || e.cidade);
  },

  /* ── Submit ───────────────────────────────────────────────── */

  _submitForm(id) {
    const nome = document.getElementById('cli-nome')?.value?.trim();
    if (!nome) { UI.toast('Nome é obrigatório.', 'warning'); return; }

    const clientes  = this._clientes();
    const enderecos = this._collectEnderecos();
    const campos    = {
      nome,
      telefone:    document.getElementById('cli-telefone')?.value?.trim() || '',
      email:       document.getElementById('cli-email')?.value?.trim()    || '',
      cpf:         document.getElementById('cli-cpf')?.value?.trim()      || '',
      observacoes: document.getElementById('cli-obs')?.value?.trim()      || '',
      enderecos,
    };

    if (id) {
      const idx = clientes.findIndex(c => c.id === id);
      if (idx === -1) return;
      clientes[idx] = { ...clientes[idx], ...campos };
      Stores.clientes.set(clientes);
      EventBus.emit(EVENTS.CLIENTE_ATUALIZADO, { clienteId: id });
      UI.toast('Cliente atualizado.', 'success');
    } else {
      clientes.unshift({ id: `cli-${Utils.uid()}`, ...campos, dataCadastro: Utils.today() });
      Stores.clientes.set(clientes);
      EventBus.emit(EVENTS.CLIENTE_CRIADO, { clienteId: clientes[0].id });
      UI.toast('Cliente cadastrado.', 'success');
    }

    UI.closeModal();
    this._render();
  },

  /* ── Excluir ──────────────────────────────────────────────── */

  _confirmDelete(id) {
    const cliente = this._clientes().find(c => c.id === id);
    if (!cliente) return;
    if (!confirm(`Excluir cliente "${cliente.nome}"?\nSeus pedidos NÃO serão afetados.`)) return;
    Stores.clientes.set(this._clientes().filter(c => c.id !== id));
    UI.toast('Cliente excluído.', 'success');
    this._render();
  },
};
