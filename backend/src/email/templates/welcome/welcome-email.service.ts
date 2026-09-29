import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { isWalletOnlyPlaceholderEmail } from '../../../auth/privy/privy-user.parser';
import { User } from '../../../user/entities/user.entity';
import { TransactionalEmailService } from '../../transactional-email.service';
import type { EmailInlineImage } from '../../types';
import { resolveWelcomeEmailContent } from './welcome.assets';
import {
  buildWelcomeEmailMessage,
  type WelcomeEmailTemplateInput,
} from './welcome.template';

const ENABLED_ENV = 'WELCOME_EMAIL_ENABLED';
const FROM_ENV = 'WELCOME_EMAIL_FROM';
@Injectable()
export class WelcomeEmailService {
  private readonly logger = new Logger(WelcomeEmailService.name);

  constructor(
    private readonly mail: TransactionalEmailService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private async resolveContent(): Promise<{
    template: WelcomeEmailTemplateInput;
    inlineImages?: EmailInlineImage[];
  }> {
    return resolveWelcomeEmailContent(this.mail);
  }

  /** Fire-and-forget when a brand-new `users` row is inserted with a real inbox. */
  async sendForNewRegistration(
    user: User,
    isNewRegistration: boolean,
  ): Promise<void> {
    if (!isNewRegistration) return;
    await this.trySendWelcomeEmail(user);
  }

  /**
   * Wallet-only (`@privy.wallet`) accounts that add a contact email via `PATCH /auth/profile`.
   */
  async sendForContactEmailLinked(
    user: User,
    previousEmail: string,
  ): Promise<void> {
    if (!isWalletOnlyPlaceholderEmail(previousEmail)) return;
    await this.trySendWelcomeEmail(user);
  }

  private async trySendWelcomeEmail(user: User): Promise<void> {
    if (!this.mail.isEnvFlagEnabled(ENABLED_ENV)) return;
    if (!this.mail.hasGmailCredentials()) {
      this.logger.warn(
        'Welcome email skipped — GMAIL_* credentials not configured',
      );
      return;
    }
    const email = user.email?.trim().toLowerCase();
    if (!email || isWalletOnlyPlaceholderEmail(email)) return;

    const claimed = await this.users.update(
      { id: user.id, welcomeEmailSentAt: IsNull() },
      { welcomeEmailSentAt: new Date() },
    );
    if (!claimed.affected) return;

    try {
      const { template, inlineImages } = await this.resolveContent();
      const { subject, plain, html } = buildWelcomeEmailMessage(template);
      await this.mail.send(
        {
          to: email,
          subject,
          plain,
          html,
          inlineImages,
        },
        { boundaryPrefix: 'tk_welcome', fromEnvKey: FROM_ENV },
      );
      this.logger.log(`Welcome email sent userId=${user.id}`);
    } catch (e) {
      await this.users.update(
        { id: user.id },
        { welcomeEmailSentAt: null },
      );
      this.logger.warn(
        `Welcome email failed userId=${user.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
