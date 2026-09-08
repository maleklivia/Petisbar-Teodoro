/* ============================================================
   Petisbar Teodoro — API Layer
   Interface unificada para todas as operações de dados.

   AGORA: proxy sobre localStorage via Storage.
   FUTURO: trocar os métodos abaixo por fetch() calls ao backend
           sem alterar nenhum outro arquivo.

   Padrão: todos os métodos retornam Promise para que a troca
           por fetch seja transparente ao código consumidor.
   ============================================================ */

const API = {
  BASE_URL: '/api/v1',
  currentUser: null,

  isServerMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('server') === '1') sessionStorage.removeItem('petisbar-local-mode');
    if (params.get('local') === '1') sessionStorage.setItem('petisbar-local-mode', '1');
    if (sessionStorage.getItem('petisbar-local-mode') === '1') return false;
    return !window.location.hostname.endsWith('github.io');
  },

  async _request(path, options = {}) {
    const { redirectOnUnauthorized = true, ...fetchOptions } = options;
    const response = await fetch(`${this.BASE_URL}${path}`, {
      credentials: 'include',
      ...fetchOptions,
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && redirectOnUnauthorized) {
      const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'dashboard.html');
      window.location.replace(`login.html?next=${next}`);
      throw new Error('authentication_required');
    }
    if (!response.ok) {
      const error = new Error(payload.error || `http_${response.status}`);
      error.code = payload.error;
      error.status = response.status;
      error.details = payload.details;
      throw error;
    }
    return payload;
  },

  async requireSession() {
    if (!this.isServerMode()) {
      this.currentUser = { name: 'Administrador local', role: 'local', permissions: ['*'] };
      return this.currentUser;
    }
    try {
      const payload = await this._request('/auth/me', { redirectOnUnauthorized: false });
      this.currentUser = payload.user;
      return this.currentUser;
    } catch (error) {
      if (error.status === 401) {
        const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'dashboard.html');
        window.location.replace(`login.html?next=${next}`);
        return null;
      }
      document.body.innerHTML = '<main class="login-shell"><section class="login-card"><h1>Servidor indisponível</h1><p>Não foi possível conectar ao ERP. Tente novamente em alguns instantes.</p><button class="btn btn-primary" data-reload>Tentar novamente</button></section></main>';
      document.querySelector('[data-reload]')?.addEventListener('click', () => window.location.reload());
      return null;
    }
  },

  async login(email, password) {
    return this._request('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }), redirectOnUnauthorized: false,
    });
  },

  async logout() {
    try { await this._request('/auth/logout', { method: 'POST' }); } finally {
      window.location.replace('login.html');
    }
  },

  bindSessionControls(user) {
    UI.setUserInfo(user?.name || 'Usuário', user?.role || '');
    const logoutButton = document.getElementById('logout-button');
    if (user?.role === 'local') {
      if (logoutButton) logoutButton.hidden = true;
    } else {
      logoutButton?.addEventListener('click', () => this.logout());
    }
  },

  hasPermission(code) {
    const permissions = this.currentUser?.permissions || [];
    return permissions.includes('*') || permissions.includes(code);
  },

  async getServerOrders(status = '') {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return (await this._request(`/orders${query}`)).data;
  },

  async createServerOrder(order) {
    return (await this._request('/orders', { method: 'POST', body: JSON.stringify(order) })).data;
  },

  async updateServerOrderStatus(id, status) {
    return (await this._request(`/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    })).data;
  },

  async getServerProducts() {
    return (await this._request('/products')).data.map(this._mapServerProduct);
  },

  async saveServerProduct(product) {
    return this._mapServerProduct((await this._request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    })).data);
  },

  async deactivateServerProduct(id) {
    return this._mapServerProduct((await this._request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' })).data);
  },

  async getServerIngredients() {
    return (await this._request('/ingredients')).data.map(this._mapServerIngredient);
  },

  async saveServerIngredient(ingredient) {
    return this._mapServerIngredient((await this._request('/ingredients', {
      method: 'POST',
      body: JSON.stringify(ingredient),
    })).data);
  },

  async deactivateServerIngredient(id) {
    return this._mapServerIngredient((await this._request(`/ingredients/${encodeURIComponent(id)}`, { method: 'DELETE' })).data);
  },

  async getServerTechnicalSheets() {
    return (await this._request('/technical-sheets')).data.map(this._mapServerTechnicalSheet);
  },

  async saveServerTechnicalSheet(sheet) {
    return this._mapServerTechnicalSheet((await this._request(`/technical-sheets/${encodeURIComponent(sheet.produtoId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: sheet.id,
        rendimento: sheet.rendimento || 1,
        itens: (sheet.itens || [])
          .filter(item => item.ingredienteId && Number(item.quantidade) > 0)
          .map(item => ({
            ingredienteId: item.ingredienteId,
            quantidade: Number(item.quantidade),
            unidade: item.unidade,
          })),
      }),
    })).data);
  },

  async getServerClients() {
    return (await this._request('/clients')).data;
  },

  async saveServerClient(client) {
    const path = client.id ? `/clients/${encodeURIComponent(client.id)}` : '/clients';
    return (await this._request(path, {
      method: client.id ? 'PUT' : 'POST',
      body: JSON.stringify(client),
    })).data;
  },

  async deactivateServerClient(id) {
    return (await this._request(`/clients/${encodeURIComponent(id)}`, { method: 'DELETE' })).data;
  },

  async getServerStockMovements() {
    return (await this._request('/stock/movements')).data.map(movement => ({
      ...movement,
      data: String(movement.data || '').slice(0, 10),
    }));
  },

  async createServerStockMovement(movement) {
    const saved = (await this._request('/stock/movements', {
      method: 'POST',
      body: JSON.stringify(movement),
    })).data;
    return { ...saved, data: String(saved.data || '').slice(0, 10) };
  },

  async getServerFinanceEntries() {
    return (await this._request('/finance/entries')).data.map(entry => ({
      ...entry,
      date: String(entry.date || '').slice(0, 10),
    }));
  },

  async createServerFinanceEntry(entry) {
    const saved = (await this._request('/finance/entries', {
      method: 'POST',
      body: JSON.stringify({
        ...entry,
        value: Math.abs(Number(entry.value || 0)),
      }),
    })).data;
    return { ...saved, date: String(saved.date || '').slice(0, 10) };
  },

  async deleteServerFinanceEntry(id) {
    await this._request(`/finance/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getServerSuppliers() {
    return (await this._request('/suppliers')).data;
  },

  async saveServerSupplier(supplier) {
    const path = supplier.id ? `/suppliers/${encodeURIComponent(supplier.id)}` : '/suppliers';
    return (await this._request(path, {
      method: supplier.id ? 'PUT' : 'POST',
      body: JSON.stringify(supplier),
    })).data;
  },

  async deactivateServerSupplier(id) {
    return (await this._request(`/suppliers/${encodeURIComponent(id)}`, { method: 'DELETE' })).data;
  },

  async getServerPurchases() {
    return (await this._request('/purchases')).data;
  },

  async createServerPurchase(purchase) {
    return (await this._request('/purchases', {
      method: 'POST',
      body: JSON.stringify(purchase),
    })).data;
  },

  async updateServerPurchaseStatus(id, status) {
    return (await this._request(`/purchases/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })).data;
  },

  async getServerReportsOverview() {
    return (await this._request('/reports/overview')).data;
  },

  _mapServerProduct(product) {
    return {
      id: product.id,
      sku: product.sku || '',
      codigo: product.sku || '',
      nome: product.name,
      categoria: product.category,
      descricao: product.description || '',
      precoVenda: Number(product.sale_price),
      precoIfood: product.ifood_price === null || product.ifood_price === undefined ? null : Number(product.ifood_price),
      ativoIfood: Boolean(product.ifood_active),
      custoCompra: product.purchase_cost === null || product.purchase_cost === undefined ? null : Number(product.purchase_cost),
      ativo: Boolean(product.active),
      tempoPreparo: Number(product.preparation_minutes || 0),
      estoqueAtual: product.current_stock === null || product.current_stock === undefined ? null : Number(product.current_stock),
      estoqueMinimo: product.minimum_stock === null || product.minimum_stock === undefined ? null : Number(product.minimum_stock),
      foto: product.photo_url || '',
      dataCadastro: product.created_at,
      dataAtualizacao: product.updated_at,
    };
  },

  _mapServerIngredient(ingredient) {
    return {
      id: ingredient.id,
      sku: ingredient.sku || '',
      nome: ingredient.name,
      categoria: ingredient.category,
      unidade: ingredient.unit,
      estoqueAtual: Number(ingredient.current_stock || 0),
      estoqueMinimo: Number(ingredient.minimum_stock || 0),
      consumoMedioDiario: Number(ingredient.average_daily_use || 0),
      prazoReposicaoDias: Number(ingredient.lead_time_days || 0),
      quantidadePacote: Number(ingredient.package_quantity || 1),
      custoUnitario: Number(ingredient.unit_cost || 0),
      fornecedor: ingredient.supplier_name || '',
      ativo: Boolean(ingredient.active),
      pontoPedido: Number(ingredient.reorder_point || 0),
      dataCadastro: ingredient.created_at,
      dataAtualizacao: ingredient.updated_at,
    };
  },

  _mapServerTechnicalSheet(sheet) {
    return {
      id: sheet.id,
      produtoId: sheet.productId,
      rendimento: Number(sheet.rendimento || 1),
      itens: (sheet.items || []).map(item => ({
        ingredienteId: item.ingredientId,
        quantidade: Number(item.quantity),
        unidade: item.unit,
      })),
      dataAtualizacao: sheet.updatedAt,
    };
  },

  /* ── Pedidos ─────────────────────────────────────────────────── */

  async getOrders() {
    return Storage.getState().orders;
  },

  async createOrder(data) {
    const state = Storage.getState();
    const order = {
      id:     Utils.nextOrderId(state.orders),
      date:   Utils.today(),
      status: 'Aguardando pagamento',
      ...data,
    };
    state.orders.unshift(order);

    // ERP: registra receita e CMV automaticamente
    state.finance.unshift({
      id:          Utils.uid(),
      date:        Utils.today(),
      description: `Pedido ${order.id} · ${order.product}`,
      category:    'Vendas',
      type:        'Entrada',
      value:       order.total,
    });

    const product = state.products.find(p => p.name === order.product);
    if (product) {
      product.sold = (product.sold || 0) + (order.qty || 1);
      const cmv = product.cost * (order.qty || 1);
      if (cmv > 0) {
        state.finance.unshift({
          id:          Utils.uid(),
          date:        Utils.today(),
          description: `CMV · ${product.name} (×${order.qty || 1})`,
          category:    'CMV',
          type:        'Saída',
          value:       -cmv,
        });
      }
    }

    Storage.setState(state);
    return order;
  },

  async updateOrderStatus(orderId, status) {
    const state = Storage.getState();
    const order = state.orders.find(o => o.id === orderId);
    if (order) { order.status = status; Storage.setState(state); }
    return order;
  },

  /* ── Produtos ────────────────────────────────────────────────── */

  async getProducts() {
    return Storage.getState().products;
  },

  async createProduct(data) {
    const state = Storage.getState();
    const product = { id: Utils.uid(), sold: 0, ...data };
    state.products.push(product);
    Storage.setState(state);
    return product;
  },

  /* ── Estoque ─────────────────────────────────────────────────── */

  async getStock() {
    return Storage.getState().stock;
  },

  async updateStock(id, quantity) {
    const state = Storage.getState();
    const item = state.stock.find(s => s.id === id);
    if (item) { item.quantity = quantity; Storage.setState(state); }
    return item;
  },

  /* ── Financeiro ──────────────────────────────────────────────── */

  async getTransactions() {
    return Storage.getState().finance;
  },

  async createTransaction(data) {
    const state = Storage.getState();
    const tx = { id: Utils.uid(), date: Utils.today(), ...data };
    state.finance.unshift(tx);
    Storage.setState(state);
    return tx;
  },

  /* ── Clientes ────────────────────────────────────────────────── */

  async getClients() {
    return Storage.getState().clients;
  },

  /* ── Fornecedores ────────────────────────────────────────────── */

  async getSuppliers() {
    return Storage.getState().fornecedores;
  },

  async getServerSettings() { return (await this._request('/settings')).data; },
  async saveServerSettings(settings) { return (await this._request('/settings', { method: 'PUT', body: settings })).data; },

  async createSupplier(data) {
    const state = Storage.getState();
    const supplier = { id: Utils.uid(), ...data };
    state.fornecedores.push(supplier);
    Storage.setState(state);
    return supplier;
  },
};
