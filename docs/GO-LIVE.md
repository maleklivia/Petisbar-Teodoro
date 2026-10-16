# Auditoria operacional e entrada em operação

## Estado confirmado em 16/10/2026

- ERP implantado na VPS, servido por HTTPS e conectado ao PostgreSQL.
- As telas administrativas do domínio VPS usam API autenticada; o catálogo administrativo sem sessão responde `401`.
- API vinculada a `127.0.0.1:3000`, atrás do Caddy. A porta 3000 não deve ser acessível diretamente pela internet.
- Backup diário local ativo. O dump mais recente precisa ter uma restauração integral testada; cópia fora da VPS ainda é critério pendente.
- Testes de servidor executados em PostgreSQL temporário isolado: todos devem passar antes de cada implantação.
- iFood desligado e sem credenciais de lojista. A implementação atual cobre cálculo de preço e recebimento de eventos/pedidos; não publica/sincroniza catálogo.
- Integração 99 não implementada.

Este estado descreve evidências de infraestrutura e testes, não comprova operação real diária ponta a ponta. Não criar pedidos de teste no cardápio público: ele usa o banco de produção.

## Auditoria antes de ativar canais externos

1. Confirmar catálogo, preços, fotos, opções, horários, formas de pagamento, entrega/retirada e taxas.
2. Revisar fichas técnicas, ingredientes, unidades e rendimento; testar baixa de estoque e estorno em ambiente isolado.
3. Revisar permissões individuais, senha, sessão e acesso administrativo.
4. Testar fluxo de pedido interno sem criar transações reais nem pagamentos.
5. Conferir logs, espaço em disco, monitoramento, backups, restauração e plano de rollback.
6. Fazer um período de operação assistida no canal próprio, com pedidos reais autorizados pela operação, conferindo produção, entrega, estoque e financeiro.
7. Só então cadastrar e homologar cada marketplace separadamente, mantendo os demais desligados.

## Critérios pendentes antes de considerar pronto para operação plena

- Restauração real de backup em banco isolado e documentada.
- Cópia de backup fora da VPS com retenção definida.
- Revisão de segurança e monitoramento/alertas operacionais.
- Teste acompanhado de ponta a ponta pelo canal próprio, sem confundir teste com pedido real.
- Aprovação do catálogo e dos procedimentos do restaurante.

## iFood e 99

Não habilitar até a Lívia concluir a auditoria e confirmar o cadastro do restaurante. Consultar `docs/IFOOD.md` para o escopo atual do iFood. Para 99, primeiro identificar API oficial, credenciais e requisitos vigentes; não assumir compatibilidade com iFood.
