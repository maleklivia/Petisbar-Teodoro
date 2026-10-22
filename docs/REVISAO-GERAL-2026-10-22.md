# Revisão geral de homologação — 22/10/2026

Status: em execução. Este documento registra cobertura e limitações; não é um aceite de operação real.

## Preservação

- Branch: `codex/revisao-geral-erp-20261022`.
- Runtime de origem: `f0a1900`, com correções não commitadas de cardápio, catálogo e configuração.
- Backup recuperável do Git, patch, arquivos e banco: `/opt/petisbar/review-backups/20261022-general` (permissão restrita).
- Histórico de implantação de entrega reconciliado com os commits de checkout/Pix.
- Melhorias já instaladas de produtos e configurações preservadas no commit `2037a6f`.

## Cobertura inicial de interface

Todas as 16 abas do menu foram abertas na sessão administrativa real. Também foram inspecionados os estados carregados de pedidos, produção, operação, estoque, compras, fornecedores, clientes, marketing, documentos, relatórios, configurações e contábil/fiscal. Catálogo requer verificação adicional após carregamento e nos três submenus.

## Problemas confirmados

| Área | Evidência | Situação |
|---|---|---|
| Dashboard | Dados locais, mês fixo julho/2026; divergente de financeiro e pedidos | Pendente |
| Pix | Webhook atualiza pagamento, mas não transita pedido pago para produção | Pendente |
| Pix | Ausência de reconciliação na consulta do pedido; concorrência na criação | Pendente |
| Operação | Caixa, mesas, entregadores e fidelidade escrevem somente no navegador | Pendente |
| Marketing | Cupons e CRM locais divergentes das promoções e checkout canônicos | Pendente |
| Documentos | Metadados gravados somente no navegador | Pendente |
| Modal compartilhado | Confirmação não aguarda gravação e não impede clique duplicado | Pendente |
| Eventos | Fornecedores, documentos, financeiro e relatórios adicionam listeners ao mesmo container em re-renderizações | Pendente |
| Testes | 46 passam, 1 falha por contrato antigo do preço de combo, 2 integrações ignoradas sem banco de teste | Pendente |
| Liberação comercial | Cardápio permanece em modo de teste sem estoque e Mercado Pago sandbox | Bloqueia vendas reais |

## Método

Testar gravações e fluxos destrutivos com dados sintéticos em banco PostgreSQL isolado. Validar navegação, permissões e erros na interface real. Não executar pagamentos reais, envio de comunicação, publicação de campanha ou transmissão fiscal. Configurações comerciais sem evidência não serão inventadas.

## Pendências de liberação

Ainda não há autorização de go-live: o trabalho é preparação e homologação. Estoque físico, preços comerciais, área de entrega, recebimento em produção, domínio, e-mail, backup externo e restauração devem ter evidência antes de divulgar o link.
