const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const seedData = {
  settings: {
    businessName: "Distrito XVII",
    dailyGoal: 1500,
    cmvGoal: 32,
    stockAlerts: true
  },
  products: [
    { id: 1, name: "Batata XVII Cheddar & Bacon", price: 39.9, cost: 12.8, sold: 86, category: "Batatas" },
    { id: 2, name: "Frango Crocante", price: 44.9, cost: 15.2, sold: 63, category: "Proteínas" },
    { id: 3, name: "Caldo Verde", price: 21.9, cost: 6.1, sold: 52, category: "Caldos" },
    { id: 4, name: "Combo XVII", price: 69.9, cost: 22.6, sold: 48, category: "Combos" },
    { id: 5, name: "Molho Especial", price: 5.9, cost: 1.1, sold: 94, category: "Extras" }
  ],
  clients: [
    { name: "João Silva", phone: "(21) 98888-1122", orders: 18, average: 68, total: 1224, status: "VIP", last: "há 12 dias" },
    { name: "Ana Costa", phone: "(21) 97777-3344", orders: 6, average: 47, total: 282, status: "Frequente", last: "ontem" },
    { name: "Mariana Lopes", phone: "(21) 96666-2200", orders: 3, average: 41, total: 123, status: "Novo", last: "hoje" },
    { name: "Carlos Mendes", phone: "(21) 95555-8800", orders: 9, average: 58, total: 522, status: "Frequente", last: "há 4 dias" },
    { name: "Fernanda Reis", phone: "(21) 94444-7700", orders: 14, average: 72, total: 1008, status: "VIP", last: "há 2 dias" }
  ],
  stock: [
    { item: "Batata", unit: "kg", quantity: 15, min: 5, capacity: 25, cost: 7.8 },
    { item: "Bacon", unit: "kg", quantity: 3, min: 4, capacity: 10, cost: 34 },
    { item: "Cheddar", unit: "kg", quantity: 8, min: 3, capacity: 12, cost: 28 },
    { item: "Frango", unit: "kg", quantity: 11, min: 6, capacity: 18, cost: 17.5 },
    { item: "Embalagem", unit: "un", quantity: 86, min: 40, capacity: 150, cost: 1.1 },
    { item: "Caldo base", unit: "L", quantity: 9, min: 5, capacity: 20, cost: 5.2 }
  ],
  orders: [
    { id: "0018", client: "Mariana Lopes", product: "Batata XVII Cheddar & Bacon", status: "Em produção", total: 39.9, channel: "WhatsApp", time: "12:42" },
    { id: "0017", client: "Carlos Mendes", product: "Combo XVII", status: "Saiu para entrega", total: 69.9, channel: "iFood", time: "12:31" },
    { id: "0016", client: "Ana Costa", product: "Caldo Verde", status: "Pedido finalizado", total: 21.9, channel: "Instagram", time: "12:12" },
    { id: "0015", client: "João Silva", product: "Frango Crocante", status: "Pedido finalizado", total: 44.9, channel: "WhatsApp", time: "11:58" },
    { id: "0014", client: "Fernanda Reis", product: "Combo XVII", status: "Aguardando pagamento", total: 69.9, channel: "WhatsApp", time: "11:46" }
  ],
  finance: [
    { date: "26/06", description: "Pedidos WhatsApp", category: "Vendas", type: "Entrada", value: 842.4 },
    { date: "26/06", description: "Pedidos iFood", category: "Vendas", type: "Entrada", value: 443.0 },
    { date: "26/06", description: "Compra de bacon", category: "Insumos", type: "Saída", value: -238.0 },
    { date: "25/06", description: "Embalagens", category: "Operação", type: "Saída", value: -96.0 },
    { date: "25/06", description: "Pix clientes", category: "Vendas", type: "Entrada", value: 1010.8 }
  ],
  week: [
    { day: "Seg", revenue: 820, orders: 19 },
    { day: "Ter", revenue: 940, orders: 21 },
    { day: "Qua", revenue: 1120, orders: 25 },
    { day: "Qui", revenue: 1285, orders: 32 },
    { day: "Sex", revenue: 1540, orders: 36 },
    { day: "Sáb", revenue: 1880, orders: 42 },
    { day: "Dom", revenue: 1320, orders: 29 }
  ],
  campaigns: [
    { name: "Batata XVII — Lançamento", channel: "Instagram", status: "Ativo", reach: 4200, leads: 38, budget: 150 },
    { name: "Combo Fim de Semana", channel: "WhatsApp", status: "Encerrado", reach: 820, leads: 64, budget: 0 },
    { name: "Caldos de Inverno", channel: "Meta Ads", status: "Ativo", reach: 11500, leads: 92, budget: 300 },
    { name: "Cupom VIP", channel: "WhatsApp", status: "Pausado", reach: 180, leads: 27, budget: 0 },
    { name: "iFood — Destaque junho", channel: "iFood", status: "Ativo", reach: 6800, leads: 51, budget: 200 }
  ]
};

const storeKey = "distrito-os-v1";
let state = loadState();

const viewTitles = {
  dashboard: "Dashboard",
  pedidos: "Pedidos",
  clientes: "Clientes",
  produtos: "Produtos",
  estoque: "Estoque",
  financeiro: "Financeiro",
  relatorios: "Relatórios",
  marketing: "Marketing",
  ia: "IA operacional",
  config: "Configurações"
};

const statusClass = {
  "Aguardando pagamento": "muted",
  "Em produção": "",
  "Saiu para entrega": "blue",
  "Pedido finalizado": "green",
  VIP: "",
  Frequente: "green",
  Novo: "blue",
  Entrada: "green",
  Saída: "red"
};

const channelClass = {
  WhatsApp: "green",
  iFood: "red",
  "99Food": "blue",
  Instagram: "blue",
  Presencial: "muted"
};

function loadState() {
  const saved = localStorage.getItem(storeKey);
  if (!saved) return structuredClone(seedData);
  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(seedData);
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function currency(value) {
  return BRL.format(value);
}

function todayRevenue() {
  return state.finance
    .filter((item) => item.type === "Entrada" && item.date === "26/06")
    .reduce((sum, item) => sum + item.value, 0);
}

function monthRevenue() {
  return state.finance
    .filter((item) => item.type === "Entrada")
    .reduce((sum, item) => sum + item.value, 0);
}

function monthlyCosts() {
  return Math.abs(state.finance
    .filter((item) => item.type === "Saída")
    .reduce((sum, item) => sum + item.value, 0));
}

function cmvAverage() {
  const totalSales = state.products.reduce((sum, item) => sum + item.price * item.sold, 0);
  const totalCosts = state.products.reduce((sum, item) => sum + item.cost * item.sold, 0);
  return Math.round((totalCosts / totalSales) * 100);
}

function render() {
  renderMetrics();
  renderChart();
  renderProducts();
  renderStock();
  renderOrders();
  renderClients();
  renderFinance();
  renderReports();
  renderMarketing();
}

function renderMetrics() {
  const revenue = todayRevenue();
  document.getElementById("heroRevenue").textContent = currency(revenue);
  document.getElementById("heroDelta").textContent = `${Math.round((revenue / state.settings.dailyGoal) * 100)}% da meta diária`;

  const metrics = [
    { label: "Faturamento hoje", value: currency(revenue), delta: "+12% vs. ontem", trend: "up" },
    { label: "Pedidos hoje", value: state.orders.length, delta: "18 min tempo médio", trend: "up" },
    { label: "Lucro estimado", value: currency(revenue - revenue * (cmvAverage() / 100)), delta: `${cmvAverage()}% CMV`, trend: "up" },
    { label: "Ticket médio", value: currency(revenue / Math.max(state.orders.length, 1)), delta: "+R$ 4,20 na semana", trend: "up" },
    { label: "Nota operacional", value: "4,9", delta: "zero cancelamentos", trend: "up" }
  ];

  document.getElementById("metricGrid").innerHTML = metrics.map((item) => `
    <article class="metric-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small class="${item.trend}">${item.delta}</small>
    </article>
  `).join("");

  const financeMetrics = [
    { label: "Entradas do mês", value: currency(monthRevenue()), delta: "inclui WhatsApp e iFood" },
    { label: "Saídas do mês", value: currency(monthlyCosts()), delta: "insumos e operação" },
    { label: "Lucro parcial", value: currency(monthRevenue() - monthlyCosts()), delta: "antes de impostos" },
    { label: "CMV médio", value: `${cmvAverage()}%`, delta: `meta: ${state.settings.cmvGoal}%` }
  ];

  document.getElementById("financeMetrics").innerHTML = financeMetrics.map((item) => `
    <article class="metric-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.delta}</small>
    </article>
  `).join("");
}

function renderChart() {
  const mode = document.getElementById("chartMode").value;
  const max = Math.max(...state.week.map((item) => item[mode]));

  document.getElementById("salesChart").innerHTML = state.week.map((item) => {
    const value = item[mode];
    const height = Math.max(18, Math.round((value / max) * 220));
    const label = mode === "revenue" ? currency(value).replace(",00", "") : value;
    return `<div class="bar" style="height:${height}px"><strong>${label}</strong><span>${item.day}</span></div>`;
  }).join("");
}

function renderProducts() {
  const sorted = [...state.products].sort((a, b) => b.sold - a.sold);
  document.getElementById("topProducts").innerHTML = sorted.slice(0, 5).map((item, index) => `
    <div class="rank-item">
      <span>${index + 1}. ${item.name}</span>
      <strong>${item.sold}</strong>
    </div>
  `).join("");

  document.getElementById("productGrid").innerHTML = state.products.map((item) => {
    const margin = Math.round(((item.price - item.cost) / item.price) * 100);
    return `
      <article class="product-card">
        <span>${item.category}</span>
        <strong>${item.name}</strong>
        <div>Preço: ${currency(item.price)}</div>
        <div>Custo: ${currency(item.cost)}</div>
        <span class="pill ${margin < 55 ? "red" : "green"}">Margem ${margin}%</span>
      </article>
    `;
  }).join("");
}

function renderStock() {
  const alerts = state.stock.filter((item) => item.quantity <= item.min);
  const alertsEl = document.getElementById("stockAlerts");
  alertsEl.innerHTML = alerts.length
    ? alerts.map((item) => `
      <div class="alert-item">
        <span>${item.item}</span>
        <strong class="pill red">${item.quantity} ${item.unit}</strong>
      </div>
    `).join("")
    : `<div class="alert-item"><span>Nenhum item crítico</span><strong class="pill green">OK</strong></div>`;

  document.getElementById("stockGrid").innerHTML = state.stock.map((item) => {
    const percent = Math.min(100, Math.round((item.quantity / item.capacity) * 100));
    const risk = item.quantity <= item.min ? "danger" : percent < 45 ? "warning" : "";
    return `
      <article class="stock-card">
        <span>${item.unit} em estoque</span>
        <strong>${item.item}</strong>
        <div>${item.quantity} ${item.unit} disponíveis</div>
        <div class="progress ${risk}" style="--value:${percent}%"><i></i></div>
        <small>Mínimo recomendado: ${item.min} ${item.unit}</small>
      </article>
    `;
  }).join("");
}

function renderOrders() {
  document.getElementById("recentOrders").innerHTML = state.orders.slice(0, 5).map((item) => `
    <tr>
      <td>#${item.id}</td>
      <td>${item.client}</td>
      <td>${item.product}</td>
      <td><span class="pill ${channelClass[item.channel] || ""}">${item.channel}</span></td>
      <td><span class="pill ${statusClass[item.status] || ""}">${item.status}</span></td>
      <td>${currency(item.total)}</td>
    </tr>
  `).join("");

  const columns = ["Aguardando pagamento", "Em produção", "Saiu para entrega", "Pedido finalizado"];
  document.getElementById("orderBoard").innerHTML = columns.map((status) => {
    const orders = state.orders.filter((item) => item.status === status);
    return `
      <section class="kanban-column">
        <h4>${status}</h4>
        ${orders.map((item) => `
          <article class="order-card">
            <strong>#${item.id} - ${item.client}</strong>
            <span>${item.product}</span>
            <footer><span>${item.channel}</span><span>${currency(item.total)}</span></footer>
          </article>
        `).join("") || `<small>Sem pedidos nesta etapa</small>`}
      </section>
    `;
  }).join("");
}

function renderClients(filter = "all") {
  const clients = filter === "all" ? state.clients : state.clients.filter((item) => item.status === filter);
  document.getElementById("clientsTable").innerHTML = clients.map((item) => `
    <tr>
      <td>${item.name}<br><small>${item.last}</small></td>
      <td>${item.phone}</td>
      <td>${item.orders}</td>
      <td>${currency(item.average)}</td>
      <td>${currency(item.total)}</td>
      <td><span class="pill ${statusClass[item.status] || ""}">${item.status}</span></td>
    </tr>
  `).join("");
}

function renderFinance() {
  document.getElementById("financeTable").innerHTML = state.finance.map((item) => `
    <tr>
      <td>${item.date}</td>
      <td>${item.description}</td>
      <td>${item.category}</td>
      <td><span class="pill ${statusClass[item.type]}">${item.type}</span></td>
      <td>${currency(item.value)}</td>
    </tr>
  `).join("");

  const revenue = monthRevenue();
  const costs = monthlyCosts();
  const dre = [
    ["Receita bruta", revenue],
    ["Custos e despesas", -costs],
    ["Resultado parcial", revenue - costs],
    ["Margem líquida", `${Math.round(((revenue - costs) / revenue) * 100)}%`]
  ];
  document.getElementById("dreList").innerHTML = dre.map(([label, value]) => `
    <div class="dre-item">
      <span>${label}</span>
      <strong>${typeof value === "number" ? currency(value) : value}</strong>
    </div>
  `).join("");
}

function renderReports() {
  const topClient = [...state.clients].sort((a, b) => b.total - a.total)[0];
  const topProduct = [...state.products].sort((a, b) => b.sold - a.sold)[0];
  const lowStock = state.stock.filter((item) => item.quantity <= item.min).length;
  const reports = [
    { title: "Melhor cliente", value: topClient.name, detail: `${currency(topClient.total)} acumulados` },
    { title: "Produto líder", value: topProduct.name, detail: `${topProduct.sold} vendas no período` },
    { title: "Estoque crítico", value: `${lowStock} item(ns)`, detail: "priorizar próxima compra" },
    { title: "Melhor dia", value: "Sábado", detail: "pico de faturamento semanal" },
    { title: "Canal principal", value: "WhatsApp", detail: "maior margem por pedido" },
    { title: "Próxima ação", value: "Campanha VIP", detail: "cupom para clientes frequentes" }
  ];

  document.getElementById("reportsGrid").innerHTML = reports.map((item) => `
    <article class="report-card">
      <span>${item.title}</span>
      <strong>${item.value}</strong>
      <small>${item.detail}</small>
    </article>
  `).join("");
}

function renderMarketing() {
  const campaigns = state.campaigns || [];
  const totalReach = campaigns.reduce((sum, c) => sum + c.reach, 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);
  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const conversion = totalReach > 0 ? ((totalLeads / totalReach) * 100).toFixed(1) : "0.0";

  const metrics = [
    { label: "Alcance total", value: totalReach.toLocaleString("pt-BR"), delta: "todas as campanhas" },
    { label: "Leads gerados", value: totalLeads, delta: "contatos qualificados" },
    { label: "Taxa de conversão", value: `${conversion}%`, delta: "leads / alcance" },
    { label: "Investimento", value: currency(totalBudget), delta: "campanhas pagas" }
  ];

  document.getElementById("marketingMetrics").innerHTML = metrics.map((item) => `
    <article class="metric-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.delta}</small>
    </article>
  `).join("");

  const campaignStatusClass = { Ativo: "green", Encerrado: "muted", Pausado: "" };

  document.getElementById("campaignsTable").innerHTML = campaigns.map((item) => {
    const conv = item.reach > 0 ? ((item.leads / item.reach) * 100).toFixed(1) : "0.0";
    return `
      <tr>
        <td>${item.name}</td>
        <td>${item.channel}</td>
        <td><span class="pill ${campaignStatusClass[item.status] || ""}">${item.status}</span></td>
        <td>${item.reach.toLocaleString("pt-BR")}</td>
        <td>${item.leads}</td>
        <td>${conv}%</td>
        <td>${item.budget > 0 ? currency(item.budget) : "—"}</td>
      </tr>
    `;
  }).join("");

  const channelMap = {};
  campaigns.forEach((c) => {
    if (!channelMap[c.channel]) channelMap[c.channel] = { leads: 0, reach: 0 };
    channelMap[c.channel].leads += c.leads;
    channelMap[c.channel].reach += c.reach;
  });
  const channels = Object.entries(channelMap).sort((a, b) => b[1].leads - a[1].leads);

  document.getElementById("channelRank").innerHTML = channels.map(([channel, data]) => `
    <div class="rank-item">
      <span>${channel}</span>
      <strong>${data.leads} leads</strong>
    </div>
  `).join("");
}

function askAssistant(prompt) {
  const question = prompt.toLowerCase();
  let answer = "Ainda estou na versão demonstrativa. Posso responder sobre vendas, estoque, clientes VIP e produtos mais vendidos.";

  if (question.includes("vendi") || question.includes("fatur")) {
    answer = `Hoje o faturamento registrado é ${currency(todayRevenue())}, com ${state.orders.length} pedidos no painel.`;
  } else if (question.includes("bacon")) {
    const bacon = state.stock.find((item) => item.item.toLowerCase() === "bacon");
    answer = `Você tem ${bacon.quantity} ${bacon.unit} de bacon. O mínimo configurado é ${bacon.min} ${bacon.unit}.`;
  } else if (question.includes("vip") || question.includes("cliente")) {
    const client = [...state.clients].sort((a, b) => b.total - a.total)[0];
    answer = `${client.name} é o cliente de maior valor, com ${client.orders} pedidos e ${currency(client.total)} gastos.`;
  } else if (question.includes("produto") || question.includes("vende")) {
    const product = [...state.products].sort((a, b) => b.sold - a.sold)[0];
    answer = `${product.name} lidera o período, com ${product.sold} vendas.`;
  } else if (question.includes("lucro")) {
    answer = `O lucro parcial estimado é ${currency(monthRevenue() - monthlyCosts())}, antes de impostos e taxas adicionais.`;
  }

  addMessage(prompt, "user");
  addMessage(answer, "assistant");
}

function addMessage(text, who) {
  const log = document.getElementById("assistantLog");
  const message = document.createElement("div");
  message.className = `message ${who === "user" ? "user" : ""}`;
  message.textContent = text;
  log.appendChild(message);
  log.scrollTop = log.scrollHeight;
}

function openModal(type) {
  const backdrop = document.getElementById("modalBackdrop");
  const form = document.getElementById("modalForm");
  const title = document.getElementById("modalTitle");

  const templates = {
    "new-order": {
      title: "Novo pedido",
      fields: [
        ["client", "Cliente", "text"],
        ["product", "Produto", "text"],
        ["total", "Total", "number"],
        ["channel", "Canal", "select", ["WhatsApp", "iFood", "99Food", "Instagram", "Presencial"]]
      ],
      submit: "Adicionar pedido"
    },
    "new-product": {
      title: "Novo produto",
      fields: [
        ["name", "Nome", "text"],
        ["price", "Preço", "number"],
        ["cost", "Custo", "number"],
        ["category", "Categoria", "text"]
      ],
      submit: "Adicionar produto"
    },
    "new-stock": {
      title: "Registrar compra",
      fields: [
        ["item", "Item", "text"],
        ["quantity", "Quantidade", "number"],
        ["unit", "Unidade", "text"],
        ["cost", "Custo unitário", "number"]
      ],
      submit: "Registrar"
    },
    "new-campaign": {
      title: "Nova campanha",
      fields: [
        ["name", "Nome da campanha", "text"],
        ["channel", "Canal", "select", ["Instagram", "WhatsApp", "Meta Ads", "iFood", "99Food", "TikTok"]],
        ["reach", "Alcance estimado", "number"],
        ["budget", "Investimento (R$)", "number"]
      ],
      submit: "Criar campanha"
    }
  };

  const config = templates[type];
  title.textContent = config.title;
  form.dataset.type = type;
  form.innerHTML = config.fields.map(([id, label, inputType, options]) => {
    if (inputType === "select") {
      return `<label>${label}<select name="${id}" required>${options.map((o) => `<option value="${o}">${o}</option>`).join("")}</select></label>`;
    }
    return `<label>${label}<input name="${id}" type="${inputType}" step="0.01" required></label>`;
  }).join("") + `<button class="primary-button" type="submit">${config.submit}</button>`;

  backdrop.hidden = false;
  (form.querySelector("input") || form.querySelector("select")).focus();
}

function closeModal() {
  document.getElementById("modalBackdrop").hidden = true;
}

function handleModalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const type = form.dataset.type;

  if (type === "new-order") {
    const nextId = String(Number(state.orders[0]?.id || "0") + 1).padStart(4, "0");
    state.orders.unshift({
      id: nextId,
      client: data.client,
      product: data.product,
      status: "Aguardando pagamento",
      total: Number(data.total),
      channel: data.channel,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    });
    state.finance.unshift({ date: "26/06", description: `Pedido #${nextId}`, category: "Vendas", type: "Entrada", value: Number(data.total) });
  }

  if (type === "new-product") {
    state.products.push({
      id: Date.now(),
      name: data.name,
      price: Number(data.price),
      cost: Number(data.cost),
      sold: 0,
      category: data.category
    });
  }

  if (type === "new-campaign") {
    if (!state.campaigns) state.campaigns = [];
    state.campaigns.unshift({
      name: data.name,
      channel: data.channel,
      status: "Ativo",
      reach: Number(data.reach),
      leads: 0,
      budget: Number(data.budget)
    });
  }

  if (type === "new-stock") {
    const existing = state.stock.find((item) => item.item.toLowerCase() === data.item.toLowerCase());
    if (existing) {
      existing.quantity += Number(data.quantity);
      existing.cost = Number(data.cost);
    } else {
      state.stock.push({ item: data.item, unit: data.unit, quantity: Number(data.quantity), min: 1, capacity: Number(data.quantity) * 2, cost: Number(data.cost) });
    }
    state.finance.unshift({ date: "26/06", description: `Compra de ${data.item}`, category: "Insumos", type: "Saída", value: -(Number(data.quantity) * Number(data.cost)) });
  }

  saveState();
  render();
  closeModal();
}

function wireEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".view").forEach((item) => item.classList.toggle("active", item.id === view));
      document.getElementById("viewTitle").textContent = viewTitles[view];
      document.querySelector(".sidebar").classList.remove("open");
    });
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
  });

  document.getElementById("chartMode").addEventListener("change", renderChart);

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.action));
  });

  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
  document.getElementById("modalForm").addEventListener("submit", handleModalSubmit);

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("active", item === button));
      renderClients(button.dataset.filter);
    });
  });

  document.getElementById("assistantForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("assistantInput");
    if (!input.value.trim()) return;
    askAssistant(input.value.trim());
    input.value = "";
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => askAssistant(button.dataset.prompt));
  });

  document.getElementById("seedButton").addEventListener("click", () => {
    state = structuredClone(seedData);
    saveState();
    render();
    addMessage("Dados de exemplo recarregados.", "assistant");
  });

  document.getElementById("saveConfig").addEventListener("click", () => {
    state.settings.businessName = document.getElementById("businessName").value;
    state.settings.dailyGoal = Number(document.getElementById("dailyGoal").value);
    state.settings.cmvGoal = Number(document.getElementById("cmvGoal").value);
    state.settings.stockAlerts = document.getElementById("stockAlertsToggle").checked;
    saveState();
    render();
  });

  document.getElementById("globalSearch").addEventListener("input", (event) => {
    const term = event.target.value.toLowerCase().trim();
    if (!term) {
      renderClients();
      return;
    }
    const clients = state.clients.filter((item) => `${item.name} ${item.phone} ${item.status}`.toLowerCase().includes(term));
    document.getElementById("clientsTable").innerHTML = clients.map((item) => `
      <tr>
        <td>${item.name}<br><small>${item.last}</small></td>
        <td>${item.phone}</td>
        <td>${item.orders}</td>
        <td>${currency(item.average)}</td>
        <td>${currency(item.total)}</td>
        <td><span class="pill ${statusClass[item.status] || ""}">${item.status}</span></td>
      </tr>
    `).join("");
  });
}

wireEvents();
render();
addMessage("Distrito OS pronto. Você já pode perguntar sobre vendas, estoque, clientes ou produtos.", "assistant");
