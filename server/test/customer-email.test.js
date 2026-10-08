import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://test:test@localhost/test';
process.env.APP_ORIGIN ||= 'http://localhost:3000';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-with-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const { sendCustomerLoginCode } = await import('../src/services/customer-email.js');

test('não tenta enviar quando o provedor não está configurado', async () => {
  const result = await sendCustomerLoginCode({ email: 'cliente@example.com', code: '123456' });
  assert.deepEqual(result, { sent: false, reason: 'email_provider_not_configured' });
});

test('envia o código sem registrar o conteúdo em logs', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, status: 200 };
  };
  try {
    const result = await sendCustomerLoginCode({ email: 'cliente@example.com', code: '123456' });
    assert.deepEqual(result, { sent: true });
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.body.to[0], 'cliente@example.com');
    assert.match(request.body.text, /123456/);
    assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('converte falha do provedor em erro controlável', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try {
    await assert.rejects(() => sendCustomerLoginCode({ email: 'cliente@example.com', code: '123456' }), /email_provider_error_429/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
