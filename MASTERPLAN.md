# MASTERPLAN — Petisbar Teodoro

> Documento vivo. Toda decisão arquitetural é registrada aqui.
> Última atualização: Julho 2026 — v0.1

---

## 1. Visão

**Petisbar Teodoro** nasceu para resolver um problema real: donos de delivery trabalham no escuro. Não sabem exatamente quanto estão lucrando, quais produtos drenam o caixa, quando o estoque vai acabar ou qual cliente está prestes a abandonar a marca.

**Visão de curto prazo:** ERP interno do Petisbar Teodoro — operação mais eficiente, menos desperdício, mais lucro.

**Visão de longo prazo:** Produto SaaS para restaurantes de delivery premium em todo o Brasil.

```
137 restaurantes × R$ 89/mês = R$ 12.193/mês de MRR
```

---

## 2. Arquitetura Atual (v0.1)

### Stack
```
Browser
  └── index.html (login)
  └── pages/*.html (views multi-page)
        └── components/sidebar.html  (injetado via fetch)
        └── components/header.html   (injetado via fetch)
        └── css/variables.css        (design tokens)
        └── css/global.css           (base + utilitários)
        └── css/sidebar.css          (layout app)
        └── css/dashboard.css        (views + componentes)
        └── js/storage.js            (estado + auth)
        └── js/utils.js              (helpers puros)
        └── js/api.js                (interface de dados)
        └── js/ui.js                 (ComponentLoader + UI)
        └── js/app.js                (módulos de cada view)
  └── localStorage                   (persistência)
```

### Princípios de Design
- **Separação clara:** HTML estrutura, CSS estilo, JS comportamento. Zero CSS/JS inline.
- **API Layer isolada:** `api.js` é a única camada que toca dados. Quando o backend chegar, só este arquivo muda.
- **Data-page routing:** cada `<body data-page="X">` dispara o módulo correto em `app.js`. Sem rotas hardcoded no HTML.
- **Component injection:** sidebar e header são componentes reutilizáveis carregados via `fetch()`. Quando migrar para React, viram componentes JSX sem reescrita de lógica.

---

## 3. Fluxo dos Módulos

```
Login (index.html)
  → Auth check (Storage.isAuthenticated)
  → [OK] pages/dashboard.html
  → [FAIL] permanece no login

Dashboard
  → Carrega sidebar + header (UI.loadSidebar, UI.loadHeader)
  → Calcula KPIs do mês (Faturamento, Lucro, Pedidos, Ticket, CMV, Estoque Baixo)
  → Renderiza: Pedidos Recentes, Mais Vendidos, Alertas de Estoque

[Navegação via sidebar]
  → Cada página carrega os mesmos componentes compartilhados
  → App.init(page) detecta o módulo correto e inicializa a view
```

---

## 4. Modelo de Dados (localStorage)

```javascript
{
  settings: {
    restaurantName: String,
    cmvGoal: Number,        // % meta de CMV (padrão: 35)
    currency: 'BRL',
    version: String,
  },
  products: [{
    id: Number,
    name: String,
    category: String,
    price: Number,          // preço de venda
    cost: Number,           // custo (para CMV)
    sold: Number,           // contador de vendas
  }],
  stock: [{
    id: Number,
    name: String,           // ingrediente ou insumo
    unit: String,           // 'kg', 'un', 'L'
    quantity: Number,       // quantidade atual
    min: Number,            // mínimo para alerta
  }],
  orders: [{
    id: String,             // '#001', '#002'...
    date: String,           // 'YYYY-MM-DD'
    product: String,
    qty: Number,
    total: Number,
    client: String,
    status: String,         // ver fluxo abaixo
  }],
  finance: [{
    id: String|Number,
    date: String,           // 'YYYY-MM-DD'
    description: String,
    category: String,       // 'Vendas', 'CMV', 'Fornecedores', 'Fixo', 'Operacional'
    type: String,           // 'Entrada' | 'Saída'
    value: Number,          // positivo = entrada, negativo = saída
  }],
  clients: [{
    id: Number,
    name: String,
    phone: String,
    orders: Number,
    totalSpent: Number,
    lastPurchase: String,
    favorite: String,
  }],
  fornecedores: [{
    id: Number|String,
    name: String,
    product: String,
    phone: String,
    price: String,
    lastBuy: String,
    notes: String,
  }],
  campaigns: [],            // reservado para v0.3
}
```

### Fluxo de Status de Pedido
```
Aguardando pagamento → Em produção → Saiu para entrega → Pedido finalizado
```

---

## 5. Regras de Negócio

### CMV (Custo da Mercadoria Vendida)
- Meta padrão: **35%** (configurável em `settings.cmvGoal`)
- Calculado como: `sum(CMV saídas) / sum(Vendas entradas) × 100`
- Acima da meta → card de CMV fica vermelho no dashboard
- Registro automático: ao criar pedido, `api.js` registra a saída de CMV no financeiro

### Estoque Baixo
- Alerta quando `stock.quantity <= stock.min`
- Exibido no dashboard (KPI + painel lateral)
- Gerador da lista de compras na view Compras

### Ticket Médio
- `Faturamento do mês / Pedidos do mês`
- Calculado apenas sobre pedidos do mês corrente

---

## 6. Roadmap Técnico

### v0.2 — Core ERP (próximo)
- [ ] View Pedidos: criar, editar, avançar status
- [ ] View Produção: kitchen board em tempo real
- [ ] View Financeiro: lançamentos manuais, extrato mensal
- [ ] View Estoque: editar quantidades, histórico de movimentação
- [ ] View Produtos: cadastro completo com fichas técnicas

### v0.3 — Relacionamentos
- [ ] View Clientes: CRM, histórico, fidelidade
- [ ] View Fornecedores: cadastro, histórico de compras
- [ ] View Compras: lista automática + pedidos a fornecedores
- [ ] ERP completo: venda deduz ingredientes do estoque por receita

### v0.4 — Inteligência
- [ ] View Relatórios: mensal, CMV, mais/menos vendidos
- [ ] View Marketing: campanhas, cupons
- [ ] Exportação PDF/Excel

### v0.5 — Integrações
- [ ] iFood API: receber pedidos automaticamente
- [ ] WhatsApp Business API: notificações de pedido
- [ ] Mercado Pago / Stripe: pagamentos online

### v1.0 — SaaS
- [ ] Backend: Node.js + Express + PostgreSQL
- [ ] Multi-tenant: cada restaurante é um workspace isolado
- [ ] React: migração do frontend
- [ ] Auth: JWT + roles (Admin, Caixa, Funcionário, Cozinheiro)
- [ ] Billing: Stripe com planos mensais
- [ ] Deploy: AWS / Railway com CI/CD

---

## 7. Banco de Dados Futuro (PostgreSQL)

```sql
-- Tabelas principais
restaurants (id, name, slug, plan, created_at)
users (id, restaurant_id, name, email, role, password_hash)
products (id, restaurant_id, name, category, price, cost, active)
stock_items (id, restaurant_id, name, unit, quantity, min_quantity)
orders (id, restaurant_id, external_id, status, total, created_at)
order_items (id, order_id, product_id, quantity, unit_price)
transactions (id, restaurant_id, type, category, value, date, description)
clients (id, restaurant_id, name, phone, email)
suppliers (id, restaurant_id, name, contact, notes)
```

---

## 8. Integrações Futuras

| Integração         | Propósito                              | Fase |
|--------------------|----------------------------------------|------|
| iFood Partner API  | Receber pedidos automaticamente        | v0.5 |
| WhatsApp Business  | Notificações de status de pedido       | v0.5 |
| Mercado Pago       | Pagamentos e conciliação               | v1.0 |
| Meta Ads           | Campanhas de marketing                 | v0.4 |
| LocalWeb / AWS     | Hospedagem do backend                  | v1.0 |

---

## 9. Decisões Registradas

| Data       | Decisão                                            | Motivo                                      |
|------------|----------------------------------------------------|---------------------------------------------|
| 2026-07    | Multi-page HTML ao invés de SPA em um arquivo      | Separação de responsabilidades, manutenção  |
| 2026-07    | localStorage com `storeKey = 'distrito-os-v5'`     | Compatibilidade com dados existentes        |
| 2026-07    | API layer separada de Storage                      | Troca de backend sem alterar views          |
| 2026-07    | Componentes via fetch() ao invés de template JS    | Mantém HTML semântico, fácil migração React |
| 2026-07    | Sem frameworks externos na v0.1                    | Zero dependências, carrega em ms            |

---

*Petisbar Teodoro — Feito para durar. Projetado para crescer.*
