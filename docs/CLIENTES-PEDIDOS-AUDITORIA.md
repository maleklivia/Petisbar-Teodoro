# Auditoria — Clientes, pedidos e acompanhamento

Etapa 1 do projeto de evolução do Petisbar Teodoro. Esta auditoria foi realizada na branch `codex/clientes-pedidos-fase1`, derivada de `origin/main` em 2026-10-08.

## Escopo e restrições

- Arquitetura preservada: frontend estático + API Fastify/Node.js + PostgreSQL no VPS Locaweb.
- Nenhuma alteração foi feita na VPS ou no banco de produção.
- Supabase não será adicionado.
- A branch de implementação será revisada antes de qualquer implantação.

## Arquitetura encontrada

| Camada | Implementação atual | Evidência |
|---|---|---|
| Cardápio | HTML, CSS e JavaScript | `cardapio.html`, `js/cardapio.js`, `css/cardapio.css` |
| ERP | Páginas HTML e módulos JavaScript | `pages/`, `js/modules/` |
| API | Fastify em Node.js 22 | `server/src/app.js`, `server/package.json` |
| Banco | PostgreSQL com migrações SQL | `database/migrations/` |
| Sessão administrativa | Cookie de sessão + tabela `sessions` | `server/src/routes/auth.js`, `server/src/middleware/auth.js` |
| Produção | systemd no VPS Locaweb | `ops/systemd/`, documentação operacional |

## Recursos já existentes

- Login administrativo com bloqueio após tentativas inválidas.
- Permissões por domínio do ERP.
- Cadastro de clientes e endereços no ERP.
- Checkout público sem cadastro.
- Validação de preço, disponibilidade, estoque, loja aberta, pedido mínimo e pagamento no servidor.
- Itens do pedido armazenados com nome, preço, quantidade e opções no momento da compra.
- Atualização de status no painel administrativo.
- Efeitos de estoque e financeiro com proteção de repetição.
- Rate limiting nos endpoints públicos do cardápio.
- HTTPS e cabeçalhos de segurança no servidor web.

## Lacunas confirmadas

1. O login existente é exclusivo do ERP; não há identidade ou sessão de cliente.
2. O checkout público cria o pedido, mas não gera token seguro de acompanhamento.
3. Não existe endpoint público autorizado para consultar o status de um pedido por token.
4. O cardápio não possui página de acompanhamento nem área “Minha conta”.
5. Não há histórico de status persistido por pedido.
6. Pedidos públicos não são vinculados a uma conta de cliente autenticada.
7. Não há mecanismo de idempotência específico para reenvio do checkout.
8. Não há fluxo de link mágico, recuperação de acesso ou OAuth Google.
9. O painel de clientes ainda não calcula histórico, ticket médio e recorrência de forma dedicada.
10. Não há tabelas próprias para pagamentos, consentimentos e retenção de dados.

## Fonte canônica proposta

- Produtos, preços e disponibilidade: tabela `products`.
- Pedido e valores históricos: `orders` e `order_items`.
- Conta do cliente: tabelas próprias, separadas de `users` administrativos.
- Status: `orders.status` como estado atual e `order_status_history` como trilha histórica.
- Acompanhamento visitante: token aleatório com hash, expiração e revogação.
- Duplicidade: chave de idempotência por tentativa de checkout, validada no servidor.

## Sequência de implementação

1. Criar migrações e entidades de cliente, sessões, endereços, histórico, tokens e idempotência.
2. Criar autenticação de clientes por e-mail; manter Google como integração configurável posterior.
3. Associar pedidos autenticados sem alterar o fluxo visitante.
4. Criar acompanhamento por token e página responsiva.
5. Criar “Minha conta”, histórico e “Pedir novamente”.
6. Ampliar painel administrativo e relatórios.
7. Executar testes de autorização, isolamento, duplicidade, concorrência, regressão e interface.

## Critério para avançar

A Etapa 2 só deve começar depois de revisar este mapa, confirmar que as entidades propostas não duplicam estruturas existentes e definir as variáveis de ambiente necessárias para e-mail e Google OAuth. Nenhum segredo será versionado.

