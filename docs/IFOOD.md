# Integração iFood — Plano Entrega

## Preços

O Plano Entrega foi definido para o Petisbar Teodoro. A configuração considera:

- comissão: 23%;
- taxa para pedidos pagos pelo iFood: 3,2%;
- total variável usado no cálculo: 26,2%;
- mensalidade publicada: R$ 150 quando o faturamento ultrapassar o limite do plano; ela não está rateada nos produtos.

Para preservar o mesmo valor líquido da venda direta, o preço sugerido é calculado assim:

`preço iFood = preço da loja ÷ (1 - 0,262)`

Exemplo: um item de R$ 20,00 terá sugestão de R$ 27,11. Somar 26,2% daria apenas R$ 25,24 e não preservaria o líquido, pois a taxa incide sobre o novo preço.

Cada produto possui `ifood_price` e `ifood_active` separados. Nada será publicado automaticamente antes da revisão final do cardápio.

## Credenciais necessárias

Após o cadastro e a liberação da integração no portal do iFood, preencher somente no `.env` da VPS:

- `IFOOD_CLIENT_ID`;
- `IFOOD_CLIENT_SECRET`;
- `IFOOD_MERCHANT_ID`;
- `IFOOD_ENABLED=true` somente na homologação.

Nunca salvar essas credenciais no GitHub.

## Pedidos automáticos

Com a integração ativa, o backend autentica via OAuth 2.0, consulta eventos a cada 30 segundos, busca os dados de novos pedidos, grava os pedidos com origem `iFood` e só então confirma o processamento do evento. IDs externos e eventos são únicos no banco para impedir duplicidade.

Esta primeira etapa não confirma pedidos automaticamente no iFood. A aceitação continuará manual até validarmos tempo de preparo, horários, cancelamentos, indisponibilidade e operação real.

## Homologação antes de ativar

1. Revisar todos os preços sugeridos e marcar os produtos que irão ao iFood.
2. Obter credenciais de homologação/produção e o ID da loja.
3. Subir o VPS mantendo `IFOOD_ENABLED=false`.
4. Fazer backup do banco.
5. Ligar a integração em uma janela acompanhada.
6. Criar um pedido de teste e conferir cliente, endereço, itens, complementos, descontos e total.
7. Confirmar que o mesmo evento não cria pedido duplicado.
8. Validar cancelamento e mudança de status.

## Documentação oficial

- Planos e taxas: https://parceiros.ifood.com.br/restaurante/planos-ifood
- Autenticação: https://developer.ifood.com.br/en-US/docs/guides/modules/authentication/intro/
- Eventos de pedidos: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/events/
- Endpoints de pedidos: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/endpoints
- Catálogo: https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/introduction
