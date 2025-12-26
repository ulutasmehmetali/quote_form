import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const allowSelfSigned = process.env.ALLOW_SELF_SIGNED === 'true';
const sslMode = process.env.PGSSLMODE || '';
// If allowSelfSigned=true we also drop TLS verification to avoid SELF_SIGNED_CERT errors.
if (allowSelfSigned) {
  // eslint-disable-next-line no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const sslConfig =
  sslMode === 'disable'
    ? false
    : {
        rejectUnauthorized: !allowSelfSigned,
      };

// Railway / Supabase / standard Postgres friendly pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

export const db = drizzle(pool, { schema });
export { pool };
