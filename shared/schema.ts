import { pgTable, serial, text, timestamp, varchar, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
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
  partnerApiId: integer('partner_api_id'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  mfaSecret: text('mfa_secret'),
  mfaEnabled: boolean('mfa_enabled').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminDevices = pgTable('admin_devices', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull(),
  fingerprint: varchar('fingerprint', { length: 255 }).notNull(),
  deviceName: varchar('device_name', { length: 255 }).notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
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

export const partialForms = pgTable('partial_forms', {
  id: serial('id').primaryKey(),
  draftId: varchar('draft_id', { length: 80 }).notNull().unique(),
  serviceType: varchar('service_type', { length: 100 }),
  zipCode: varchar('zip_code', { length: 10 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 45 }),
  responses: jsonb('responses').default('{}'),
  progress: integer('progress').default(0),
  currentStep: integer('current_step'),
  meta: jsonb('meta').default('{}'),
  lastSavedAt: timestamp('last_saved_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const incompleteForms = pgTable('incomplete_forms', {
  id: serial('id').primaryKey(),
  draftId: varchar('draft_id', { length: 80 }).notNull().unique(),
  createdBy: varchar('created_by', { length: 255 }),
  serviceType: varchar('service_type', { length: 100 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 45 }),
  responses: jsonb('responses').default('{}'),
  progress: integer('progress').default(0),
  meta: jsonb('meta').default('{}'),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type SubmissionNote = typeof submissionNotes.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
