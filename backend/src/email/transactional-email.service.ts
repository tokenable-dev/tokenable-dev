import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GmailApiClient } from '../vault/gmail-api.client';
import { buildMultipartRfc822 } from './rfc822.util';
import type { TransactionalEmailPayload } from './types';

/**
 * Sends product/ops transactional mail via Gmail API.
 * Templates live under `email/templates/<name>/`; each mail type adds its own service.
 */
@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gmail: GmailApiClient,
  ) {}

  hasGmailCredentials(): boolean {
    return this.gmail.hasCredentials();
  }

  isEnvFlagEnabled(key: string): boolean {
    const v = this.config.get<string>(key)?.trim();
    return v === '1' || v === 'true';
  }

  frontendUrl(): string {
    return this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
  }

  /**
   * HTTPS origin for static assets when backend image has no `frontend/public`.
   * Per-template env (e.g. `WELCOME_EMAIL_PUBLIC_ASSET_BASE_URL`) may override.
   */
  httpsPublicAssetBase(envKey?: string): string | null {
    const raw = (envKey
      ? this.config.get<string>(envKey)
      : this.config.get<string>('TRANSACTIONAL_EMAIL_PUBLIC_ASSET_BASE_URL')
    )
      ?.trim()
      .replace(/\/$/, '');
    if (!raw || !/^https:\/\//i.test(raw)) return null;
    return raw;
  }

  resolveFromHeader(fromEnvKey?: string): string {
    const custom = (fromEnvKey
      ? this.config.get<string>(fromEnvKey)
      : this.config.get<string>('TRANSACTIONAL_EMAIL_FROM')
    )?.trim();
    if (custom) return custom;
    const mailbox = this.gmail.user();
    return `Tokenable <${mailbox}>`;
  }

  async send(
    payload: TransactionalEmailPayload,
    opts?: { boundaryPrefix?: string; fromEnvKey?: string },
  ): Promise<string> {
    if (!this.gmail.hasCredentials()) {
      throw new Error('GMAIL_* credentials not configured');
    }
    const from =
      payload.from ?? this.resolveFromHeader(opts?.fromEnvKey);
    const accessToken = await this.gmail.fetchAccessToken();
    const raw = buildMultipartRfc822({
      to: payload.to,
      from,
      subject: payload.subject,
      plain: payload.plain,
      html: payload.html,
      inlineImages: payload.inlineImages,
      boundaryPrefix: opts?.boundaryPrefix,
    });
    const messageId = await this.gmail.sendRfc822(accessToken, raw);
    this.logger.log(`Transactional email sent to=${payload.to} messageId=${messageId}`);
    return messageId;
  }
}
