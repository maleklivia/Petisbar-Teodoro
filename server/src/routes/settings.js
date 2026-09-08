import { requirePermission } from '../middleware/auth.js';

export default async function settingsRoutes(app) {
  app.get('/settings', { preHandler: requirePermission('settings.manage') }, async () => {
    const result = await app.db.query('SELECT key, value FROM app_settings ORDER BY key');
    return { data: Object.fromEntries(result.rows.map(row => [row.key, row.value])) };
  });

  app.put('/settings', { preHandler: requirePermission('settings.manage') }, async (request, reply) => {
    const settings = request.body && typeof request.body === 'object' ? request.body : null;
    if (!settings || Array.isArray(settings)) return reply.code(400).send({ error: 'validation_error' });
    await app.db.query('BEGIN');
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) { await app.db.query('ROLLBACK'); return reply.code(400).send({ error: 'invalid_key' }); }
        await app.db.query(`INSERT INTO app_settings(key,value) VALUES($1,$2::jsonb)
          ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [key, JSON.stringify(value)]);
      }
      await app.db.query('COMMIT');
      return { data: settings };
    } catch (error) { await app.db.query('ROLLBACK'); throw error; }
  });
}
