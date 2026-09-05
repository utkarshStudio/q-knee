import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface DatabaseStatus {
  mode: 'postgresql';
  connected: boolean;
}

const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();
const hasDatabaseUrl = rawDatabaseUrl.length > 0;

if (!hasDatabaseUrl) {
  console.error('CRITICAL: DATABASE_URL is not set. PostgreSQL is required for Q-Knee to function.');
}

export const realPool = new Pool({
  connectionString: rawDatabaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

realPool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (!hasDatabaseUrl) {
    return { mode: 'postgresql', connected: false };
  }
  try {
    const client = await Promise.race([
      realPool.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PostgreSQL connection timeout')), 2500))
    ]);
    try {
      await client.query('SELECT 1');
      client.release();
      return { mode: 'postgresql', connected: true };
    } catch {
      client.release();
      return { mode: 'postgresql', connected: false };
    }
  } catch (_err) {
    return { mode: 'postgresql', connected: false };
  }
}

export const pool = {
  async query(text: string, params: any[] = []): Promise<QueryResult<any>> {
    if (!hasDatabaseUrl) {
      throw new Error('Database is not configured. Real PostgreSQL connection required.');
    }
    return await realPool.query(text, params);
  },

  async connect(): Promise<any> {
    if (!hasDatabaseUrl) {
      throw new Error('Database is not configured. Real PostgreSQL connection required.');
    }
    return await realPool.connect();
  },

  on: (event: any, listener: (...args: any[]) => void) => {
    realPool.on(event, listener);
  }
};
