import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// TLS seçimi: Varsayılan olarak SSL kapalı (Railway internal bağlantı için). SSL gerekliyse DB_SSL=true verilebilir.
const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
const dbSslEnv = (process.env.DB_SSL || 'false').toLowerCase();
const sslEnabled = dbSslEnv === 'true' && sslMode !== 'disable';
const sslConfig = sslEnabled
  ? { rejectUnauthorized: false }
  : false; // No TLS

// SSL açıksa self-signed hatalarını önlemek için sertifika doğrulamayı kapatıyoruz.
if (sslEnabled) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslMode === 'disable' ? false : sslConfig,
});

export const db = drizzle(pool, { schema });
export { pool };
