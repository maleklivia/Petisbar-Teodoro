# CHANGELOG — Petisbar Teodoro

Todas as mudanças significativas são documentadas aqui.
Formato: [Semantic Versioning](https://semver.org/lang/pt-BR/)

---

## [Unreleased] — 2026-07-20

- Removida a tela de login inicial; a raiz do sistema agora abre diretamente o dashboard.
- Removidos o bloqueio de autenticação e os controles de logout da interface.
- Padronizados todos os drinks preparados em copos de 500ml, com fichas técnicas e CMV recalculados.
- Substituídos os tamanhos antigos de açaí pela Batidinha de Açaí 300ml em garrafinha, vendida a R$ 15,00.

---

## [v0.3.0] — 2026-07-10

### Motor de Pedidos (Core)

- **`js/core/event-bus.js`** — EventBus pub/sub desacoplado. Catálogo `EVENTS` com 20+ constantes tipadas (pedidos, produtos, ingredientes, clientes, estoque, financeiro, sistema). Suporte a wildcard `*`. Auto-log via Logger quando disponível.
- **`js/core/logger.js`** — Logger auditável com circular buffer: 500 logs em memória, 200 no localStorage (`distrito-logs-v1`). Sanitização de dados sensíveis (`senha`, `token`, `cpf`).
- **`js/core/carrinho.js`** — Carrinho em memória com API fluente: `adicionar()`, `remover()`, `atualizarQty()`, `setTaxaEntrega()`, `setDesconto()`, `calcTotal()`, `toOrderData()`.
- **`js/core/estoque-service.js`** — Serviço de estoque: `verificarDisponibilidade()` via Fichas Técnicas, `reservarEstoque()` (soft), `baixarEstoque()` (efetivo ao entregar), `estornarEstoque()`.
- **`js/core/financeiro-service.js`** — Serviço financeiro: `registrarVenda()` (grava no finance[] do Storage para compatibilidade com KPIs), `registrarDespesa()`, `registrarPagamento()` (MVP: evento; futuro: PIX/Mercado Pago/iFood).

### Stores v0.3

- **`js/stores.js`** — Adicionados: `ORIGENS`, `STATUS_PEDIDO`, `FORMAS_PAGAMENTO`, `STATUS_TRANSITIONS`, `nextStatus()`, `nextNumeroPedido()`, `SEED_PEDIDOS` (5 pedidos), `SEED_CLIENTES` (3 clientes com endereços), `Stores.pedidos` (`distrito-pedidos-v1`), `Stores.clientes` (`distrito-clientes-v1`).

### Módulos

- **`js/modules/pedidos.js`** — PedidosModule: lista com filtro por status, modal de criação com Carrinho integrado (busca de produtos, qtd, taxas, descontos), avanço de status com side-effects (baixa de estoque + registro de venda ao Entregar), cancelamento com estorno.
- **`js/modules/clientes.js`** — ClientesModule: CRUD completo com busca, modal de criação/edição, gestão dinâmica de múltiplos endereços (adicionar/remover inline no modal).
- **`js/modules/producao.js`** — ProducaoModule: quadro kanban em 3 colunas (Pendentes / Em Produção / Prontos), cards com tempo decorrido desde a criação, avanço de status direto do board, botão de refresh manual.

### Páginas

- **`pages/pedidos.html`** — Reescrita: carrega todo o motor Core + PedidosModule.
- **`pages/clientes.html`** — Reescrita: carrega Core (EventBus + Logger) + ClientesModule.
- **`pages/producao.html`** — Reescrita: carrega Core + ProducaoModule, botão Atualizar.

### Visual

- **`css/pedidos.css`** — Status pills por status (8 variações), filtro bar, kanban board, modal wide (860px), painel de criação de pedido em 2 colunas, carrinho inline, totais, endereço rows.
- **`js/ui.js`** — `openModal()` agora aceita `size: 'wide' | 'small'`.

### Dashboard

- **`pages/dashboard.html`** — Adiciona `#order-stats-bar` (4 KPIs de pedidos: Hoje, Pendentes, Em Produção, Entregues Hoje). Carrega EventBus + Logger.
- **`js/app.js`** — `_renderOrderStats()` lendo de `Stores.pedidos`; módulos `pedidos`, `producao`, `clientes` delegam para seus módulos respectivos.

### Arquitetura

- Fluxo completo: Pedido criado → EventBus → Logger → EstoqueService (reserva) → mudança de status → EventBus → EstoqueService (baixa ao Entregar) → FinanceiroService (venda)
- Separação clara Core / Módulos / Pages — nenhum módulo de UI toca diretamente o storage
- Preparado para migração REST: cada método do Core vira um endpoint sem alterar chamadores
- WhatsApp, PIX, iFood, Impressão: arquitetura preparada (`registrarPagamento` com comentário FUTURO), sem implementação

---

## [v0.2.0] — 2026-07-09

### Adicionado
- **`js/stores.js`** — Store factory separado por domínio: `Stores.produtos`, `Stores.ingredientes`, `Stores.fichas`. Nunca mistura dados com o `storage.js` legado (pedidos, finanças, etc.). Inclui `CATEGORIAS_PRODUTO`, `CATEGORIAS_INGREDIENTE`, `UNIDADES`, `convertUnits()`, `compatibleUnits()`, `calcIngredienteCost()` com seed data completo de 5 produtos + 8 ingredientes + 4 fichas com IDs estáveis (`p-001…`, `i-001…`, `f-001…`)
- **`css/modules.css`** — Sistema visual para módulos: abas (`.module-tabs`, `.tab-btn`), toolbar (`.module-toolbar`), row actions (`.btn-icon`, `.btn-icon--danger`), status dot, layout ficha técnica (`.ficha-layout`, `.ficha-sidebar`, `.ficha-editor`), tabela de ingredientes inline, barra CMV (`.cmv-bar`), sumário financeiro (`.ficha-summary`), catalog stats (`.catalog-bar`, `.catalog-stat`)
- **`js/modules/fichas.js`** — `FichasModule`: editor de ficha técnica com auto-save em cada alteração (sem botão Salvar), cálculo em tempo real de CMV, margem e lucro, barra visual de CMV vs meta, `preload()` para uso cross-module, `deleteByProduto()` para cascade delete
- **`js/modules/ingredientes.js`** — `IngredientesModule`: CRUD completo com busca, filtro por categoria e status, ordenação, destaque de estoque abaixo do mínimo, validação de campos negativos
- **`js/modules/produtos.js`** — `ProdutosModule`: CRUD completo com duplicar, tabs Cardápio/Ingredientes/Fichas, custo real puxado da ficha técnica, filtro por categoria + status, busca por nome/código
- **`pages/produtos.html`** — Página completamente reescrita com layout de três abas, toolbar por aba, tabelas completas, ficha editor com sidebar de produtos

### Alterado
- **`js/utils.js`** — adicionado `escapeHtml()` para prevenção de XSS em toda renderização de dados do usuário
- **`js/app.js`** — `Modules.produtos` delega para `ProdutosModule.init()`; `Modules.dashboard` ganha `_renderCatalogStats()` lendo dos Stores v0.2
- **`pages/dashboard.html`** — adiciona `#catalog-bar` (4 KPIs do catálogo: Produtos, Ingredientes, Fichas, Categorias) e carrega `stores.js` + `modules.css`

### Arquitetura
- Stores separados por domínio com chaves versionadas (`distrito-produtos-v1`, etc.)
- Conversão de unidades bidirecional (g↔kg, ml↔L) via `convertUnits()`
- Cascade delete: excluir produto remove a ficha técnica automaticamente
- IDs estáveis no seed para referências cross-store sem colisão
- `escapeHtml()` aplicado em todo `innerHTML` que recebe dados do usuário

---

## [v0.1.0] — 2026-07-09

### Adicionado
- **Estrutura completa do projeto** com separação por responsabilidade (assets, components, css, js, pages, docs)
- **Design system** via `css/variables.css` com tokens de cor, tipografia, espaçamento, sombras e layout
- **CSS modular:** `global.css` (reset + utilitários), `login.css`, `sidebar.css`, `dashboard.css`
- **Identidade visual** Petisbar Teodoro: paleta preto `#111111` + dourado `#C8A24A` + cinza; fontes Bebas Neue e Montserrat
- **Tela de Login** profissional com validação, feedback de erro e redirecionamento automático
- **Sidebar** com 13 seções, ícones SVG e estado ativo dinâmico
- **Header** compartilhado com data e botão de logout
- **Dashboard** com 6 KPI cards calculados em tempo real: Faturamento, Lucro, Pedidos, Ticket Médio, CMV, Estoque Baixo
- **Dashboard** painéis laterais: Pedidos Recentes, Mais Vendidos, Alertas de Estoque
- **12 páginas stub** (Financeiro, Pedidos, Produção, Produtos, Estoque, Compras, Fornecedores, Clientes, Marketing, Documentos, Relatórios, Configurações)
- **`js/storage.js`** — gestão de estado com localStorage, seed data realista e migração de schema
- **`js/utils.js`** — helpers puros: formatação de moeda, datas, IDs, initials, debounce
- **`js/api.js`** — interface de dados unificada (proxy localStorage → preparada para backend)
- **`js/ui.js`** — ComponentLoader via fetch, Toast, Modal, setActiveNav
- **`js/app.js`** — App controller com auto-init via `data-page`, módulos por view
- **Sistema de autenticação** com localStorage; credenciais: `admin` / `petisbarteodoro`
- **ERP básico:** criação de pedido registra receita e CMV automaticamente no financeiro
- **`README.md`** com estrutura, como executar e roadmap
- **`MASTERPLAN.md`** com arquitetura, modelo de dados, regras de negócio e roadmap técnico
- **`CHANGELOG.md`** este arquivo

### Arquitetura
- Multi-page HTML com componentes compartilhados via `fetch()`
- `data-page` attribute no `<body>` define o módulo que inicializa a view
- Separação completa: zero CSS inline, zero JS inline (exceto `<script>` de boot na login)
- API layer isolada: quando backend for adicionado, só `api.js` muda

---

## Próximas Versões

### [v0.2.0] — Em planejamento
- Implementação completa de Pedidos (CRUD + status)
- Implementação completa de Produção (kitchen board)
- Implementação completa de Financeiro (extrato + lançamentos)
- Implementação completa de Estoque (edição + histórico)
- Implementação completa de Produtos (cardápio + fichas técnicas)
