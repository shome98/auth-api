import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

// 👤 Users Table

export const roleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  passwordHash: text('password_hash'),
  role: roleEnum('role').default('user').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  isBlocked: boolean('is_blocked').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserRole = 'user' | 'admin';
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
