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
});

export const config = schema.parse(process.env);
export const isProduction = config.NODE_ENV === 'production';
