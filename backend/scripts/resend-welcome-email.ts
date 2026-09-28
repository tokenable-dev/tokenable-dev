/**
 * Resend one-time welcome email (QA). Resets welcome_email_sent_at then sends.
 *
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/resend-welcome-email.ts user@example.com
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { TransactionalEmailService } from '../src/email/transactional-email.service';
import {
  WELCOME_ARROW_LINK_CID,
  WELCOME_ARROW_WHITE_CID,
  WELCOME_HERO_CID,
  tryLoadWelcomeCompositeInlineImages,
} from '../src/email/templates/welcome/welcome.assets';
import { buildWelcomeEmailMessage } from '../src/email/templates/welcome/welcome.template';
import { GmailApiClient } from '../src/vault/gmail-api.client';

function loadDotEnv(file: string) {
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    if (process.env[key] !== undefined) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadDotEnv(resolve(__dirname, '../.env'));

const ENABLED_ENV = 'WELCOME_EMAIL_ENABLED';
const FROM_ENV = 'WELCOME_EMAIL_FROM';
const PUBLIC_ASSET_ENV = 'WELCOME_EMAIL_PUBLIC_ASSET_BASE_URL';

async function resolveWelcomeContent(mail: TransactionalEmailService) {
  const front = mail.frontendUrl();
  const assetBase =
    mail.httpsPublicAssetBase(PUBLIC_ASSET_ENV) ?? mail.httpsPublicAssetBase();
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
    'Welcome email image assets missing locally and no HTTPS public asset base URL configured',
  );
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error('Usage: resend-welcome-email.ts <email>');
  }

  const configService = new ConfigService(process.env);
  const mail = new TransactionalEmailService(configService, new GmailApiClient(configService));

  if (!mail.isEnvFlagEnabled(ENABLED_ENV)) {
    throw new Error(`${ENABLED_ENV} is not enabled`);
  }
  if (!mail.hasGmailCredentials()) {
    throw new Error('GMAIL_* credentials not configured');
  }

  const pg = new Client({
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? 'tokenable',
    password: process.env.POSTGRES_PASSWORD ?? 'tokenable',
    database: process.env.POSTGRES_DB ?? 'tokenable',
  });
  await pg.connect();

  const found = await pg.query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );
  const row = found.rows[0];
  if (!row) {
    throw new Error(`No user with email ${email}`);
  }

  await pg.query(`UPDATE users SET welcome_email_sent_at = NULL WHERE id = $1`, [row.id]);

  const claim = await pg.query(
    `UPDATE users SET welcome_email_sent_at = now()
     WHERE id = $1 AND welcome_email_sent_at IS NULL
     RETURNING id`,
    [row.id],
  );
  if (claim.rowCount !== 1) {
    throw new Error('Could not claim welcome send slot (already sent?)');
  }

  try {
    const { template, inlineImages } = await resolveWelcomeContent(mail);
    const { subject, plain, html } = buildWelcomeEmailMessage(template);
    const messageId = await mail.send(
      { to: email, subject, plain, html, inlineImages },
      { boundaryPrefix: 'tk_welcome', fromEnvKey: FROM_ENV },
    );
    console.log(`Welcome email sent to ${email} messageId=${messageId}`);
  } catch (e) {
    await pg.query(`UPDATE users SET welcome_email_sent_at = NULL WHERE id = $1`, [row.id]);
    throw e;
  } finally {
    await pg.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
