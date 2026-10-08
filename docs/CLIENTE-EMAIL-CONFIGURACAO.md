# Configuração do e-mail de clientes

O login do cliente usa um código temporário de seis dígitos. O código é salvo no banco somente como hash e expira em dez minutos.

Configure somente no ambiente do servidor, nunca no GitHub:

```text
RESEND_API_KEY=<chave do projeto Resend>
MAIL_FROM=petisbarteodoro@gmail.com
```

Sem `RESEND_API_KEY`, o sistema permanece em modo de teste e não envia mensagens. Com a chave configurada, a API envia o código por e-mail.

Procedimento: criar/verificar o remetente; gerar uma chave restrita ao envio; configurar a chave na VPS sem commit; testar o recebimento; revogar a chave se for exposta.
