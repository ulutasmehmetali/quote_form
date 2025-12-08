import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.partial_forms (
      id SERIAL PRIMARY KEY,
      draft_id VARCHAR(80) NOT NULL UNIQUE,
      service_type TEXT,
      zip_code TEXT,
      email TEXT,
      phone TEXT,
      responses JSONB DEFAULT '{}'::jsonb,
      progress INTEGER DEFAULT 0,
      current_step INTEGER,
      meta JSONB DEFAULT '{}'::jsonb,
      last_saved_at TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_partial_forms_draft_id ON public.partial_forms(draft_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_partial_forms_last_saved_at ON public.partial_forms(last_saved_at);
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`DROP INDEX IF EXISTS idx_partial_forms_last_saved_at;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_partial_forms_draft_id;`);
  await db.execute(sql`DROP TABLE IF EXISTS public.partial_forms;`);
};
