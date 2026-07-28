/* Central de IA — análise local imediata e IA online via backend no VPS. */
const CentralIAModule = {
  online: false,
  snapshot: null,
  recommendations: [],

  async init() {
    this.snapshot = this.buildSnapshot();
    this.recommendations = this.buildRecommendations(this.snapshot);
    this.render();
    this.bind();
    await this.detectOnlineAI();
  },

  buildSnapshot() {
    const pedidos = Stores.pedidos.get();
    const ingredientes = Stores.ingredientes.get().filter(item => item.ativo);
    const produtos = Stores.produtos.get().filter(item => item.ativo);
    const fichas = Stores.fichas.get();
    const compras = Stores.compras.get();
    const state = Storage.getState();
    const month = Utils.currentMonth();
    const today = Utils.today();
    const finance = (state.finance || []).filter(item => (item.date || '').startsWith(month));
    const income = finance.filter(item => item.type === 'Entrada').reduce((sum, item) => sum + Number(item.value || 0), 0);
    const expense = finance.filter(item => item.type === 'Saída').reduce((sum, item) => sum + Math.abs(Number(item.value || 0)), 0);
    const criticalStock = ingredientes.map(item => {
      const current = Number(item.estoqueAtual || 0);
      const minimum = Number(item.estoqueMinimo || 0);
      const dailyUse = Number(item.consumoMedioDiario || 0);
      const leadDays = Number(item.prazoReposicaoDias || 0);
      const reorderPoint = Math.max(minimum, dailyUse * leadDays);
      const packageQuantity = Math.max(.001, Number(item.quantidadePacote || 1));
      const target = Math.max(reorderPoint + (dailyUse * 7), minimum);
      const purchaseQuantity = Math.max(0, Math.ceil(Math.max(0, target - current) / packageQuantity) * packageQuantity);
      const coverageDays = dailyUse > 0 ? current / dailyUse : null;
      return { ...item, current, dailyUse, leadDays, reorderPoint, purchaseQuantity, coverageDays };
    }).filter(item => item.current <= item.reorderPoint);

    return {
      today,
      month,
      ordersToday: pedidos.filter(order => (order.dataCriacao || '').startsWith(today)).length,
      pendingOrders: pedidos.filter(order => ['Novo', 'Aguardando Pagamento', 'Pago', 'Em Produção', 'Pronto'].includes(order.status)).length,
      pendingPurchases: compras.filter(purchase => !['Recebido', 'Cancelado'].includes(purchase.status)).length,
      criticalStock,
      productsWithoutSheet: produtos.filter(product => !fichas.some(sheet => sheet.produtoId === product.id)),
      provisionalCosts: produtos.filter(product => ['provisório', 'referência'].includes(product.precoStatus)),
      finance: { income, expense, result: income - expense },
      counts: { pedidos: pedidos.length, produtos: produtos.length, ingredientes: ingredientes.length, fichas: fichas.length },
    };
  },

  buildRecommendations(data) {
    const list = [];
    if (data.criticalStock.length) {
      const urgent = data.criticalStock
        .filter(item => item.coverageDays !== null && item.coverageDays <= item.leadDays)
        .sort((a, b) => (a.coverageDays ?? 999) - (b.coverageDays ?? 999));
      const examples = (urgent.length ? urgent : data.criticalStock).slice(0, 4).map(item => item.nome).join(', ');
      list.push({
        level: urgent.length ? 'critical' : 'warning',
        icon: '!',
        title: urgent.length ? 'Comprar antes de faltar' : 'Estoque no ponto de reposição',
        description: `${data.criticalStock.length} ingrediente(s) chegaram ao ponto de compra. Priorize ${examples}.`,
        evidence: urgent.length ? `${urgent.length} item(ns) podem acabar dentro do prazo de reposição` : 'Cálculo: estoque mínimo, consumo diário e prazo do fornecedor',
      });
    }
    if (data.pendingOrders) {
      list.push({
        level: 'warning', icon: '↗', title: 'Acompanhar pedidos em andamento',
        description: `Há ${data.pendingOrders} pedido(s) aguardando conclusão. Confira pagamento, produção e entrega para evitar atrasos.`,
        evidence: 'Pedidos com status aberto no sistema',
      });
    }
    if (data.productsWithoutSheet.length) {
      list.push({
        level: 'warning', icon: 'ƒ', title: 'Completar fichas técnicas',
        description: `${data.productsWithoutSheet.length} produto(s) ativo(s) ainda não têm ficha completa. Sem ela, margem e baixa de estoque ficam imprecisas.`,
        evidence: data.productsWithoutSheet.slice(0, 4).map(item => item.nome).join(', '),
      });
    }
    if (data.provisionalCosts.length) {
      list.push({
        level: 'info', icon: '$', title: 'Confirmar custos provisórios',
        description: `${data.provisionalCosts.length} produto(s) usam custo provisório ou de referência. Atualize-os após as primeiras compras reais.`,
        evidence: 'Preços de referência não substituem notas de compra',
      });
    }
    if (data.finance.income === 0 && data.finance.expense === 0) {
      list.push({
        level: 'info', icon: '0', title: 'Operação ainda sem movimento financeiro',
        description: 'O mês está zerado. Depois da primeira compra e venda, a Central passará a comparar faturamento, despesas, CMV e margem.',
        evidence: 'Nenhuma entrada ou saída registrada neste mês',
      });
    } else if (data.finance.result < 0) {
      list.push({
        level: 'critical', icon: '↓', title: 'Resultado mensal negativo',
        description: `As saídas superam as entradas em ${Utils.currency(Math.abs(data.finance.result))}. Revise compras, desperdícios e margem dos itens vendidos.`,
        evidence: `Entradas ${Utils.currency(data.finance.income)} · saídas ${Utils.currency(data.finance.expense)}`,
      });
    }
    return list;
  },

  render() {
    document.getElementById('ai-priority-count').textContent = this.recommendations.filter(item => item.level !== 'info').length;
    document.getElementById('ai-stock-count').textContent = this.snapshot.criticalStock.length;
    document.getElementById('ai-order-count').textContent = this.snapshot.pendingOrders;
    document.getElementById('ai-month-result').textContent = Utils.currency(this.snapshot.finance.result);
    const target = document.getElementById('ai-recommendations');
    target.innerHTML = this.recommendations.length ? this.recommendations.map(item => `
      <article class="ai-recommendation ai-recommendation--${item.level}">
        <span class="ai-recommendation__icon" aria-hidden="true">${Utils.escapeHtml(item.icon)}</span>
        <div>
          <h3>${Utils.escapeHtml(item.title)}</h3>
          <p>${Utils.escapeHtml(item.description)}</p>
          <span class="ai-evidence">${Utils.escapeHtml(item.evidence)}</span>
        </div>
      </article>
    `).join('') : '<div class="ai-empty">Nenhuma prioridade crítica encontrada agora.</div>';
  },

  bind() {
    document.getElementById('ai-refresh').addEventListener('click', () => {
      this.snapshot = this.buildSnapshot();
      this.recommendations = this.buildRecommendations(this.snapshot);
      this.render();
      UI.toast('Análise atualizada com os dados mais recentes.', 'success');
    });
    document.getElementById('ai-suggestions').addEventListener('click', event => {
      const button = event.target.closest('[data-ai-question]');
      if (button) this.ask(button.dataset.aiQuestion);
    });
    document.getElementById('ai-question-form').addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('ai-question-input');
      const question = input.value.trim();
      if (!question) return;
      input.value = '';
      this.ask(question);
    });
  },

  async detectOnlineAI() {
    try {
      const response = await fetch('../api/v1/ai/status', { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const body = await response.json();
      this.online = Boolean(body.data?.enabled);
      if (this.online) {
        const mode = document.getElementById('ai-mode');
        mode.classList.add('ai-mode--online');
        mode.querySelector('strong').textContent = 'IA online';
        mode.querySelector('small').textContent = `Análises protegidas no servidor · ${body.data.model}`;
      }
    } catch (_) {
      this.online = false;
    }
  },

  addMessage(text, role) {
    const conversation = document.getElementById('ai-conversation');
    const message = document.createElement('div');
    message.className = `ai-message ai-message--${role}`;
    message.textContent = text;
    conversation.appendChild(message);
    conversation.scrollTop = conversation.scrollHeight;
    return message;
  },

  async ask(question) {
    this.addMessage(question, 'user');
    const loading = this.addMessage(this.online ? 'Analisando os dados do servidor…' : 'Analisando os dados disponíveis…', 'assistant');
    try {
      const answer = this.online ? await this.askOnline(question) : this.answerLocally(question);
      loading.textContent = answer;
    } catch (_) {
      this.online = false;
      loading.textContent = `${this.answerLocally(question)}\n\nA IA online não respondeu; usei o diagnóstico local.`;
    }
  },

  async askOnline(question) {
    const response = await fetch('../api/v1/ai/ask', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'ai_unavailable');
    return body.data.answer;
  },

  answerLocally(question) {
    const q = question.toLowerCase();
    const data = this.snapshot;
    if (/compr|repor|falta/.test(q)) {
      if (!data.criticalStock.length) return 'Nenhum ingrediente atingiu o ponto de compra neste momento.';
      const items = data.criticalStock.slice(0, 10).map(item => {
        const quantity = item.purchaseQuantity > 0 ? ` — sugestão: ${item.purchaseQuantity} ${item.unidade}` : '';
        return `• ${item.nome}: estoque ${item.current} ${item.unidade}${quantity}`;
      });
      return `Lista prioritária de compra:\n${items.join('\n')}\n\nConfira as embalagens e os preços antes de aprovar a compra.`;
    }
    if (/estoque|insumo|ingrediente/.test(q)) {
      return data.criticalStock.length
        ? `Há ${data.criticalStock.length} ingrediente(s) no ponto de reposição. Os primeiros são: ${data.criticalStock.slice(0, 6).map(item => item.nome).join(', ')}.`
        : 'O estoque não apresenta itens abaixo do ponto de reposição configurado.';
    }
    if (/finance|resultado|lucro|fatur|despesa|caixa/.test(q)) {
      return `Neste mês: entradas de ${Utils.currency(data.finance.income)}, saídas de ${Utils.currency(data.finance.expense)} e resultado de ${Utils.currency(data.finance.result)}.`;
    }
    if (/produto|ficha|preço|preco|margem|custo/.test(q)) {
      return `${data.productsWithoutSheet.length} produto(s) estão sem ficha técnica e ${data.provisionalCosts.length} usam custo provisório ou de referência. Comece pelas fichas e depois confirme os custos com as primeiras notas de compra.`;
    }
    if (/pedido|atras|produção|producao/.test(q)) {
      return `Há ${data.pendingOrders} pedido(s) em status aberto e ${data.ordersToday} criado(s) hoje. No modo local eu não envio mensagens nem mudo status automaticamente.`;
    }
    const first = this.recommendations[0];
    return first
      ? `Minha primeira recomendação é: ${first.title}. ${first.description}`
      : 'Não encontrei uma prioridade crítica. Você pode perguntar sobre compras, estoque, pedidos, produtos ou resultado financeiro.';
  },
};
