# Recursos de operação

Esta etapa aproxima o Petisbar Teodoro dos principais recursos de plataformas de atendimento para restaurantes sem substituir o controle próprio do ERP.

## Disponível no sistema

- Frente de caixa: abertura, suprimento, sangria, conferência e fechamento.
- Mesas: cadastro, situação livre/ocupada e link com QR Code por mesa.
- Pedidos agendados: data e horário no cadastro manual e fila de acompanhamento.
- Entregadores: cadastro e disponibilidade para entregas próprias futuras.
- Fidelidade: configuração de percentual e validade do cashback, além de clientes recorrentes.
- Cardápio por mesa: identifica a mesa no pedido aberto pelo QR Code.

Enquanto o servidor ainda não estiver contratado, os dados operacionais ficam salvos no navegador deste dispositivo. A migração `006_operations.sql` deixa o PostgreSQL preparado para guardar esses dados após a publicação no VPS.

## Depende de ativação externa

- Robô oficial no WhatsApp, Instagram e Facebook: exige conta Meta Business, número aprovado e provedor/API oficial.
- Pagamento online: exige contrato e credenciais de um intermediador de pagamentos.
- Emissão de NFC-e: exige certificado digital, credenciamento fiscal e configuração tributária com contador.
- Pixel de anúncios: exige os identificadores das contas Meta e Google.
- iFood: exige credenciais concedidas ao restaurante e homologação da integração.

Essas integrações não devem ser marcadas como ativas antes da contratação e do teste em produção.
