import { pgTable, serial, text, timestamp, varchar, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  serviceType: varchar('service_type', { length: 100 }).notNull(),
  zipCode: varchar('zip_code', { length: 10 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  answers: jsonb('answers').$type<Record<string, string | string[] | null>>(),
  photoUrls: jsonb('photo_urls').$type<string[]>(),
  status: varchar('status', { length: 50 }).notNull().default('new'),
  notes: text('notes'),
  ipAddress: varchar('ip_address', { length: 45 }),
  country: varchar('country', { length: 100 }),
  countryCode: varchar('country_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  region: varchar('region', { length: 100 }),
  timezone: varchar('timezone', { length: 100 }),
  userAgent: text('user_agent'),
  browser: varchar('browser', { length: 100 }),
  browserVersion: varchar('browser_version', { length: 50 }),
  os: varchar('os', { length: 100 }),
  osVersion: varchar('os_version', { length: 50 }),
  device: varchar('device', { length: 100 }),
  deviceType: varchar('device_type', { length: 50 }),
  referrer: text('referrer'),
  utmSource: varchar('utm_source', { length: 255 }),
  utmMedium: varchar('utm_medium', { length: 255 }),
  utmCampaign: varchar('utm_campaign', { length: 255 }),
  sessionDuration: integer('session_duration'),
  pageViews: integer('page_views'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('admin'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
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
  details: jsonb('details').$type<Record<string, unknown>>(),
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

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type SubmissionNote = typeof submissionNotes.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
