# Regras de retenção e anonimização

Estas regras acompanham a migração 017 e serão aplicadas pelos endpoints da Etapa 3 em diante.

- Pedidos visitantes continuam sem conta e não podem ser encontrados apenas pelo telefone.
- A exclusão de uma conta remove sessões e endereços da conta (`ON DELETE CASCADE`), mas não remove pedidos, itens, valores ou histórico comercial.
- Quando houver obrigação de preservar o pedido, dados identificáveis da conta serão anonimizados, mantendo os campos necessários ao registro comercial e fiscal.
- Tokens de acompanhamento são armazenados somente como hash e podem ser revogados ou expirar.
- Chaves de idempotência são temporárias; após o prazo de retenção podem ser eliminadas sem alterar pedidos já registrados.
- Solicitações de acesso, correção, exclusão ou anonimização ficam registradas em `customer_data_requests`, sem depender de apagar o pedido.
- E-mail, telefone e endereços não serão usados como prova isolada de identidade.
- A remoção física ou anonimização será feita por fluxo autenticado e auditável, nunca por consulta pública.

Os prazos concretos de retenção devem ser definidos pelo responsável da empresa conforme as obrigações fiscais e comerciais aplicáveis antes da ativação do fluxo de exclusão.
