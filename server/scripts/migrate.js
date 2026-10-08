import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { seedCoursePotatoRecipes } from '../src/domain/course-potato-recipes.js';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatório');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const migrationsDir = process.env.MIGRATIONS_DIR || join(dirname(fileURLToPath(import.meta.url)), '../../database/migrations');
await client.connect();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(migrationsDir)).filter(name => name.endsWith('.sql')).sort();
  for (const file of files) {
    const exists = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
    if (exists.rowCount) continue;
    await client.query(await readFile(join(migrationsDir, file), 'utf8'));
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    console.log(`Aplicada: ${file}`);
  }
  // Idempotent course import into a review workbench. Existing technical sheets,
  // product prices and stock are intentionally untouched.
  await client.query('BEGIN');
  try {
    await seedCoursePotatoRecipes(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
} finally {
  await client.end();
}
