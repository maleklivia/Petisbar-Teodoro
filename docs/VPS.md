# Preparação da VPS

## Requisitos recomendados

- Ubuntu LTS atualizado;
- 2 vCPU, 4 GB de RAM e ao menos 40 GB SSD;
- domínio próprio apontado para o IP da VPS;
- acesso SSH por chave, sem senha;
- portas públicas somente 22, 80 e 443;
- Docker Engine com Compose;
- armazenamento externo para backups.

## Primeira instalação

1. Criar um usuário administrativo sem usar `root` no dia a dia.
2. Instalar atualizações, Docker e o plugin Compose pelos repositórios oficiais.
3. Clonar o repositório em `/opt/petisbar/Distrito-OS`.
4. Copiar `.env.example` para `.env` e trocar todas as senhas e o domínio.
5. Manter `IFOOD_ENABLED=false` na primeira subida.
6. Executar:

```bash
docker compose build
docker compose up -d postgres
docker compose run --rm migrate
docker compose run --rm api node scripts/create-admin.js
docker compose up -d
```

7. Remover `ADMIN_PASSWORD` do `.env`.
8. Conferir `https://SEU-DOMINIO/api/v1/health`.
9. Configurar backup diário externo e testar uma restauração.
10. Só depois executar a homologação do iFood descrita em `docs/IFOOD.md`.

## Segredos para implantação pelo GitHub

O fluxo de implantação fica preparado, mas só funcionará após cadastrar no repositório:

- `VPS_HOST`;
- `VPS_USER`;
- `VPS_SSH_KEY`;
- `VPS_KNOWN_HOSTS`.

O deploy usa o checkout em `/opt/petisbar/app`, instala as dependências em `server/`, executa as migrações com `systemd` usando `/etc/petisbar.env` e reinicia `petisbar-api.service`. O Caddy continua servindo os arquivos estáticos desse checkout.

O arquivo `/etc/petisbar.env` permanece apenas na VPS. A implantação não o interpreta pelo shell. O workflow deve ser executado com uma conta SSH autorizada a atualizar esse checkout, instalar dependências como `petisbar`, executar uma unidade transitória de migração e reiniciar o serviço. Ele só publica `origin/main`, verifica a prontidão da API e tenta restaurar o commit anterior se uma etapa falhar.
