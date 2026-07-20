/* ============================================================
   Petisbar Teodoro — Carrinho
   Estado em memória (não persiste entre reloads — intencional).
   Toda venda começa aqui antes de virar Pedido.

   FUTURO: persistir em sessionStorage para recuperar carrinho
           em caso de refresh acidental; sincronizar via WebSocket
           para múltiplos atendentes no mesmo pedido.
   ============================================================ */

const Carrinho = {
  _itens: [],
  _taxaEntrega: 0,
  _desconto: 0,

  /* ── Mutações ──────────────────────────────────────────────── */

  adicionar(produto, qty = 1) {
    if (!produto || !produto.id) return this;
    const existing = this._itens.find(i => i.produtoId === produto.id);
    if (existing) {
      existing.qty += qty;
      existing.subtotal = existing.qty * existing.precoUnitario;
    } else {
      this._itens.push({
        produtoId:     produto.id,
        nome:          produto.nome,
        qty,
        precoUnitario: produto.precoVenda,
        subtotal:      qty * produto.precoVenda,
      });
    }
    return this;
  },

  remover(produtoId) {
    this._itens = this._itens.filter(i => i.produtoId !== produtoId);
    return this;
  },

  atualizarQty(produtoId, qty) {
    const n = parseInt(qty, 10);
    if (isNaN(n) || n <= 0) return this.remover(produtoId);
    const item = this._itens.find(i => i.produtoId === produtoId);
    if (!item) return this;
    item.qty = n;
    item.subtotal = n * item.precoUnitario;
    return this;
  },

  setTaxaEntrega(v) { this._taxaEntrega = Math.max(0, parseFloat(v) || 0); return this; },
  setDesconto(v)    { this._desconto    = Math.max(0, parseFloat(v) || 0); return this; },

  limpar() {
    this._itens = [];
    this._taxaEntrega = 0;
    this._desconto    = 0;
    return this;
  },

  /* ── Leituras ──────────────────────────────────────────────── */

  getItens()      { return [...this._itens]; },
  getTaxa()       { return this._taxaEntrega; },
  getDesconto()   { return this._desconto; },
  isEmpty()       { return this._itens.length === 0; },
  count()         { return this._itens.reduce((s, i) => s + i.qty, 0); },

  calcSubtotal() {
    return this._itens.reduce((s, i) => s + i.subtotal, 0);
  },

  calcTotal() {
    return Math.max(0, this.calcSubtotal() + this._taxaEntrega - this._desconto);
  },

  /* Converte para o formato esperado pelo Pedido */
  toOrderData() {
    return {
      itens:       this.getItens(),
      subtotal:    this.calcSubtotal(),
      taxaEntrega: this._taxaEntrega,
      desconto:    this._desconto,
      total:       this.calcTotal(),
    };
  },
};
