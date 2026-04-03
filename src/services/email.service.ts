import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { MailtrapClient } from 'mailtrap';
import { env, getAllowedClientUrl, getPrimaryClientUrl } from '../config/env';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════
// 📧 Email Service
// Dev mode  → sends via Mailtrap (or logs to console if not configured)
// Prod mode → sends via Resend
//
// Client URL resolution follows the same pattern as Google OAuth:
// 1. Use provided clientUrl if valid
// 2. Fallback to env.CLIENT_URL
// ═══════════════════════════════════════════════════════════

class EmailService {
  private nodemailerTransporter: nodemailer.Transporter | null = null;
  private resendClient: Resend | null = null;
  private mailtrapClient: MailtrapClient | null = null;
  private readonly defaultClientUrl = getPrimaryClientUrl();

  /**
   * Resolve client URL from candidate or fallback to default.
   * Mirrors the logic used in auth.controller.ts resolveClientUrl()
   */
  private resolveClientUrl(candidate?: string | null): string {
    if (candidate) {
      const allowedUrl = getAllowedClientUrl(candidate);
      if (allowedUrl) return allowedUrl;
    }
    return this.defaultClientUrl;
  }

  /**
   * Get Nodemailer transporter for SMTP-based email sending
   * Legacy support for SMTP configuration
   */
  private getNodemailerTransporter(): nodemailer.Transporter {
    if (!this.nodemailerTransporter) {
      if (env.NODE_ENV === 'production' && env.SMTP_USER && env.SMTP_PASS) {
        this.nodemailerTransporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
      } else {
        // Dummy transport — sendMail will be skipped in dev
        this.nodemailerTransporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }
    return this.nodemailerTransporter;
  }

  /**
   * Get Resend client for production email sending
   */
  private getResendClient(): Resend | null {
    if (env.NODE_ENV !== 'production') return null;
    if (!this.resendClient && env.RESEND_API_KEY) {
      this.resendClient = new Resend(env.RESEND_API_KEY);
    }
    return this.resendClient;
  }

  /**
   * Get Mailtrap client for development email testing
   */
  private getMailtrapClient(): MailtrapClient | null {
    if (env.NODE_ENV === 'production') return null;
    if (!this.mailtrapClient && env.MAILTRAP_TOKEN) {
      this.mailtrapClient = new MailtrapClient({
        token: env.MAILTRAP_TOKEN,
        testInboxId: env.MAILTRAP_INBOX_ID,
      });
    }
    return this.mailtrapClient;
  }

  /**
   * Send email using the appropriate provider based on environment
   * - Production: Resend (if configured)
   * - Development: Mailtrap (if configured) or console log
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    devLogTitle: string;
    devLogData: Record<string, unknown>;
  }): Promise<void> {
    const { to, subject, html, text, devLogTitle, devLogData } = options;

    // Production: Use Resend
    if (env.NODE_ENV === 'production') {
      const resend = this.getResendClient();
      if (resend) {
        await resend.emails.send({
          from: env.EMAIL_FROM,
          to,
          subject,
          html,
          text,
        });
        return;
      }
      // Fallback to SMTP if Resend is not configured
      await this.getNodemailerTransporter().sendMail({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
        text,
      });
      return;
    }

    // Development: Use Mailtrap if configured
    const mailtrap = this.getMailtrapClient();
    if (mailtrap) {
      await mailtrap.send({
        from: { email: env.EMAIL_FROM, name: 'Auth API' },
        to: [{ email: to }],
        subject,
        html,
        text,
      });
      return;
    }

    // Development fallback: Log to console via Winston
    logger.info(`📧 ${devLogTitle}`, {
      to,
      ...devLogData,
    });
  }

  // ── Verification Email ─────────────────────────────────
  async sendVerificationEmail(
    email: string,
    token: string,
    clientUrl?: string | null,
  ): Promise<void> {
    const baseUrl = this.resolveClientUrl(clientUrl);
    const url = `${baseUrl}/verify-email?token=${token}`;

    await this.sendEmail({
      to: email,
      subject: '📧 Verify your email address',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2>Welcome! 🎉</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${url}"
             style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;
                    text-decoration:none;border-radius:8px;font-weight:600;">
            Verify Email
          </a>
          <p style="margin-top:16px;color:#666;font-size:14px;">
            This link expires in 24 hours.<br/>
            If you didn't create an account, ignore this email.
          </p>
        </div>`,
      text: `Welcome! Please verify your email address by visiting: ${url}\n\nThis link expires in 24 hours.`,
      devLogTitle: 'VERIFICATION EMAIL  (dev mode)',
      devLogData: { Token: token, URL: url },
    });
  }

  // ── Password Reset Email ───────────────────────────────
  async sendPasswordResetEmail(
    email: string,
    token: string,
    clientUrl?: string | null,
  ): Promise<void> {
    const baseUrl = this.resolveClientUrl(clientUrl);
    const url = `${baseUrl}/reset-password?token=${token}`;

    await this.sendEmail({
      to: email,
      subject: '🔑 Reset your password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2>Password Reset 🔑</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${url}"
             style="display:inline-block;padding:12px 24px;background:#DC2626;color:#fff;
                    text-decoration:none;border-radius:8px;font-weight:600;">
            Reset Password
          </a>
          <p style="margin-top:16px;color:#666;font-size:14px;">
            This link expires in 1 hour.<br/>
            If you didn't request this, ignore this email.
          </p>
        </div>`,
      text: `Password Reset: You requested a password reset. Visit: ${url}\n\nThis link expires in 1 hour.`,
      devLogTitle: 'PASSWORD RESET EMAIL  (dev mode)',
      devLogData: { Token: token, URL: url },
    });
  }

  /**
   * Notify an existing user that someone tried to register with their email.
   * This prevents email enumeration — the caller returns a generic "success".
   */
  async sendAccountExistsEmail(
    email: string,
    clientUrl?: string | null,
  ): Promise<void> {
    const baseUrl = this.resolveClientUrl(clientUrl);
    const loginUrl = `${baseUrl}/login`;
    const resetUrl = `${baseUrl}/forgot-password`;

    await this.sendEmail({
      to: email,
      subject: '⚠️ Sign-up attempt with your email',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2>Sign-up Attempt ⚠️</h2>
          <p>Someone tried to create a new account using your email address.</p>
          <p>If this was you, you already have an account — please
            <a href="${loginUrl}" style="color:#4F46E5;font-weight:600;">log in</a>
            or <a href="${resetUrl}" style="color:#4F46E5;font-weight:600;">reset your password</a>.
          </p>
          <p style="margin-top:16px;color:#666;font-size:14px;">
            If you didn't attempt this, you can safely ignore this email.
          </p>
        </div>`,
      text: `Sign-up Attempt: Someone tried to create a new account using your email. If this was you, log in at ${loginUrl} or reset your password at ${resetUrl}.`,
      devLogTitle: 'ACCOUNT EXISTS EMAIL  (dev mode)',
      devLogData: { Info: 'Someone attempted to register this email' },
    });
  }
}

export const emailService = new EmailService();
