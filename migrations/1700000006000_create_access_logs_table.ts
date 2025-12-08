import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.access_logs (
      id UUID PRIMARY KEY,
      session_id UUID,
      user_ip INET,
      user_agent TEXT,
      path TEXT,
      method TEXT,
      referer TEXT,
      meta JSONB DEFAULT '{}'::jsonb,
      entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      left_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);

  await db.execute(sql`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.access_logs
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_access_logs_entered_at ON public.access_logs (entered_at);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_access_logs_user_ip ON public.access_logs (user_ip);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_access_logs_session_id ON public.access_logs (session_id);
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`DROP INDEX IF EXISTS idx_access_logs_session_id;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_access_logs_user_ip;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_access_logs_entered_at;`);
  await db.execute(sql`DROP TRIGGER IF EXISTS set_updated_at ON public.access_logs;`);
  await db.execute(sql`DROP TABLE IF EXISTS public.access_logs;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS public.trigger_set_updated_at();`);
};
