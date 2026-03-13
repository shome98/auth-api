import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

// 👻 Guests Table  (pre-login sessions for carts, prefs, etc.)

export const guests = pgTable('guests', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  /** Flexible JSON store — cart items, preferences, etc. */
  data: jsonb('data').default({}).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
