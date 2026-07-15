/* ============================================================
   Distrito OS — EstoqueService
   Camada de serviço para operações de estoque.

   HOJE:   lê/escreve diretamente nos Stores (localStorage).
   FUTURO: cada método vira uma chamada à API REST:
             POST /api/estoque/reservar
             POST /api/estoque/baixar
             POST /api/estoque/estornar
           Sem alterar quem chama EstoqueService.
   ============================================================ */

const EstoqueService = {

  /* ── Verificação ───────────────────────────────────────────── */

  /**
   * Verifica se há ingredientes suficientes para os itens do pedido.
   * Usa as Fichas Técnicas da Sprint v0.2.
   * Retorna { disponivel: bool, erros: [...] }
   */
  verificarDisponibilidade(itensPedido) {
    if (typeof Stores === 'undefined' || typeof convertUnits === 'undefined') {
      return { disponivel: true, erros: [] };
    }

    const ingredientes = Stores.ingredientes.get();
    const fichas       = Stores.fichas.get();
    const erros        = [];

    for (const item of itensPedido) {
      const ficha = fichas.find(f => f.produtoId === item.produtoId);
      if (!ficha) continue;

      for (const fi of ficha.itens) {
        const ing = ingredientes.find(i => i.id === fi.ingredienteId);
        if (!ing) continue;

        const necessario = fi.quantidade * item.qty;
        const fator      = convertUnits(fi.unidade, ing.unidade);
        const necessarioNaUnidade = fator !== null ? necessario * fator : necessario;

        if (ing.estoqueAtual < necessarioNaUnidade) {
          erros.push({
            ingrediente: ing.nome,
            necessario:  necessarioNaUnidade,
            disponivel:  ing.estoqueAtual,
            unidade:     ing.unidade,
          });
        }
      }
    }

    return { disponivel: erros.length === 0, erros };
  },

  /* ── Reserva (soft — não debita ainda) ────────────────────── */

  /**
   * Marca a intenção de uso do estoque.
   * Em MVP: apenas log + evento.
   * FUTURO: campo `reservado` em cada ingrediente; verificar antes de vender.
   */
  reservarEstoque(pedidoId, itensPedido) {
    Logger.log('estoque.reservar', { pedidoId, qtdItens: itensPedido.length });
    EventBus.emit(EVENTS.ESTOQUE_RESERVADO, { pedidoId, itens: itensPedido });
    return { ok: true };
  },

  /* ── Baixa efetiva (após produção / entrega) ───────────────── */

  /**
   * Debita ingredientes conforme as Fichas Técnicas.
   * Chamado quando o pedido muda para "Entregue".
   */
  baixarEstoque(pedidoId, itensPedido) {
    if (!itensPedido || !itensPedido.length) {
      EventBus.emit(EVENTS.ESTOQUE_BAIXADO, { pedidoId });
      return { ok: true };
    }

    if (typeof Stores === 'undefined') return { ok: false, erro: 'Stores indisponível' };

    const ingredientes = Stores.ingredientes.get();
    const fichas       = Stores.fichas.get();
    const produtos     = Stores.produtos.get();

    for (const item of itensPedido) {
      const ficha = fichas.find(f => f.produtoId === item.produtoId);

      if (ficha) {
        for (const fi of ficha.itens) {
          const ing = ingredientes.find(i => i.id === fi.ingredienteId);
          if (!ing) continue;

          const necessario = fi.quantidade * item.qty;
          const fator      = convertUnits(fi.unidade, ing.unidade);
          const baixa      = fator !== null ? necessario * fator : necessario;

          ing.estoqueAtual = Math.max(0, ing.estoqueAtual - baixa);
        }
      } else {
        const produto = produtos.find(p => p.id === item.produtoId);
        if (produto && produto.estoqueAtual !== null && produto.estoqueAtual !== undefined) {
          produto.estoqueAtual = Math.max(0, produto.estoqueAtual - item.qty);
        }
      }
    }

    Stores.ingredientes.set(ingredientes);
    Stores.produtos.set(produtos);
    Logger.log('estoque.baixado', { pedidoId });
    EventBus.emit(EVENTS.ESTOQUE_BAIXADO, { pedidoId });
    return { ok: true };
  },

  /* ── Estorno (em cancelamento) ─────────────────────────────── */

  /**
   * Reverte reserva ou baixa.
   * Em MVP: apenas log + evento (reserva era soft).
   * FUTURO: estornar baixa efetiva se "Entregue" for revertido.
   */
  estornarEstoque(pedidoId, itensPedido) {
    if (!itensPedido || !itensPedido.length) {
      EventBus.emit(EVENTS.ESTOQUE_ESTORNADO, { pedidoId });
      return { ok: true };
    }

    if (typeof Stores === 'undefined') return { ok: false, erro: 'Stores indisponível' };

    const ingredientes = Stores.ingredientes.get();
    const fichas       = Stores.fichas.get();

    for (const item of itensPedido) {
      const ficha = fichas.find(f => f.produtoId === item.produtoId);
      if (!ficha) continue;

      for (const fi of ficha.itens) {
        const ing = ingredientes.find(i => i.id === fi.ingredienteId);
        if (!ing) continue;

        const necessario = fi.quantidade * item.qty;
        const fator      = convertUnits(fi.unidade, ing.unidade);
        const estorno    = fator !== null ? necessario * fator : necessario;

        ing.estoqueAtual += estorno;
      }
    }

    Stores.ingredientes.set(ingredientes);
    Logger.log('estoque.estornado', { pedidoId });
    EventBus.emit(EVENTS.ESTOQUE_ESTORNADO, { pedidoId, itens: itensPedido });
    return { ok: true };
  },
};
