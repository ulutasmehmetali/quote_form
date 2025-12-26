import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// SSL kontrolü:
// - PGSSLMODE=disable ise SSL tamamen kapalı.
// - PGSSLMODE=require/prefer veya DB_SSL=true ise SSL açılır, self-signed sertifikalar kabul edilir.
const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
const dbSslEnv = (process.env.DB_SSL || '').toLowerCase();
const sslModeEnabled = sslMode && sslMode !== 'disable';
const dbSslEnabled = dbSslEnv === 'true';
const sslDisabledExplicit = sslMode === 'disable' || dbSslEnv === 'false';
const sslEnabled = (sslModeEnabled || dbSslEnabled) && !sslDisabledExplicit;

const sslConfig = sslEnabled ? { rejectUnauthorized: false } : false;

if (sslEnabled) {
  // Self-signed sertifika zinciri hatalarını baskılamak için doğrulamayı kapat.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

export const db = drizzle(pool, { schema });
export { pool };
