import { hashToken, createToken, isProduction } from './auth.js';

export const CUSTOMER_SESSION_COOKIE = 'petisbar_customer_session';
export const customerCookieOptions = {
  path: '/', httpOnly: true, secure: isProduction, sameSite: 'lax', signed: true,
  maxAge: 30 * 24 * 60 * 60,
};

export async function optionalCustomerAuthenticate(request) {
  const signed = request.unsignCookie(request.cookies[CUSTOMER_SESSION_COOKIE] || '');
  if (!signed.valid || !signed.value) return null;
  const result = await request.server.db.query(`
    SELECT ca.id, ca.email, ca.display_name, ca.phone, ca.client_id
    FROM customer_sessions cs
    JOIN customer_accounts ca ON ca.id=cs.customer_account_id
    WHERE cs.token_hash=$1 AND cs.expires_at>now() AND cs.revoked_at IS NULL AND ca.active=true
  `, [hashToken(signed.value)]);
  if (!result.rowCount) return null;
  request.customer = result.rows[0];
  return result.rows[0];
}

export async function authenticateCustomer(request, reply) {
  const customer = await optionalCustomerAuthenticate(request);
  if (!customer) return reply.code(401).send({ error: 'customer_authentication_required' });
  request.customer = customer;
}

export function newCustomerSession() {
  return createToken();
}
