/** Cookie names used across the application */
export const COOKIE_NAMES = {
  SESSION: "auth_session",
  GUEST: "guest_session",
} as const;

// ── JWT cookie names (access + refresh token flow) ───────
export const JWT_COOKIE_NAMES = {
  /** Short-lived JWT — verified locally on every request */
  ACCESS_TOKEN: "access_token",
  /** Long-lived opaque token — only sent to /api/auth/refresh */
  REFRESH_TOKEN: "refresh_token",
} as const;

/** Token expiry durations in milliseconds */
export const TOKEN_EXPIRY = {
  /** Email verification token — 24 hours */
  VERIFICATION: 24 * 60 * 60 * 1000,
  /** Password reset token — 1 hour */
  PASSWORD_RESET: 1 * 60 * 60 * 1000,
} as const;

/** User-facing response messages */
export const MSG = {
  // ── Auth ──────────────────────────────────────────────
  REGISTER_SUCCESS:
    "🎉 Account created successfully! Please check your email to verify.",
  LOGIN_SUCCESS: "✅ Logged in successfully! Welcome back.",
  LOGOUT_SUCCESS: "👋 Logged out successfully. See you next time!",
  EMAIL_VERIFIED: "✅ Email verified successfully!",
  VERIFICATION_SENT:
    "📧 Verification email sent. Please check your inbox.",
  PASSWORD_RESET_SENT:
    "📧 If an account with that email exists, a password reset link has been sent.",
  PASSWORD_RESET_SUCCESS:
    "🔑 Password reset successfully. Please log in with your new password.",

  // ── User ──────────────────────────────────────────────
  USER_FETCHED: "👤 User profile retrieved successfully.",
  PROFILE_UPDATED: "✏️ Profile updated successfully.",
  PASSWORD_CHANGED: "🔑 Password changed successfully.",
  ACCOUNT_DELETED:
    "🗑️ Account deleted successfully. We're sorry to see you go.",

  // ── Guest ─────────────────────────────────────────────
  GUEST_CREATED: "👻 Guest session created.",
  GUEST_EXISTS: "👻 Guest session already active.",
  GUEST_DATA_FETCHED: "👻 Guest data retrieved.",
  GUEST_DATA_UPDATED: "👻 Guest data updated.",
  GUEST_EXPIRED: "👻 Guest session expired or not found.",
  GUEST_NO_SESSION: "👻 No guest session found. Initialize one first.",

  // ── Admin ─────────────────────────────────────────────
  USER_BLOCKED: "🚫 User has been blocked.",
  USER_UNBLOCKED: "✅ User has been unblocked.",
  ROLE_UPDATED: "🛡️ User role updated successfully.",
  ACTIVITY_FETCHED: "📋 Login activity retrieved.",

  // ── Errors ────────────────────────────────────────────
  UNAUTHORIZED: "🔒 Authentication required. Please log in.",
  SESSION_EXPIRED: "⏰ Session expired. Please log in again.",
  FORBIDDEN: "🚫 You don't have permission to access this resource.",
  NOT_FOUND: "🔍 Route not found.",
  VALIDATION_FAILED: "❌ Validation failed.",
  RATE_LIMITED: "🚫 Too many requests. Please slow down.",
  INTERNAL_ERROR: "💥 Something went wrong. Please try again later.",
} as const;
