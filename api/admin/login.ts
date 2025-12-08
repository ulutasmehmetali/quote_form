import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const pool = new Pool({
  host: "aws-1-us-west-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.etfgyljunsvrnabhuhqx",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Admin user lookup
    const result = await pool.query(
      `SELECT id, username, password_hash, role 
       FROM admin_users 
       WHERE username = $1 
       LIMIT 1`,
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid username' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Wrong password' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      }
    });

  } catch (err: any) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
