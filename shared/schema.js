import { pgTable, serial, text, timestamp, varchar, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  serviceType: varchar('service_type', { length: 100 }).notNull(),
  zipCode: varchar('zip_code', { length: 10 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  answers: jsonb('answers').default('{}'),
  photos: jsonb('photos').default('[]'),
  status: varchar('status', { length: 50 }).notNull().default('new'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  browser: varchar('browser', { length: 100 }),
  device: varchar('device', { length: 100 }),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('admin'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const submissionNotes = pgTable('submission_notes', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').notNull().references(() => submissions.id),
  note: text('note').notNull(),
  adminId: integer('admin_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id'),
  adminId: integer('admin_id'),
  adminUsername: varchar('admin_username', { length: 100 }),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const submissionsRelations = relations(submissions, ({ many }) => ({
  notes: many(submissionNotes),
}));

export const submissionNotesRelations = relations(submissionNotes, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionNotes.submissionId],
    references: [submissions.id],
  }),
}));
