import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const sslMode = process.env.PGSSLMODE || '';

// Default: accept self-signed certs to avoid SSL chain errors on managed DBs.
const sslConfig =
  sslMode === 'disable'
    ? false
    : {
        rejectUnauthorized: false,
      };

// Railway / Supabase / standard Postgres friendly pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

export const db = drizzle(pool, { schema });
export { pool };
