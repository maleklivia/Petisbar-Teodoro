# Backend, PostgreSQL e autenticação

Esta pasta contém a fundação do modo servidor do Petisbar Teodoro. A versão atual do frontend continua funcionando com armazenamento local durante a transição. A API e o importador permitem iniciar a migração controlada; cada tela deverá ser conectada à API e homologada antes do uso operacional.

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
8. Acesse `https://SEU-DOMINIO/pages/migracao.html` no navegador que contém os dados locais.
9. Confira as quantidades e execute a importação uma única vez.
10. Compare os registros no banco antes de desativar o modo local.

## Rotas iniciais

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/v1/health` | Pública |
| POST | `/api/v1/auth/login` | Pública, limitada por tentativas |
| POST | `/api/v1/auth/logout` | Autenticado |
| GET | `/api/v1/auth/me` | Autenticado |
| GET/POST | `/api/v1/products` | `catalog.read` / `catalog.write` |
| GET | `/api/v1/ingredients` | `stock.read` |
| GET/POST | `/api/v1/users` | `users.manage` |
| PATCH | `/api/v1/users/:id/status` | `users.manage` |
| POST | `/api/v1/migration/local-storage` | `migration.run` |
| GET | `/api/v1/public/catalog` | Pública, somente produtos disponíveis |
| POST | `/api/v1/public/coupons/validate` | Pública, valida cupom, telefone e carrinho |
| POST | `/api/v1/public/orders` | Pública, limitada por tentativas e com preços recalculados no servidor |

## Cardápio público

O endereço `/cardapio.html` oferece catálogo, carrinho, retirada ou entrega, identificação do cliente e formas de pagamento sem coletar dados de cartão. Defina `DEFAULT_DELIVERY_FEE` no `.env` antes de ativar entregas.

Enquanto a API não estiver disponível, a página utiliza o catálogo provisório e finaliza o pedido pelo WhatsApp. Após a implantação, o mesmo link detecta a API e cria o pedido no PostgreSQL com origem `Cardápio Digital`.

O cupom `PRIMEIROPEDIDO` concede 10% de desconto, limitado a R$ 10,00, somente no primeiro pedido de cada telefone. Ele aparece apenas quando a API estiver ativa. O servidor valida o telefone ao aplicar e valida novamente ao finalizar, registrando o uso no PostgreSQL para impedir reutilização.

Antes de divulgar, configure o domínio, conclua a conexão da tela administrativa de Pedidos com a API e realize pedidos de homologação de ponta a ponta.

## Backup

O script `ops/backup/backup-postgres.sh` gera um dump em formato próprio do PostgreSQL e remove arquivos locais com mais de 30 dias. Em produção, o destino deve ser sincronizado com armazenamento externo criptografado. Uma restauração precisa ser testada regularmente.

## Antes do uso real

- Conectar todas as telas ao backend; atualmente a interface ainda mantém compatibilidade com `localStorage`.
- Criar testes automatizados de pedidos, baixa de estoque e financeiro.
- Configurar backup externo e monitoramento.
- Revisar domínio, e-mail, política de privacidade e perfis dos funcionários.
- Fazer homologação com dados de teste antes da migração definitiva.
