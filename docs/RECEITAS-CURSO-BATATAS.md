# Receitas do curso de batatas recheadas

O ERP importa o conteúdo transcrito dos e-books liberados do curso Batatona’s em uma área de conferência dentro de **Produtos → Fichas Técnicas**.

## O que é importado

- Seis preparações-base descritas pelo curso.
- Duas bases auxiliares em rascunho: strogonoff de carne e fricassê de frango. O material não fornece quantidades completas para elas.
- Onze fichas de produtos, com quantidades confirmadas preservadas e pendências visíveis.
- Materiais de venda em linhas separadas dos ingredientes.

As fichas do curso ficam em `recipe_cards` e `recipe_card_items`, com códigos de origem estáveis e importação idempotente executada junto às migrations. O vínculo com um ingrediente só é feito quando há exatamente um nome igual no cadastro. Correspondências ausentes ou ambíguas ficam pendentes para revisão.

## Separação e segurança operacional

As receitas importadas ficam isoladas das fichas técnicas operacionais existentes. A migration não substitui composições, não altera preço, pedido, histórico ou estoque e não cria movimento físico. A receita de PROD-01 fica apenas associada ao cadastro existente `p-br001` para referência; sua ficha operacional não é substituída.

As receitas só devem ser usadas como fichas operacionais após revisar os vínculos, preencher rendimento e demais pendências, confirmar custos e deliberadamente integrar cada composição ao cadastro operacional. Até lá, o ERP exibe custo parcial como parcial e omite custo final.

## Unidades e pendências

As unidades do curso são mantidas. O sistema não presume equivalência entre ml e g, nem entre unidades e peso. O rendimento pronto precisa ser pesado; o custo unitário da preparação é calculado como custo total do lote dividido pelo rendimento pronto somente quando todos os dados estiverem completos.

A capacidade de 500 ml da cumbuca é exibida como capacidade da embalagem, sem tratá-la como peso. “A gosto”, quantidades ausentes, rendimentos não pesados e o insumo de cheddar da finalização permanecem explicitamente pendentes. Carne com molho branco não é importada como receita confirmada.

## Como aplicar

Na implantação futura, `server/scripts/migrate.js` aplica a migration PostgreSQL `020_course_recipe_cards.sql` e importa as fichas do curso dentro de uma transação repetível. Abrir **Produtos → Fichas Técnicas → Receitas do curso** permite revisar o conteúdo e as pendências. Nenhuma ativação automática ocorre.
