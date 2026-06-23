import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MAIL_LOGO_CID, resolveMailLogoPath } from './mail-brand.util';
import { buildVerificationEmailContent } from './templates/verification-email.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private isEnabled(): boolean {
    return !!this.config.get<string>('SMTP_HOST')?.trim();
  }

  private formatFromAddress(): string {
    const email = this.config.get<string>('MAIL_FROM')?.trim() ?? 'noreply@localhost';
    const name = this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'Tokenable';
    if (email.includes('<')) return email;
    return `"${name}" <${email}>`;
  }

  /**
   * Transactional verification email (English HTML + plain text).
   * Deliverability: use a domain-aligned From address and configure SPF, DKIM, and DMARC.
   */
  async sendVerificationEmail(to: string, verifyLink: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `SMTP_HOST not set — verification email skipped. Link (dev): ${verifyLink}`,
      );
      return;
    }

    const from = this.formatFromAddress();
    const host = this.config.getOrThrow<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const replyTo =
      this.config.get<string>('MAIL_REPLY_TO')?.trim() ||
      this.config.get<string>('MAIL_FROM')?.trim();

    const logoPath = resolveMailLogoPath();
    const content = buildVerificationEmailContent({
      verifyLink,
      siteName: this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'Tokenable',
      logoCid: logoPath ? MAIL_LOGO_CID : null,
    });

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      replyTo: replyTo || undefined,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attachments: logoPath
        ? [
            {
              filename: 'tokenable_icon.png',
              path: logoPath,
              cid: MAIL_LOGO_CID,
            },
          ]
        : undefined,
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
    });
    this.logger.log(`Verification email sent to ${to}`);
  }
}
