import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Zod-validated environment schema
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Session
  SESSION_SECRET: z
    .string()
    .min(16, 'SESSION_SECRET must be at least 16 characters'),
  SESSION_MAX_AGE_DAYS: z.coerce.number().default(7),

  // SMTP (optional in development — emails are logged to console)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Auth API <noreply@authapi.com>'),

  // Google OAuth (optional — feature disabled when not set)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // App URLs
  APP_URL: z.string().default('http://localhost:3000'),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // Guest sessions
  GUEST_SESSION_MAX_AGE_DAYS: z.coerce.number().default(7),

  //  JWT (access + refresh tokens)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Access token lifetime — e.g. '15m', '1h' */
  JWT_EXPIRES_IN: z.string().default('15m'),
  /** Refresh token lifetime — e.g. '7d', '30d' */
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  //  Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  //  Cookie domain (subdomain sharing)
  // Use '.yourdomain.com' in production for subdomain sharing
  // Leave empty for localhost dev
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  INVALID ENVIRONMENT VARIABLES');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  console.error('\n💡 Tip: Copy .env.example to .env and fill in values.\n');
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
