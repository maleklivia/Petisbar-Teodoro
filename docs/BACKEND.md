# Backend, PostgreSQL e autenticação

Esta pasta contém o backend operacional do Petisbar Teodoro, implantado na VPS. No domínio da VPS, as telas administrativas migradas usam API autenticada e PostgreSQL. A versão do GitHub Pages permanece uma demonstração local e não é fonte operacional.

## Componentes

- Node.js 22 + Fastify.
- PostgreSQL 17.
- Senhas protegidas com Argon2id.
- Sessões aleatórias armazenadas como hash no banco.
- Cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção.
- Bloqueio por 15 minutos após cinco tentativas de login incorretas.
- Perfis: administrador, gerente, atendente, produção e estoquista.
- Permissões individuais por função.
- Auditoria de criação de usuário e importações.
- Importação idempotente do `localStorage`, preservando uma cópia integral do conteúdo recebido.

## Instalação local ou na VPS

1. Copie `.env.example` para `.env`.
2. Troque todas as senhas, domínio, e-mail do administrador e `COOKIE_SECRET`.
3. Aponte o DNS do domínio para a VPS.
4. Libere somente as portas 22, 80 e 443 no firewall; restrinja a porta 22 ao IP administrativo quando possível.
5. Execute:

```bash
docker compose build
docker compose up -d postgres
docker compose run --rm migrate
docker compose run --rm api node scripts/create-admin.js
docker compose up -d
```

6. Remova `ADMIN_PASSWORD` do `.env` depois que o administrador for criado.
7. Verifique `https://SEU-DOMINIO/api/v1/health`.
8. Entre em `https://SEU-DOMINIO/pages/login.html` com o administrador criado.
9. Acesse `https://SEU-DOMINIO/pages/migracao.html` no navegador que contém os dados locais.
10. Confira as quantidades e execute a importação uma única vez.
11. Compare os registros no banco antes de desativar o modo local.

## Rotas iniciais

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/v1/health` | Pública |
| POST | `/api/v1/auth/login` | Pública, limitada por tentativas |
| POST | `/api/v1/auth/logout` | Autenticado |
| GET | `/api/v1/auth/me` | Autenticado |
| GET/POST | `/api/v1/products` | `catalog.read` / `catalog.write` |
| DELETE | `/api/v1/products/:id` | `catalog.write`, inativa o produto |
| GET/POST | `/api/v1/ingredients` | `stock.read` / `stock.write` |
| DELETE | `/api/v1/ingredients/:id` | `stock.write`, inativa o ingrediente |
| GET | `/api/v1/technical-sheets` | `catalog.read` |
| PUT | `/api/v1/technical-sheets/:productId` | `catalog.write` |
| GET/POST | `/api/v1/clients` | `clients.read` / `clients.write` |
| PUT/DELETE | `/api/v1/clients/:id` | `clients.write`, exclusão inativa o cliente |
| GET/POST | `/api/v1/stock/movements` | `stock.read` / `stock.write` |
| GET/POST | `/api/v1/finance/entries` | `finance.read` / `finance.write` |
| DELETE | `/api/v1/finance/entries/:id` | `finance.write`, bloqueia lançamentos automáticos |
| GET/POST | `/api/v1/suppliers` | `purchases.manage` |
| PUT/DELETE | `/api/v1/suppliers/:id` | `purchases.manage`, exclusão inativa o fornecedor |
| GET/POST | `/api/v1/purchases` | `purchases.manage` |
| PATCH | `/api/v1/purchases/:id/status` | `purchases.manage`, recebimento atualiza estoque e financeiro |
| GET | `/api/v1/reports/overview` | `reports.read` |
| GET/POST | `/api/v1/users` | `users.manage` |
| PATCH | `/api/v1/users/:id/status` | `users.manage` |
| POST | `/api/v1/migration/local-storage` | `migration.run` |
| GET | `/api/v1/public/catalog` | Pública, somente produtos disponíveis |
| POST | `/api/v1/public/coupons/validate` | Pública, valida cupom, telefone e carrinho |
| POST | `/api/v1/public/orders` | Pública, limitada por tentativas e com preços recalculados no servidor |
| GET | `/api/v1/orders` | `orders.read` |
| GET | `/api/v1/orders/:id` | `orders.read` |
| POST | `/api/v1/orders` | `orders.write` |
| PATCH | `/api/v1/orders/:id/status` | `orders.write` |
| GET | `/api/v1/integrations/ifood/status` | `settings.manage` |
| POST | `/api/v1/integrations/ifood/pricing-preview` | `catalog.write` |

## Cardápio público

O endereço `/cardapio.html` oferece catálogo, carrinho, retirada ou entrega, identificação do cliente e formas de pagamento sem coletar dados de cartão. Defina `DEFAULT_DELIVERY_FEE` no `.env` antes de ativar entregas.

No domínio da VPS, o cardápio usa catálogo/API e grava pedidos no PostgreSQL com origem `Cardápio Digital`. Não usar a página pública para criar pedidos de teste, pois as gravações chegam ao banco de produção.

O cupom `PRIMEIROPEDIDO` concede 10% de desconto, limitado a R$ 10,00, somente no primeiro pedido de cada telefone. Ele aparece apenas quando a API estiver ativa. O servidor valida o telefone ao aplicar e valida novamente ao finalizar, registrando o uso no PostgreSQL para impedir reutilização.

Antes de divulgar, revise as configurações e conclua uma homologação interna controlada. Não crie pedidos fictícios no domínio público de produção.

Ao mudar um pedido para `Entregue` ou `Concluído`, a API executa na mesma transação a baixa dos ingredientes da ficha técnica (ou do estoque direto do produto), a movimentação de estoque, a receita e o CMV. Um cancelamento posterior gera movimentos e lançamentos de estorno. As marcações no pedido e as chaves financeiras tornam esses efeitos idempotentes.

| GET/PUT | `/api/v1/accounting-fiscal/profile` | `accounting.read/write` |
| GET/POST/DELETE | `/api/v1/accounting-fiscal/documents` | `accounting.read/write` |
| GET/POST/PATCH | `/api/v1/accounting-fiscal/obligations` | `accounting.read/write` |
| GET | `/api/v1/accounting-fiscal/monthly-report?month=YYYY-MM` | `accounting.read` |

### Contábil e fiscal (base MEI)

A migração `009_accounting_fiscal_mei.sql` cria plano de contas, documentos fiscais e obrigações. Para 2026, o DAS-MEI deve ser conferido no Portal do Empreendedor: a parcela depende da atividade (comércio, serviço ou ambas) e do salário mínimo vigente. O ERP deve registrar a guia e o comprovante, mas não substitui a emissão oficial nem a validação do contador.

No domínio da VPS, todas as telas administrativas exigem uma sessão válida. As telas de Pedidos, Produção, Produtos, Ingredientes, Fichas Técnicas, Clientes, Estoque, Compras, Fornecedores, Financeiro e Relatórios já usam a API. As telas ainda não migradas exibem um aviso explícito de que seus dados continuam locais. O modo local permanece disponível no GitHub Pages para demonstração e pode ser ativado deliberadamente com `?local=1` durante desenvolvimento.

## iFood e 99

iFood inicia desligado. Há cálculo de preço e recebimento de eventos/pedidos, mas não há publicação/sincronização de catálogo nesta versão. A integração 99 não está implementada. Não habilitar marketplaces antes da auditoria interna e de credenciais oficiais do restaurante. Consulte `docs/IFOOD.md`.

## Backup

Em produção, `petisbar-db-backup.timer` executa `/opt/petisbar/app/ops/backup/native-postgres.sh` diariamente e valida o dump local em `/var/backups/petisbar`. O backup fica na própria VPS: configure cópia externa criptografada e retenção, e teste uma restauração em banco isolado. `pg_restore --list` não substitui o teste de restauração.

## Antes do uso real

- Confirmar quais telas restantes permanecem locais; elas mostram aviso de não migração.
- Configurar backup externo e monitoramento.
- Revisar domínio, e-mail, política de privacidade e perfis dos funcionários.
- Fazer homologação interna sem pedidos artificiais no banco de produção.

