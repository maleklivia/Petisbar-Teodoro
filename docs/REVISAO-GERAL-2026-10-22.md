# Revisão geral — 22/10/2026

## Conclusão e limites

As correções abaixo passaram por homologação isolada. Isso não equivale a afirmar que todo botão, dispositivo ou integração externa está homologado, nem autoriza vendas reais. A entrada comercial continua bloqueada pelos itens da última seção.

PR: https://github.com/maleklivia/Petisbar-Teodoro/pull/117

Branch: `codex/revisao-geral-erp-20261022`. Base: `origin/main` em `8720f59`, incorporada sem apagar melhorias anteriores.

## Preservação e fonte canônica

- Runtime inicial: `f0a1900f0da7e633d1658e946ca042e20ba3783c`, com onze arquivos modificados e três cópias .bak não rastreadas.
- Backup de Git, patch, arquivos e PostgreSQL: `/opt/petisbar/review-backups/20261022-general`, acesso restrito.
- SHA256 do patch inicial e reconferido: `289b5f54bde29c112462c10fc14e608414688099b8dcb716118c1eac70298319`.
- Correções anteriores preservadas e reconciliadas no clone local, sem reset destrutivo.
- PostgreSQL permanece a fonte operacional. Caixa, mesas, entregadores, cupons e documentos usam entidades no servidor, não uma segunda base gravável no navegador.
- Migração 026 aditiva/idempotente, preservando histórico e removendo a unicidade global indevida do hash de códigos de login. Migrações 021, 022 e 024 já aplicadas no runtime reconciliadas com arquivos da main.

## Causas e correções

| Área | Causa | Correção |
|---|---|---|
| Modais e cancelamentos | Gravação não aguardada e eventos acumulados em renderizações | Aguardar API, bloquear duplicação, validar formulário e handlers únicos |
| Dashboard | Dados demonstrativos locais e mês fixo | Agregação canônica no servidor sem truncar total nos primeiros mil pedidos |
| Pedido e produção | Critérios de pagamento divergentes | Cartão/dinheiro no recebimento liberam produção; Pix exige confirmação autenticada |
| Pix | Webhook não encerrava espera; criação concorrente | Reconciliação periódica, validação de referência/valor e chave idempotente |
| Estoque | Consumo usava ficha editada depois da aceitação | Snapshot da reserva, expansão canônica de preparações, unidades e estorno idempotente |
| Compras | Recebimento concorrente podia duplicar efeitos | Bloqueio transacional, custo/quantidade convertidos; rascunhos sem vínculo aceitos |
| Foto e opções | Serialização JSON e URL da prévia divergentes | Gravação atômica, validação de imagem, versão/ETag e prévia recuperável |
| Editor | Código/peso não preservados; campos estreitos; vínculos invisíveis | Editor amplo, rodapé fixo, campos persistidos; consulta de produto/grupo/opção/promoção vinculados |
| Login de cliente | Unicidade global e limite incompatível com constraint | Desafios isolados e cinco tentativas persistidas; e-mail ausente não retorna sucesso falso |
| Operação | Caixa, mesas e entregadores apenas locais | API autenticada e persistente; caixa considera numerário real e protege fechamento concorrente |
| Marketing/documentos | Cadastros locais divergentes | Cupons e documentos internos no servidor; separação de emissão fiscal |
| Relatórios | Custo incompleto virava margem de 100%; período e rótulos divergentes | Pendência de custo explícita; período comum; saldo não chamado de lucro contábil |
| Configuração | Agenda textual/semanal divergente e integrações fictícias | Agenda canônica; status real e avisos de liberação |

Notas digitadas pelo cliente não permitem ignorar estoque. A identidade de teste é gerada no servidor. Pedidos de teste não geram baixa física nem receita real.

## Evidências de testes

- Suite final em PostgreSQL isolado: **95 aprovados, zero falhas, zero ignorados**. Arquivo `full-tests-v5.tap` no diretório de backup; cerca de sete segundos após restauração/migração.
- Banco vazio de migração/efeitos: `petisbar_review_full_20261022_v5`.
- Cópia restaurada: `petisbar_review_cloned_20261022_v5`.
- UI isolada: `/opt/petisbar/review-20261022`, loopback e base `petisbar_review_20261022`; sem pagamentos, IA ou envio de e-mails externos.
- Cobertura: autorização de todas as áreas de API, cadastros sintéticos, estoque insuficiente, conversão de unidades, foto/opções/vínculos, recebimento concorrente, pedido repetido concorrente, ficha alterada após reserva, conclusão/estorno, confirmação simulada de pagamento/taxa única, caixa, arquivos, obrigação sem transmissão e bloqueio do login.
- Combo do catálogo restaurado com variante de refrigerante: cotação e criação com valores iguais; teste sem efeitos reais.
- Horários de fechamento respeitados. A fixture abre janela relativa ao relógio; não se enfraqueceu a regra de produção.
- CI roda testes normais em PostgreSQL vazio. A suite que exige cópia do catálogo de produção roda separadamente; essa cobertura não é atribuída ao CI.

## Interface

As 16 abas principais foram abertas. Rechecadas subabas de catálogo (três), marketing (quatro), relatórios (quatro), configuração (sete) e contábil/fiscal (quatro).

Criado produto sintético pela interface com foto, código, peso e opção. Após recarregar/reabrir, campos persistidos e foto com largura natural de 800 pixels. Caixa e cadastro de mesa também exercitados pela interface. Sem erros JavaScript nas últimas navegações verificadas.

Abertura de abas não prova execução visual de absolutamente todas as ações. Impressão física, câmera móvel, entrega de e-mail e jornadas externas não foram comprovadas. Testes de escrita ficaram isolados.

## Pagamentos

Não se fez pagamento real. A homologação de status usa respostas simuladas e valida referência, valor e efeitos. Taxa retornada pelo provedor é registrada sem duplicação; falta homologar a disponibilidade da taxa efetiva e do líquido da modalidade contratada. Taxa ausente não comprova custo zero.

Referências oficiais consultadas:

- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/transaction-status
- https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/get-order/get
- https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/get-payment/get

## Publicação e rollback

Registrar SHA, migração, serviço, health, logs, autorização e interface efetiva. CI verde não substitui isso. Antes da troca de checkout, preservar runtime modificado em snapshot recuperável. Em falha, voltar ao snapshot exato e reiniciar; não restaurar banco indiscriminadamente sobre novas movimentações.

Harness e túnel são temporários. Bases de homologação e backups protegidos não são segunda produção.

## Bloqueios da divulgação comercial

1. Estoque físico verdadeiro, fichas/unidades/embalagens e preços aprovados antes de desativar o modo sem estoque. Não inventar saldos.
2. Recebimento em produção e taxa efetiva por venda homologados. Sandbox não recebe dinheiro real; não trocar credenciais/modo silenciosamente.
3. Entrega do e-mail de autenticação e jornada do cliente comprovadas, não apenas configuração do servidor.
4. Área/taxas de entrega, contato, horário, política de dados e HTTPS do link final aprovados.
5. Backup externo automático, retenção e recuperação operacional comprovados. O dump desta revisão foi restaurado com sucesso, mas não prova cópia externa automática.
6. Fidelidade sem concessão/resgate homologados, mantida inativa; iFood ainda não sincroniza catálogo; 99 não implementado.
7. Impressora automática e envio de WhatsApp não integrados; impressão pelo navegador/links não equivalem a esses serviços.
8. Operação assistida real do restaurante, autorizada por pessoa. Financeiro gerencial não substitui contabilidade/apuração fiscal.

Não há promessa de ausência absoluta de erros. O aceite comercial exige evidência nos fluxos externos e nas condições reais acima.
