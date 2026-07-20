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
  // Preencher quando o backend estiver disponível
  BASE_URL: null,

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

  async createSupplier(data) {
    const state = Storage.getState();
    const supplier = { id: Utils.uid(), ...data };
    state.fornecedores.push(supplier);
    Storage.setState(state);
    return supplier;
  },
};
