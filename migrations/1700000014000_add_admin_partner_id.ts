import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  await db.execute(sql`
    ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS partner_api_id BIGINT
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'admin_users_partner_api_fk'
      ) THEN
        ALTER TABLE admin_users
        ADD CONSTRAINT admin_users_partner_api_fk
        FOREIGN KEY (partner_api_id)
        REFERENCES partner_apis(id)
        ON DELETE SET NULL;
      END IF;
    END;
    $$;
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`
    ALTER TABLE admin_users
    DROP CONSTRAINT IF EXISTS admin_users_partner_api_fk;
  `);

  await db.execute(sql`
    ALTER TABLE admin_users
    DROP COLUMN IF EXISTS partner_api_id;
  `);
};
