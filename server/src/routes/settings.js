import { requirePermission } from '../middleware/auth.js';
import {config} from '../config.js';
import {weeklyHours,weeklyHoursText} from '../services/storefront-hours.js';

export default async function settingsRoutes(app) {
  app.get('/settings/integrations',{preHandler:requirePermission('settings.manage')},async()=>({data:{
    pix:config.MERCADOPAGO_ENABLED?(config.MERCADOPAGO_ENV==='sandbox'?'Sandbox — sem recebimento real':'Configurado — validar recebimento real'):'Não configurado',
    ifood:config.IFOOD_ENABLED?'Configurado — conferir sincronização':'Não configurado',
    whatsapp:'Envio automático não integrado',impressora:'Impressão pelo navegador; serviço automático não integrado',
    ocr:'Consulte a leitura de comprovantes em Compras',
    email:(config.RESEND_API_KEY||(config.MAIL_USER&&config.MAIL_PASSWORD))?'Configurado — validar entrega':'Não configurado',
  }}));
  app.get('/settings', { preHandler: requirePermission('settings.manage') }, async () => {
    const result = await app.db.query('SELECT key, value FROM app_settings ORDER BY key');
    const data=Object.fromEntries(result.rows.map(row=>[row.key,row.value]));
    if(!data.horario)data.horario=weeklyHoursText(data['storefront.hours']);
    return {data};
  });

  app.put('/settings', { preHandler: requirePermission('settings.manage') }, async (request, reply) => {
    const settings = request.body && typeof request.body === 'object' ? request.body : null;
    if (!settings || Array.isArray(settings)) return reply.code(400).send({ error: 'validation_error' });
    if(settings.horario!=null){
      if(!weeklyHours(settings.horario))return reply.code(400).send({error:'invalid_hours'});
      settings.horario=weeklyHoursText(settings.horario);
      settings['storefront.hours']=Object.entries(settings.horario).map(([day,time])=>`${day}: ${time}`).join(' · ');
    }else if(Object.hasOwn(settings,'storefront.hours')){
      if(!weeklyHours(settings['storefront.hours']))return reply.code(400).send({error:'invalid_hours'});
      settings.horario=weeklyHoursText(settings['storefront.hours']);
    }
    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      if (Object.hasOwn(settings, 'storefront.allowOrdersWithoutStockForTesting')) {
        // O modo de teste e os checkouts usam o mesmo lock para que a virada do estado não cruze uma gravação real.
        await client.query('SELECT pg_advisory_xact_lock(20261029,1)');
      }
      for (const [key, value] of Object.entries(settings)) {
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) { await client.query('ROLLBACK'); return reply.code(400).send({ error: 'invalid_key' }); }
        await client.query(`INSERT INTO app_settings(key,value) VALUES($1,$2::jsonb)
          ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [key, JSON.stringify(value)]);
      }
      await client.query('COMMIT');
      return { data: settings };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
}
