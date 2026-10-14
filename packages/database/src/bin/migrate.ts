import path from 'path';
import { fileURLToPath } from 'url';
import { migrateUp } from '../migrator.js';
import { closePool } from '../pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('[Migrator CLI] Starting database migrations...');
  try {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const applied = await migrateUp(migrationsDir);
    if (applied.length === 0) {
      console.log('[Migrator CLI] Database is already up to date.');
    } else {
      console.log(`[Migrator CLI] Applied ${applied.length} migration(s): ${applied.join(', ')}`);
    }
  } catch (error) {
    console.error('[Migrator CLI] Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
