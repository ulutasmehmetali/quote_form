import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS partner_workflows (
      partner_api_id BIGINT PRIMARY KEY REFERENCES partner_apis(id) ON DELETE CASCADE,
      workflow_id UUID UNIQUE REFERENCES automation_workflows(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`DROP TABLE IF EXISTS partner_workflows;`);
};
