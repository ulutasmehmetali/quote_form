import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.incomplete_forms (
      id SERIAL PRIMARY KEY,
      draft_id VARCHAR(80) NOT NULL UNIQUE,
      created_by TEXT,
      service_type TEXT,
      email TEXT,
      phone TEXT,
      responses JSONB DEFAULT '{}'::jsonb,
      progress INTEGER DEFAULT 0,
      meta JSONB DEFAULT '{}'::jsonb,
      user_agent TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ DEFAULT now(),
      last_seen_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_incomplete_forms_draft_id ON public.incomplete_forms(draft_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_incomplete_forms_created_at ON public.incomplete_forms(created_at);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_incomplete_forms_last_seen_at ON public.incomplete_forms(last_seen_at);
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`DROP INDEX IF EXISTS idx_incomplete_forms_last_seen_at;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_incomplete_forms_created_at;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_incomplete_forms_draft_id;`);
  await db.execute(sql`DROP TABLE IF EXISTS public.incomplete_forms;`);
};
