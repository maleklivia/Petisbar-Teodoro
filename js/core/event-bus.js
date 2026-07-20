/* ============================================================
   Petisbar Teodoro — EventBus
   Barramento de eventos central e desacoplado.

   HOJE:  síncrono, in-memory, single-tab.
   FUTURO: substituir emit() por WebSocket / Server-Sent Events
           sem alterar nenhum listener — a interface pública permanece.

   Padrão de uso:
     // Subscrever
     const unsub = EventBus.on(EVENTS.PEDIDO_CRIADO, ({ data }) => { ... });
     unsub(); // cancela a subscrição

     // Emitir
     EventBus.emit(EVENTS.PEDIDO_CRIADO, { pedido });

     // Wildcard (debug / logging)
     EventBus.on('*', ({ event, data }) => console.log(event, data));
   ============================================================ */

/* ── Catálogo de eventos ─────────────────────────────────────── */
const EVENTS = {
  // ── Pedidos ────────────────────────────────────────────────
  PEDIDO_CRIADO:          'pedido.criado',
  PEDIDO_ATUALIZADO:      'pedido.atualizado',
  PEDIDO_PAGO:            'pedido.pago',
  PEDIDO_EM_PRODUCAO:     'pedido.em_producao',
  PEDIDO_PRONTO:          'pedido.pronto',
  PEDIDO_SAIU_ENTREGA:    'pedido.saiu_entrega',
  PEDIDO_ENTREGUE:        'pedido.entregue',
  PEDIDO_CANCELADO:       'pedido.cancelado',

  // ── Produtos ───────────────────────────────────────────────
  PRODUTO_CRIADO:         'produto.criado',
  PRODUTO_ATUALIZADO:     'produto.atualizado',
  PRODUTO_DELETADO:       'produto.deletado',

  // ── Ingredientes ───────────────────────────────────────────
  INGREDIENTE_CRIADO:     'ingrediente.criado',
  INGREDIENTE_ATUALIZADO: 'ingrediente.atualizado',
  INGREDIENTE_DELETADO:   'ingrediente.deletado',

  // ── Clientes ───────────────────────────────────────────────
  CLIENTE_CRIADO:         'cliente.criado',
  CLIENTE_ATUALIZADO:     'cliente.atualizado',

  // ── Estoque ────────────────────────────────────────────────
  ESTOQUE_RESERVADO:      'estoque.reservado',
  ESTOQUE_BAIXADO:        'estoque.baixado',
  ESTOQUE_ESTORNADO:      'estoque.estornado',

  // ── Financeiro ─────────────────────────────────────────────
  VENDA_REGISTRADA:       'financeiro.venda_registrada',
  DESPESA_REGISTRADA:     'financeiro.despesa_registrada',
  PAGAMENTO_REGISTRADO:   'financeiro.pagamento_registrado',

  // ── Sistema ────────────────────────────────────────────────
  APP_INICIADO:           'app.iniciado',
  PAGINA_CARREGADA:       'app.pagina_carregada',
};

/* ── EventBus ────────────────────────────────────────────────── */
const EventBus = {
  _listeners: {},

  /* Subscrever a um evento. Retorna função de cancelamento. */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  },

  /* Cancelar subscrição. */
  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
  },

  /* Emitir evento. Chama Logger se disponível. */
  emit(event, data = {}) {
    const payload = { event, data, ts: new Date().toISOString() };

    // Loga automaticamente se Logger estiver carregado na página
    if (typeof Logger !== 'undefined') {
      Logger.log(event, data);
    }

    // Listeners específicos do evento
    (this._listeners[event] || []).forEach(cb => {
      try { cb(payload); } catch (err) {
        console.error(`[EventBus] Erro no handler de "${event}":`, err);
      }
    });

    // Listeners wildcard (para debug e logging centralizado)
    if (event !== '*') {
      (this._listeners['*'] || []).forEach(cb => {
        try { cb(payload); } catch (err) {
          console.error('[EventBus] Erro no handler wildcard:', err);
        }
      });
    }
  },

  /* Cancelar todas as subscrições — útil em teardown de módulos. */
  reset() {
    this._listeners = {};
  },
};
