import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.admin_devices (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
      fingerprint VARCHAR(255) NOT NULL,
      device_name VARCHAR(255) NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (admin_id, fingerprint)
    );
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`DROP TABLE IF EXISTS public.admin_devices;`);
};
