import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { db } from './db.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import healthRoutes from './routes/health.js';
import migrationRoutes from './routes/migration.js';
import publicOrderRoutes from './routes/public-orders.js';
import userRoutes from './routes/users.js';

export async function buildApp() {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] }, trustProxy: true });
  app.decorate('db', db);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie, { secret: config.COOKIE_SECRET, hook: 'onRequest' });
  await app.register(cors, { origin: config.APP_ORIGIN, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE'] });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.addHook('onRequest', async (request, reply) => {
    if (['POST','PUT','PATCH','DELETE'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && origin !== config.APP_ORIGIN) return reply.code(403).send({ error: 'invalid_origin' });
    }
  });

  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(catalogRoutes, { prefix: '/api/v1' });
  await app.register(migrationRoutes, { prefix: '/api/v1' });
  await app.register(publicOrderRoutes, { prefix: '/api/v1' });
  await app.register(userRoutes, { prefix: '/api/v1' });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    reply.code(status).send({ error: status === 500 ? 'internal_error' : error.code || 'request_error' });
  });
  return app;
}
