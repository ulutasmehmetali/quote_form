import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.admin_ip_blacklist (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL UNIQUE,
      reason TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`
    DROP TABLE IF EXISTS public.admin_ip_blacklist;
  `);
};
