import { config } from '../config.js';
import tls from 'node:tls';
import net from 'node:net';

function smtpCommand(socket, command, expected = /^2/) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\r\n');
      const last = lines[lines.length - 2] || '';
      if (!/^\d{3} /.test(last)) return;
      socket.off('data', onData);
      const code = Number(last.slice(0, 3));
      if (!expected.test(String(code))) reject(new Error(`smtp_error_${code}`)); else resolve();
    };
    socket.on('data', onData);
    socket.once('error', reject);
    socket.write(`${command}\r\n`);
  });
}

async function sendViaGmail({ email, subject, text, host, port, user, password, from }) {
  if (Number(port) === 587) return sendViaGmailStartTls({ email, subject, text, host, user, password, from });
  const socket = tls.connect({ host, port, servername: host });
  await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
  await new Promise((resolve, reject) => { const onData = chunk => { const text = chunk.toString(); if (/^220[ -]/m.test(text)) { socket.off('data', onData); resolve(); } }; socket.on('data', onData); socket.once('error', reject); });
  await smtpCommand(socket, 'EHLO petisbarteodoro.local', /^2/);
  await smtpCommand(socket, 'AUTH LOGIN', /^3/);
  await smtpCommand(socket, Buffer.from(user).toString('base64'), /^3/);
  await smtpCommand(socket, Buffer.from(password).toString('base64'), /^2/);
  await smtpCommand(socket, `MAIL FROM:<${from}>`, /^2/);
  await smtpCommand(socket, `RCPT TO:<${email}>`, /^2/);
  await smtpCommand(socket, 'DATA', /^3/);
  await smtpCommand(socket, `From: Petisbar Teodoro <${from}>\r\nTo: ${email}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n.`, /^2/);
  await smtpCommand(socket, 'QUIT', /^2/).catch(() => {});
  socket.end();
}

async function sendViaGmailStartTls({ email, subject, text, host, user, password, from }) {
  const plain = net.connect({ host, port: 587 });
  await new Promise((resolve, reject) => { plain.once('connect', resolve); plain.once('error', reject); });
  await smtpCommand(plain, '', /^2/);
  await smtpCommand(plain, 'EHLO petisbarteodoro.local', /^2/);
  await smtpCommand(plain, 'STARTTLS', /^2/);
  const socket = tls.connect({ socket: plain, servername: host });
  await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
  await smtpCommand(socket, 'EHLO petisbarteodoro.local', /^2/);
  await smtpCommand(socket, 'AUTH LOGIN', /^3/);
  await smtpCommand(socket, Buffer.from(user).toString('base64'), /^3/);
  await smtpCommand(socket, Buffer.from(password).toString('base64'), /^2/);
  await smtpCommand(socket, `MAIL FROM:<${from}>`, /^2/);
  await smtpCommand(socket, `RCPT TO:<${email}>`, /^2/);
  await smtpCommand(socket, 'DATA', /^3/);
  await smtpCommand(socket, `From: Petisbar Teodoro <${from}>\r\nTo: ${email}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n.`, /^2/);
  await smtpCommand(socket, 'QUIT', /^2/).catch(() => {});
  socket.end();
}

export async function sendCustomerEmail({ email, subject, text }) {
  const user = process.env.MAIL_USER || config.MAIL_USER;
  const password = process.env.MAIL_PASSWORD || config.MAIL_PASSWORD;
  if (!user || !password) return { sent: false, reason: 'email_provider_not_configured' };
  await sendViaGmail({ email, subject, text, host: process.env.MAIL_HOST || config.MAIL_HOST, port: Number(process.env.MAIL_PORT || config.MAIL_PORT), user, password, from: process.env.MAIL_FROM || config.MAIL_FROM });
  return { sent: true, provider: 'gmail' };
}

export async function sendCustomerLoginCode({ email, code }) {
  const apiKey = process.env.RESEND_API_KEY || config.RESEND_API_KEY;
  const mailUser = process.env.MAIL_USER || config.MAIL_USER;
  const mailPassword = process.env.MAIL_PASSWORD || config.MAIL_PASSWORD;
  if (mailUser && mailPassword) {
    await sendViaGmail({ email, subject: 'Seu código de acesso ao Petisbar', text: `Seu código de acesso é ${code}. Ele expira em 10 minutos. Se você não solicitou este código, ignore esta mensagem.`, host: process.env.MAIL_HOST || config.MAIL_HOST, port: Number(process.env.MAIL_PORT || config.MAIL_PORT), user: mailUser, password: mailPassword, from: process.env.MAIL_FROM || config.MAIL_FROM });
    return { sent: true, provider: 'gmail' };
  }
  const from = process.env.MAIL_FROM || config.MAIL_FROM;
  if (!apiKey) return { sent: false, reason: 'email_provider_not_configured' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Petisbar Teodoro <${from}>`,
      to: [email],
      subject: 'Seu código de acesso ao Petisbar',
      text: `Seu código de acesso é ${code}. Ele expira em 10 minutos. Se você não solicitou este código, ignore esta mensagem.`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`email_provider_error_${response.status}`);
  return { sent: true };
}
