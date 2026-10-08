import { createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import { hashToken } from '../middleware/auth.js';
import { authenticateCustomer, CUSTOMER_SESSION_COOKIE, customerCookieOptions, newCustomerSession, optionalCustomerAuthenticate } from '../middleware/customer-auth.js';

const emailSchema = z.string().trim().email().max(200).transform(value => value.toLowerCase());
const requestSchema = z.object({ email: emailSchema, name: z.string().trim().min(2).max(120).optional(), phone: z.string().trim().max(24).optional() });
const verifySchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) });
const codeHash = code => createHash('sha256').update(code).digest('hex');

export default async function customerAuthRoutes(app) {
  app.post('/customer/auth/request-login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_login_request' });
    const { email, name = '', phone = '' } = parsed.data;
    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const account = await client.query(`
        INSERT INTO customer_accounts (email,email_normalized,display_name,phone)
        VALUES ($1,$1,$2,$3)
        ON CONFLICT (email_normalized) DO UPDATE SET display_name=CASE WHEN customer_accounts.display_name='' THEN EXCLUDED.display_name ELSE customer_accounts.display_name END, phone=CASE WHEN customer_accounts.phone='' THEN EXCLUDED.phone ELSE customer_accounts.phone END, updated_at=now()
        RETURNING id
      `, [email, name, phone]);
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      await client.query(`UPDATE customer_login_challenges SET consumed_at=now() WHERE customer_account_id=$1 AND consumed_at IS NULL`, [account.rows[0].id]);
      await client.query(`INSERT INTO customer_login_challenges (customer_account_id,code_hash,expires_at) VALUES ($1,$2,now()+interval '10 minutes')`, [account.rows[0].id, codeHash(code)]);
      await client.query('COMMIT');
      // A transportador de e-mail será ligado na próxima etapa de infraestrutura.
      request.log.info({ event: 'customer_login_requested' }, 'login de cliente solicitado');
      return { ok: true };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  app.post('/customer/auth/verify', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_login_code' });
    const { email, code } = parsed.data;
    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const account = await client.query('SELECT * FROM customer_accounts WHERE email_normalized=$1 AND active=true FOR UPDATE', [email]);
      const challenge = account.rowCount ? await client.query(`SELECT * FROM customer_login_challenges WHERE customer_account_id=$1 AND consumed_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [account.rows[0].id]) : { rowCount: 0 };
      if (!account.rowCount || !challenge.rowCount || challenge.rows[0].attempts >= 5 || hashToken(code) !== challenge.rows[0].code_hash) {
        if (challenge.rowCount) await client.query('UPDATE customer_login_challenges SET attempts=attempts+1 WHERE id=$1', [challenge.rows[0].id]);
        await client.query('ROLLBACK');
        return reply.code(401).send({ error: 'invalid_login_code' });
      }
      await client.query('UPDATE customer_login_challenges SET consumed_at=now() WHERE id=$1', [challenge.rows[0].id]);
      const token = newCustomerSession();
      await client.query(`INSERT INTO customer_sessions (customer_account_id,token_hash,expires_at,ip,user_agent) VALUES ($1,$2,now()+interval '30 days',$3,$4)`, [account.rows[0].id, hashToken(token), request.ip, request.headers['user-agent'] || '']);
      await client.query('UPDATE customer_accounts SET email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id=$1', [account.rows[0].id]);
      await client.query('COMMIT');
      reply.setCookie(CUSTOMER_SESSION_COOKIE, token, customerCookieOptions);
      return { customer: { id: account.rows[0].id, email: account.rows[0].email, name: account.rows[0].display_name } };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  app.get('/customer/auth/me', { preHandler: authenticateCustomer }, async request => ({ customer: request.customer }));
  app.post('/customer/auth/logout', { preHandler: authenticateCustomer }, async (request, reply) => {
    const signed = request.unsignCookie(request.cookies[CUSTOMER_SESSION_COOKIE] || '');
    if (signed.valid) await app.db.query('UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=$1', [hashToken(signed.value)]);
    reply.clearCookie(CUSTOMER_SESSION_COOKIE, customerCookieOptions);
    return { ok: true };
  });
  app.post('/customer/auth/revoke-all', { preHandler: authenticateCustomer }, async (request, reply) => {
    await app.db.query('UPDATE customer_sessions SET revoked_at=now() WHERE customer_account_id=$1 AND revoked_at IS NULL', [request.customer.id]);
    reply.clearCookie(CUSTOMER_SESSION_COOKIE, customerCookieOptions);
    return { ok: true };
  });
}
