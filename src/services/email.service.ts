import nodemailer from 'nodemailer';
import { env } from '../config/env';

// ═══════════════════════════════════════════════════════════
// 📧 Email Service
// Dev mode  → logs to console (no SMTP needed)
// Prod mode → sends via configured SMTP transport, need to add resend gmail
// ═══════════════════════════════════════════════════════════

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      if (env.NODE_ENV === 'production' && env.SMTP_USER && env.SMTP_PASS) {
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
      } else {
        // Dummy transport — sendMail will be skipped in dev
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }
    return this.transporter;
  }

  // ── Verification Email ─────────────────────────────────
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const url = `${env.CLIENT_URL}/verify-email?token=${token}`;

    if (env.NODE_ENV !== 'production') {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════╗');
      console.log('║  📧  VERIFICATION EMAIL  (dev mode — not sent)   ║');
      console.log('╠═══════════════════════════════════════════════════╣');
      console.log(`║  To:    ${email}`);
      console.log(`║  Token: ${token}`);
      console.log(`║  URL:   ${url}`);
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log('');
      return;
    }

    await this.getTransporter().sendMail({
      from: env.EMAIL_FROM,
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
    });
  }

  // ── Password Reset Email ───────────────────────────────
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = `${env.CLIENT_URL}/reset-password?token=${token}`;

    if (env.NODE_ENV !== 'production') {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════╗');
      console.log('║  🔑  PASSWORD RESET EMAIL  (dev — not sent)      ║');
      console.log('╠═══════════════════════════════════════════════════╣');
      console.log(`║  To:    ${email}`);
      console.log(`║  Token: ${token}`);
      console.log(`║  URL:   ${url}`);
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log('');
      return;
    }

    await this.getTransporter().sendMail({
      from: env.EMAIL_FROM,
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
    });
  }

  /**
   * Notify an existing user that someone tried to register with their email.
   * This prevents email enumeration — the caller returns a generic "success".
   */
  async sendAccountExistsEmail(email: string): Promise<void> {
    if (env.NODE_ENV !== 'production') {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════╗');
      console.log('║  ⚠️  ACCOUNT EXISTS EMAIL  (dev — not sent)      ║');
      console.log('╠═══════════════════════════════════════════════════╣');
      console.log(`║  To:    ${email}`);
      console.log('║  Info:  Someone attempted to register this email.');
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log('');
      return;
    }

    await this.getTransporter().sendMail({
      from: env.EMAIL_FROM,
      to: email,
      subject: '⚠️ Sign-up attempt with your email',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2>Sign-up Attempt ⚠️</h2>
          <p>Someone tried to create a new account using your email address.</p>
          <p>If this was you, you already have an account — please
            <a href="${env.CLIENT_URL}/login" style="color:#4F46E5;font-weight:600;">log in</a>
            or <a href="${env.CLIENT_URL}/forgot-password" style="color:#4F46E5;font-weight:600;">reset your password</a>.
          </p>
          <p style="margin-top:16px;color:#666;font-size:14px;">
            If you didn't attempt this, you can safely ignore this email.
          </p>
        </div>`,
    });
  }
}

export const emailService = new EmailService();
