import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private isEnabled(): boolean {
    return !!this.config.get<string>('SMTP_HOST')?.trim();
  }

  /**
   * 플랫폼 이메일 인증 링크 발송. SMTP 미설정 시 로그만 남기고 스킵(로컬 개발).
   */
  async sendVerificationEmail(to: string, verifyLink: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `SMTP_HOST not set — verification email skipped. Link (dev): ${verifyLink}`,
      );
      return;
    }

    const from = this.config.get<string>('MAIL_FROM') ?? 'noreply@localhost';
    const host = this.config.getOrThrow<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      subject: '[Tokenable] 이메일 주소를 인증해 주세요',
      text: `아래 링크를 클릭하면 이메일 인증이 완료됩니다.\n\n${verifyLink}\n\n48시간 이내에만 유효합니다.`,
      html: `
        <p>Tokenable 계정 이메일 인증을 진행해 주세요.</p>
        <p><a href="${verifyLink}">이메일 인증하기</a></p>
        <p style="color:#666;font-size:12px;">링크는 48시간 동안만 유효합니다. 본인이 요청하지 않았다면 무시하세요.</p>
      `,
    });
    this.logger.log(`Verification email sent to ${to}`);
  }
}
