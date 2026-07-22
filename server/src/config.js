import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().min(1),
  APP_ORIGIN: z.string().url(),
  COOKIE_SECRET: z.string().min(32),
  SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  DEFAULT_DELIVERY_FEE: z.coerce.number().nonnegative().default(0),
  IFOOD_ENABLED: z.string().default('false').transform(value => value === 'true'),
  IFOOD_CLIENT_ID: z.string().default(''),
  IFOOD_CLIENT_SECRET: z.string().default(''),
  IFOOD_MERCHANT_ID: z.string().default(''),
  IFOOD_POLL_SECONDS: z.coerce.number().int().min(15).max(300).default(30),
  IFOOD_TOTAL_FEE_PERCENT: z.coerce.number().min(0).max(99).default(26.2),
}).superRefine((value, context) => {
  if (value.IFOOD_ENABLED && (!value.IFOOD_CLIENT_ID || !value.IFOOD_CLIENT_SECRET || !value.IFOOD_MERCHANT_ID)) {
    context.addIssue({ code: 'custom', message: 'Credenciais do iFood são obrigatórias quando IFOOD_ENABLED=true' });
  }
});

export const config = schema.parse(process.env);
export const isProduction = config.NODE_ENV === 'production';
