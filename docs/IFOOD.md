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

Cada produto possui `ifood_price` e `ifood_active` separados. A alteração do preço de venda recalcula o preço sugerido quando ele ainda é automático; um preço ajustado manualmente é preservado. Isso atualiza o cadastro local do ERP, não publica preço no marketplace.

## Escopo atualmente implementado

- Cálculo de preço sugerido por produto.
- Consulta de estado da integração.
- Polling de eventos/pedidos recebidos, com proteção contra duplicidade.
- Não há publicação/sincronização de catálogo, disponibilidade ou preços para o iFood nesta versão.
- O estado de produção foi verificado em 16/10/2026: `IFOOD_ENABLED=false` e sem ID de lojista configurado.

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

## Homologação após a auditoria interna e o cadastro do restaurante

1. Confirmar pela documentação oficial vigente quais escopos, homologação e publicação de catálogo são exigidos.
2. Revisar preços e produtos com a responsável pelo restaurante.
3. Obter credenciais oficiais e ID da loja; manter segredos somente na VPS.
4. Fazer backup e abrir janela acompanhada, sem ativar outra plataforma em paralelo.
5. Ativar somente após concluir a homologação e verificar o fluxo suportado nesta implementação.
6. Criar pedido de homologação apenas no ambiente aprovado pelo iFood, nunca no cardápio público de produção.
7. Conferir cliente, endereço, itens, complementos, descontos, total, duplicidade, cancelamento e status.

Como a publicação de catálogo não está implementada, não considerar o ERP pronto para sincronizar catálogo/preço/disponibilidade. A integração da 99 é independente e ainda não existe no código.

## Documentação oficial

- Planos e taxas: https://parceiros.ifood.com.br/restaurante/planos-ifood
- Autenticação: https://developer.ifood.com.br/en-US/docs/guides/modules/authentication/intro/
- Eventos de pedidos: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/events/
- Endpoints de pedidos: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/endpoints
- Catálogo: https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/introduction
