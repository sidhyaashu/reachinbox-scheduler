import pkg from 'pg';
const { Pool } = pkg;
import type { Pool as PgPool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let globalPool: PgPool | null = null;

export interface DatabaseConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export function createPool(config?: DatabaseConfig): PgPool {
  if (globalPool) {
    return globalPool;
  }

  globalPool = new Pool({
    host: config?.host || process.env.PGHOST || 'localhost',
    port: config?.port || (process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432),
    user: config?.user || process.env.PGUSER || 'postgres',
    password: config?.password || process.env.PGPASSWORD || 'postgres',
    database: config?.database || process.env.PGDATABASE || 'reachinbox',
    max: config?.max || (process.env.PGMAX ? parseInt(process.env.PGMAX, 10) : 20),
    idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 5000,
    ssl: config?.ssl ?? (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  });

  globalPool.on('error', (err: Error) => {
    console.error('[PostgreSQL] Unexpected error on idle client:', err);
  });

  return globalPool;
}

export function getPool(): PgPool {
  if (!globalPool) {
    return createPool();
  }
  return globalPool;
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const pool = getPool();
  return pool.query<R>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
}
