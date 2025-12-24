import { sql } from 'drizzle-orm';

const columns = [
  { name: 'user_agent', definition: 'TEXT' },
  { name: 'browser', definition: 'TEXT' },
  { name: 'device_type', definition: 'TEXT' },
  { name: 'device_brand', definition: 'TEXT' },
  { name: 'device_model', definition: 'TEXT' },
  { name: 'country', definition: 'TEXT' },
  { name: 'city', definition: 'TEXT' },
  { name: 'path', definition: 'TEXT' },
  { name: 'method', definition: 'TEXT' },
  { name: 'referer', definition: 'TEXT' },
  { name: 'status_code', definition: 'INTEGER' },
  { name: 'latency_ms', definition: 'INTEGER' },
  { name: 'meta', definition: "JSONB DEFAULT '{}'::jsonb" },
  { name: 'entered_at', definition: 'TIMESTAMPTZ NOT NULL DEFAULT now()' },
  { name: 'left_at', definition: 'TIMESTAMPTZ' },
  { name: 'created_at', definition: 'TIMESTAMPTZ NOT NULL DEFAULT now()' },
  { name: 'updated_at', definition: 'TIMESTAMPTZ NOT NULL DEFAULT now()' },
];

export const up = async (db: any) => {
  for (const column of columns) {
    await db.execute(sql`
      ALTER TABLE public.access_logs
      ADD COLUMN IF NOT EXISTS ${sql.identifier(['public', 'access_logs', column.name])} ${sql.raw(column.definition)};
    `);
  }
};

export const down = async (db: any) => {
  for (const column of [...columns].reverse()) {
    await db.execute(sql`
      ALTER TABLE public.access_logs
      DROP COLUMN IF EXISTS ${sql.identifier(['public', 'access_logs', column.name])};
    `);
  }
};
