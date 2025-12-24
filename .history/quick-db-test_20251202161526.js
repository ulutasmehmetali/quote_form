import { Pool } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT 1 as ok');
    console.log('DB test result:', res.rows);
  } catch (err) {
    console.error('DB test failed:', err);
  } finally {
    try {
      if (client) client.release();
    } catch (e) {}
    if (pool.end) await pool.end();
  }
}

test();
