# Checklist para começar a usar o Petisbar Teodoro

## Estado atual

O sistema está pronto para configurar e testar o cardápio, as fichas e o estoque em um único navegador. Os dados ainda ficam no `localStorage`, sem login real, banco central ou backup automático. Portanto, a versão do GitHub Pages não deve ser usada como sistema operacional definitivo nem para guardar dados pessoais de clientes.

## Ordem recomendada

1. Revisar produtos, preços, fotos e fichas técnicas.
2. Cadastrar ingredientes, estoque mínimo, consumo diário, prazo de reposição e quantidade por pacote.
3. Preencher os dados reais do restaurante, horários, taxas e zonas de entrega.
4. Fazer um teste completo: compra, entrada no estoque, pedido, produção, entrega, baixa de estoque e financeiro.
5. Desenvolver o backend com API, autenticação e permissões.
6. Criar o banco PostgreSQL e a migração dos dados do navegador.
7. Registrar um domínio próprio.
8. Contratar a VPS somente quando o backend estiver pronto para implantação.
9. Configurar servidor Linux, firewall, atualizações automáticas, Docker, proxy HTTPS e variáveis secretas.
10. Configurar backups automáticos fora da VPS e testar uma restauração.
11. Preparar política de privacidade, retenção e acesso aos dados conforme a LGPD.
12. Fazer homologação por alguns dias e só então iniciar a operação real.

## Critérios mínimos antes de operar

- Login individual funcionando, sem senha salva no navegador.
- HTTPS ativo no domínio próprio.
- Banco de dados não exposto diretamente à internet.
- Backup diário automatizado e cópia fora da VPS.
- Restauração de backup testada.
- Monitoramento de disponibilidade, espaço em disco e erros.
- Atualizações de segurança e firewall configurados.
- Exportação dos dados e plano de contingência disponíveis.

## Referências

- Limitações do GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- HTTPS automático com Caddy: https://caddyserver.com/docs/automatic-https
- Backup e restauração do PostgreSQL: https://www.postgresql.org/docs/current/backup.html
- Guia de segurança para pequenos agentes da ANPD: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-vf.pdf
