import { relations } from 'drizzle-orm';

// ─── Table re-exports ───────────────────────────────────────
export { users, roleEnum } from './users';
export { sessions } from './sessions';
export { guests } from './guests';
export { oauthAccounts } from './oauth-accounts';
export { verificationTokens } from './verification-tokens';
export { passwordResetTokens } from './password-reset-tokens';
export { loginActivity } from './login-activity';

// ─── Import tables for relations ────────────────────────────
import { users } from './users';
import { sessions } from './sessions';
import { oauthAccounts } from './oauth-accounts';
import { verificationTokens } from './verification-tokens';
import { passwordResetTokens } from './password-reset-tokens';
import { loginActivity } from './login-activity';

// 🔗 Drizzle Relations  (needed for `db.query` with joins)

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  oauthAccounts: many(oauthAccounts),
  verificationTokens: many(verificationTokens),
  passwordResetTokens: many(passwordResetTokens),
  loginActivity: many(loginActivity),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

export const verificationTokensRelations = relations(
  verificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [verificationTokens.userId],
      references: [users.id],
    }),
  }),
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const loginActivityRelations = relations(loginActivity, ({ one }) => ({
  user: one(users, {
    fields: [loginActivity.userId],
    references: [users.id],
  }),
}));
