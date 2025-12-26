import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// Vercel/Railway behind TLS: allow self-signed certs by default to avoid chain errors.
const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
const sslConfig =
  sslMode === 'disable'
    ? false
    : {
        rejectUnauthorized: false,
      };

// Explicitly relax TLS for downstream drivers too (matches ssl.rejectUnauthorized:false)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

export const db = drizzle(pool, { schema });
export { pool };
