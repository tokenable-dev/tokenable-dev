import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { isWalletOnlyPlaceholderEmail } from '../../../auth/privy/privy-user.parser';
import { User } from '../../../user/entities/user.entity';
import { TransactionalEmailService } from '../../transactional-email.service';
import type { EmailInlineImage } from '../../types';
import {
  WELCOME_ARROW_LINK_CID,
  WELCOME_ARROW_WHITE_CID,
  WELCOME_HERO_CID,
  tryLoadWelcomeCompositeInlineImages,
} from './welcome.assets';
import {
  buildWelcomeEmailMessage,
  type WelcomeEmailTemplateInput,
} from './welcome.template';

const ENABLED_ENV = 'WELCOME_EMAIL_ENABLED';
const FROM_ENV = 'WELCOME_EMAIL_FROM';
const PUBLIC_ASSET_ENV = 'WELCOME_EMAIL_PUBLIC_ASSET_BASE_URL';

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
    const front = this.mail.frontendUrl();
    const assetBase =
      this.mail.httpsPublicAssetBase(PUBLIC_ASSET_ENV) ??
      this.mail.httpsPublicAssetBase();
    const inlineImages = await tryLoadWelcomeCompositeInlineImages();

    if (inlineImages) {
      return {
        template: {
          frontendUrl: front,
          heroImgSrc: `cid:${WELCOME_HERO_CID}`,
          heroComposite: true,
          arrowWhiteImgSrc: `cid:${WELCOME_ARROW_WHITE_CID}`,
          arrowLinkImgSrc: `cid:${WELCOME_ARROW_LINK_CID}`,
        },
        inlineImages,
      };
    }

    if (assetBase) {
      return {
        template: {
          frontendUrl: front,
          heroImgSrc: `${assetBase}/assets/email/welcome-hero-composite.png`,
          heroComposite: true,
          arrowWhiteImgSrc: `${assetBase}/assets/email/welcome-arrow-white.png`,
          arrowLinkImgSrc: `${assetBase}/assets/email/welcome-arrow-link.png`,
        },
      };
    }

    throw new Error(
      'Welcome email image assets missing locally and WELCOME_EMAIL_PUBLIC_ASSET_BASE_URL (or TRANSACTIONAL_EMAIL_PUBLIC_ASSET_BASE_URL) is not set to an https URL',
    );
  }

  /** Fire-and-forget from Privy session when a brand-new `users` row was inserted. */
  async sendForNewRegistration(
    user: User,
    isNewRegistration: boolean,
  ): Promise<void> {
    if (!isNewRegistration) return;
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
