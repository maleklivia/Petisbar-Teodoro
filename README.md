# Petisbar Teodoro

> ERP web para gestão completa de delivery — construído para o Petisbar Teodoro, projetado para escalar.

---

## Objetivo

Petisbar Teodoro é um sistema de gestão operacional desenvolvido para restaurantes de delivery premium. Nasceu como ferramenta interna do **Petisbar Teodoro — Petiscos & Caldos Premium**, com arquitetura pensada desde o início para crescer como produto SaaS.

> **Estado atual:** versão de configuração e testes em um único navegador. Antes do uso operacional online, ainda são necessários backend, autenticação, banco de dados, backup e implantação segura. Consulte [docs/GO-LIVE.md](docs/GO-LIVE.md).

A fundação do modo servidor está em [`server/`](server/) e [`database/`](database/). Consulte [docs/BACKEND.md](docs/BACKEND.md) para instalação, segurança e migração.

O cardápio público está em [`cardapio.html`](cardapio.html). Antes da ativação do backend, ele finaliza pelo WhatsApp; com a API ativa, os pedidos entram automaticamente com origem **Cardápio Digital**.

---

## Tecnologias

| Camada      | Tecnologia                          |
|-------------|--------------------------------------|
| Frontend    | HTML5 · CSS3 · JavaScript (Vanilla)  |
| Persistência| localStorage (fase 1)                |
| Hospedagem  | GitHub Pages (fase 1)                |
| Fontes      | Bebas Neue · Montserrat (Google Fonts)|
| Futuro      | React · Node.js · PostgreSQL         |

---

## Estrutura do Projeto

```
Distrito-OS/
├── assets/
│   ├── logo/           Logomarca e variações
│   ├── icons/          Ícones do sistema
│   ├── images/         Imagens de produtos
│   └── backgrounds/    Texturas e fundos
├── components/
│   ├── sidebar.html    Navegação lateral
│   └── header.html     Barra superior
├── css/
│   ├── variables.css   Tokens de design (cores, espaçamentos, fontes)
│   ├── global.css      Reset, base, utilitários, botões, tabelas
│   ├── sidebar.css     Layout do app + sidebar
│   └── dashboard.css   Header, KPIs, painéis, notificações, modal
├── js/
│   ├── storage.js      Estado local e seed data
│   ├── utils.js        Formatadores, datas, helpers puros
│   ├── api.js          Interface de dados (localStorage → backend futuro)
│   ├── ui.js           ComponentLoader, Toast, Modal
│   └── app.js          Inicialização, roteamento, módulos de cada página
├── pages/
│   ├── dashboard.html  View principal com KPIs
│   ├── financeiro.html Entradas, saídas, lucro
│   ├── pedidos.html    Gestão de pedidos
│   ├── producao.html   Kitchen display
│   ├── produtos.html   Cardápio e fichas técnicas
│   ├── estoque.html    Controle de insumos
│   ├── compras.html    Lista de compras automática
│   ├── fornecedores.html Cadastro de fornecedores
│   ├── clientes.html   CRM de clientes
│   ├── marketing.html  Campanhas e redes sociais
│   ├── documentos.html Contratos e arquivos
│   ├── relatorios.html Relatório mensal
│   └── configuracoes.html Configurações do sistema
├── docs/               Documentação técnica
├── database/           Schemas e migrations futuras
├── index.html          Redirecionamento para o dashboard
├── README.md
├── MASTERPLAN.md
└── CHANGELOG.md
```

---

## Como Executar

### GitHub Pages (produção)
Acesse: `https://maleklivia.github.io/Distrito-OS`

### Desenvolvimento local
O sistema usa `fetch()` para carregar componentes HTML, o que requer um servidor HTTP local (não funciona via `file://`).

**Opção 1 — Python:**
```bash
python3 -m http.server 8080
# Acesse http://localhost:8080
```

**Opção 2 — Node.js (npx):**
```bash
npx serve .
# Acesse http://localhost:3000
```

**Opção 3 — VS Code:**
Instale a extensão **Live Server** e clique em "Go Live".

## Roadmap

| Versão | Foco                                  | Status      |
|--------|---------------------------------------|-------------|
| v0.1   | Estrutura, Dashboard e Sidebar        | ✅ Entregue  |
| v0.2   | Pedidos, Produção, Financeiro, Estoque| 🔄 Próximo  |
| v0.3   | Clientes, Fornecedores, Compras       | ⏳ Planejado |
| v0.4   | Relatórios, Marketing, Configurações  | ⏳ Planejado |
| v0.5   | Integração iFood API                  | ⏳ Planejado |
| v1.0   | Backend multi-tenant, SaaS launch     | 🎯 Objetivo  |

---

## Contribuição

Este projeto é proprietário. Para contribuir ou reportar problemas, entre em contato com o time de desenvolvimento.

---

*Petisbar Teodoro — construído para durar.*
