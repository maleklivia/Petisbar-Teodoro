import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { config, isProduction } from '../config.js';

// Mantém compatibilidade com versões do middleware de autenticação que importam
// isProduction deste módulo.
export { isProduction };

export const SESSION_COOKIE = 'petisbar_session';
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const createToken = () => randomBytes(32).toString('base64url');

export const cookieOptions = {
  path: '/',
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  signed: true,
  maxAge: config.SESSION_HOURS * 60 * 60,
};

export async function authenticate(request, reply) {
  const signed = request.unsignCookie(request.cookies[SESSION_COOKIE] || '');
  if (!signed.valid || !signed.value) {
    return reply.code(401).send({ error: 'authentication_required' });
  }

  const result = await db.query(`
    SELECT u.id, u.name, u.email, u.active, r.name AS role,
      COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true
    GROUP BY u.id, r.name
  `, [hashToken(signed.value)]);

  if (!result.rowCount) {
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return reply.code(401).send({ error: 'session_expired' });
  }
  request.user = result.rows[0];
}

export function requirePermission(code) {
  return async function permissionGuard(request, reply) {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!request.user.permissions.includes(code)) {
      return reply.code(403).send({ error: 'permission_denied', permission: code });
    }
  };
}
