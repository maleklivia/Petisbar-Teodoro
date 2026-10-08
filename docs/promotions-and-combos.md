# Promoções e combos

`products.sale_price` e os preços dos produtos usados nas opções permanecem como preços normais canônicos. A tabela `promotions` contém regras comerciais separadas. Alterar uma promoção nunca reescreve produtos nem pedidos históricos.

## Regras de cálculo

- Promoções ativas dentro do período são ordenadas por prioridade decrescente e, em empate, pelo código interno em ordem alfabética.
- Cada unidade do carrinho pode ser usada por uma única promoção. A regra de maior prioridade consome primeiro as unidades elegíveis; promoções de prioridade menor aparecem com o motivo `priority_conflict` quando não restam itens.
- A mesma promoção de combo pode aparecer mais de uma vez no carrinho quando cada instância tem seu próprio conjunto de componentes. Cada instância recebe uma aplicação e um snapshot separados; nenhuma unidade é reutilizada.
- Descontos percentuais e fixos são aplicados uma vez por promoção no conjunto de unidades ainda livre. Combos só são aplicados quando o cliente escolhe seus grupos e produtos.
- Cupom é calculado depois da promoção e sobre o subtotal promocional. Só é permitido quando todas as promoções aplicadas permitem acumulação. A ordem de cálculo é fixa e não depende da ordem do JSON recebido.
- Quantidade e opções formam linhas distintas. Cada componente do combo é persistido como item do pedido, com preço normal, preço aplicado, desconto, aplicação e grupo.
- O servidor bloqueia os produtos durante o cálculo, valida grupo, opções, preço fechado, estoque e reserva lógica do estoque físico/insumos na mesma transação do pedido.
- Reserva lógica não grava movimento nem reduz saldo. Cancelamento libera a reserva; conclusão consome os insumos pelas fichas técnicas e marca a reserva consumida.
- O modo de teste sem estoque ignora reservas e não gera baixa real.
- Pedidos marcados pelo modo de teste também não geram movimentos, CMV, lançamentos financeiros ou resgate real de cupom; ficam fora da contagem de vendas, clientes e primeiro pedido real.
- Preço fechado acima do menor preço normal possível do combo, referências a produto inativo, grupo vazio, quantidades inconsistentes e opções fora da regra impedem a aplicação/ativação.
- A ativação administrativa exige preço/regra configurados, produtos ativos e custo disponível por compra ou ficha técnica completa com unidades compatíveis. Margem desconhecida é exibida como não calculável; nenhum custo é estimado por aproximação.

## Histórico e auditoria

Cada aplicação registra código/nome/regra, subtotal normal, subtotal após promoção, desconto e snapshot das escolhas. `order_items.unit_price` continua sendo o preço efetivamente cobrado; `list_unit_price` registra o normal apenas nos pedidos novos. A migração não modifica itens ou valores já existentes.

Criação, edição e ativação/desativação geram `audit_logs`. Editar uma promoção ativa a desativa na mesma transação. Grupos antigos ficam preservados para manter os vínculos dos pedidos; suas escolhas também ficam no snapshot da aplicação.

As quatro ofertas iniciais são criadas como rascunhos, sem preço fechado e inativas. Skol só aparece quando existir como produto ativo no catálogo.
