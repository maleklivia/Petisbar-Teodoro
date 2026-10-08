import { config } from '../config.js';

export async function sendCustomerLoginCode({ email, code }) {
  if (!config.RESEND_API_KEY) return { sent: false, reason: 'email_provider_not_configured' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Petisbar Teodoro <${config.MAIL_FROM}>`,
      to: [email],
      subject: 'Seu código de acesso ao Petisbar',
      text: `Seu código de acesso é ${code}. Ele expira em 10 minutos. Se você não solicitou este código, ignore esta mensagem.`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`email_provider_error_${response.status}`);
  return { sent: true };
}
