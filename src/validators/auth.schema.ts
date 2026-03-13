import { z } from 'zod';

/** Reusable strong-password rule */
const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(100, 'Password must be at most 100 characters.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character.',
  );

// ─── Schemas ────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.email('Please provide a valid email address.'),
  password: passwordRule,
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(100)
    .optional(),
});

export const loginSchema = z.object({
  email: z.email('Please provide a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(1000, 'Password is too long.'),
});

export const forgotPasswordSchema = z.object({
  email: z.email('Please provide a valid email address.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: passwordRule,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required.'),
});

export const resendVerificationSchema = z.object({
  email: z.email('Please provide a valid email address.'),
});

// ─── Inferred types ─────────────────────────────────────────
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
