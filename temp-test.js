import { pool } from './server/db.js';
(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query('INSERT INTO activity_logs (action, entity_type, entity_id, admin_id, admin_username, details, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', ['test','admin',1,1,'admin',{},'127.0.0.1','UA']);
    console.log(res.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    if (pool.end) await pool.end();
  }
})();
