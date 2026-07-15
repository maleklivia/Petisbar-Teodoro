/* ============================================================
   Distrito OS — FinanceiroService
   Camada de serviço para registros financeiros.

   HOJE:   escreve diretamente no estado legado (Storage.getState().finance)
           para manter compatibilidade com os KPIs do Dashboard v0.1.
   FUTURO: cada método vira uma chamada à API REST:
             POST /api/financeiro/vendas
             POST /api/financeiro/despesas
             POST /api/financeiro/pagamentos
   ============================================================ */

const FinanceiroService = {

  /* ── Venda ─────────────────────────────────────────────────── */

  /**
   * Registra uma venda ao marcar pedido como Entregue.
   * Grava em finance[] para manter KPIs do Dashboard funcionando.
   */
  registrarVenda(pedido) {
    if (typeof Storage === 'undefined') return { ok: false, erro: 'Storage indisponível' };

    const state = Storage.getState();
    if (!Array.isArray(state.finance)) state.finance = [];

    state.finance.unshift({
      id:          Utils.uid(),
      date:        Utils.today(),
      description: `Pedido #${pedido.numeroPedido} · ${pedido.origem}`,
      category:    'Vendas',
      type:        'Entrada',
      value:       pedido.total,
    });

    /* Registra CMV como saída para manter o relatório preciso */
    if (typeof calcCustoProduto !== 'undefined') {
      const cmvTotal = (pedido.itens || []).reduce((sum, item) => {
        const custo = calcCustoProduto(item.produtoId);
        return custo !== null ? sum + custo * item.qty : sum;
      }, 0);

      if (cmvTotal > 0) {
        state.finance.unshift({
          id:          Utils.uid(),
          date:        Utils.today(),
          description: `CMV Pedido #${pedido.numeroPedido}`,
          category:    'CMV',
          type:        'Saída',
          value:       -Math.abs(cmvTotal),
        });
      }
    }

    Storage.setState(state);
    Logger.log('financeiro.venda_registrada', { pedidoId: pedido.id, valor: pedido.total });
    EventBus.emit(EVENTS.VENDA_REGISTRADA, { pedidoId: pedido.id, valor: pedido.total });
    return { ok: true };
  },

  /* ── Despesa ───────────────────────────────────────────────── */

  /**
   * Registra uma despesa operacional ou de fornecedor.
   * @param {{ descricao: string, categoria: string, valor: number, data: string }} opts
   */
  registrarDespesa({ descricao, categoria, valor, data } = {}) {
    if (typeof Storage === 'undefined') return { ok: false, erro: 'Storage indisponível' };
    if (!descricao || !valor) return { ok: false, erro: 'descricao e valor são obrigatórios' };

    const state = Storage.getState();
    if (!Array.isArray(state.finance)) state.finance = [];

    state.finance.unshift({
      id:          Utils.uid(),
      date:        data || Utils.today(),
      description: descricao,
      category:    categoria || 'Operacional',
      type:        'Saída',
      value:       -Math.abs(valor),
    });

    Storage.setState(state);
    Logger.log('financeiro.despesa_registrada', { descricao, valor });
    EventBus.emit(EVENTS.DESPESA_REGISTRADA, { descricao, valor });
    return { ok: true };
  },

  /* ── Pagamento ─────────────────────────────────────────────── */

  /**
   * Registra a forma de pagamento de um pedido.
   * MVP: apenas log + evento.
   * FUTURO: integrar PIX (Pagar.me), Mercado Pago, iFood Repasse.
   */
  registrarPagamento(pedidoId, valor, forma) {
    Logger.log('financeiro.pagamento_registrado', { pedidoId, valor, forma });
    EventBus.emit(EVENTS.PAGAMENTO_REGISTRADO, { pedidoId, valor, forma });
    return { ok: true };
  },
};
