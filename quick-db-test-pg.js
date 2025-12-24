import pkg from 'pg';
const { Pool } = pkg;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT 1 as ok');
    console.log('pg DB test result:', res.rows);
  } catch (err) {
    console.error('pg DB test failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
})();
