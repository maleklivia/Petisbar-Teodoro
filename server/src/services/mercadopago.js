import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const baseUrl = 'https://api.mercadopago.com';
const money = value => Number(Number(value).toFixed(2));

async function accessToken() {
  return (await fs.readFile(config.MERCADOPAGO_ACCESS_TOKEN_FILE, 'utf8')).trim();
}

export async function createPixOrder({ orderId, amount, email }) {
  if (!config.MERCADOPAGO_ENABLED) return { error: 'mercadopago_disabled' };
  const total = money(amount);
  const response = await fetch(`${baseUrl}/v1/orders`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${await accessToken()}`,
      'x-idempotency-key': `petisbar-${orderId}`,
    },
    body: JSON.stringify({
      type: 'online', total_amount: total.toFixed(2), external_reference: orderId,
      processing_mode: 'automatic',
      transactions: { payments: [{ amount: total.toFixed(2), payment_method: { id: 'pix', type: 'bank_transfer' } }] },
      payer: { email },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { error: 'provider_error', status: response.status, payload };
  const payment = payload.transactions?.payments?.[0] || {};
  const method = payment.payment_method || {};
  return {
    id: `pay-${randomUUID()}`, providerOrderId: payload.id, providerPaymentId: payment.id,
    status: payment.status || payload.status || 'action_required', statusDetail: payment.status_detail || payload.status_detail || '',
    grossAmount: total, feeAmount: money(payment.fee_amount || payload.fee_amount || 0),
    netAmount: money(payment.net_amount || total - Number(payment.fee_amount || payload.fee_amount || 0)),
    qrCode: method.qr_code || '', qrCodeBase64: method.qr_code_base64 || '', ticketUrl: method.ticket_url || '', payload,
  };
}

export async function getOrder(providerOrderId) {
  if (!config.MERCADOPAGO_ENABLED) return { error: 'mercadopago_disabled' };
  const response = await fetch(`${baseUrl}/v1/orders/${encodeURIComponent(providerOrderId)}`, { headers: { accept: 'application/json', authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { error: 'provider_error', status: response.status, payload };
  const payment = payload.transactions?.payments?.[0] || {};
  const fee=payment.fee_amount??payload.fee_amount;
  return { status: payment.status || payload.status || '', statusDetail: payment.status_detail || payload.status_detail || '', feeAmount: fee===undefined?null:money(fee), payload };
}
