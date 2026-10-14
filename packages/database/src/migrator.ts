import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withTransaction, query } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ensureMigrationTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getAppliedMigrations(): Promise<string[]> {
  await ensureMigrationTable();
  const res = await query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY id ASC');
  return res.rows.map((r) => r.name);
}

export async function migrateUp(migrationsDir?: string): Promise<string[]> {
  const dir = migrationsDir || path.resolve(__dirname, '../migrations');
  if (!fs.existsSync(dir)) {
    throw new Error(`[Migrator] Migrations directory not found at: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = await getAppliedMigrations();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.includes(file)) {
      continue;
    }

    const filePath = path.join(dir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`[Migrator] Applying migration: ${file}...`);
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });

    newlyApplied.push(file);
    console.log(`[Migrator] Successfully applied: ${file}`);
  }

  return newlyApplied;
}
