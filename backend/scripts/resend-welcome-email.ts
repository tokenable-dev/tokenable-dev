/**
 * Resend one-time welcome email (QA). Resets welcome_email_sent_at then sends.
 *
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/resend-welcome-email.ts user@example.com
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/resend-welcome-email.ts user@example.com --any
 *     (skip users table — QA send to any inbox)
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/resend-welcome-email.ts user@example.com --inline-cid
 *     (QA: multipart/related CID PNGs — may show as attachments)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { TransactionalEmailService } from '../src/email/transactional-email.service';
import { resolveWelcomeEmailContent } from '../src/email/templates/welcome/welcome.assets';
import { buildWelcomeEmailMessage } from '../src/email/templates/welcome/welcome.template';
import { GmailApiClient } from '../src/vault/gmail-api.client';

const CLI_FLAGS = new Set(['--any', '--inline-cid']);

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

async function main() {
  const args = process.argv.slice(2);
  const sendToAny = args.includes('--any');
  const inlineCid = args.includes('--inline-cid');
  const email = args.find((a) => !CLI_FLAGS.has(a))?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      'Usage: resend-welcome-email.ts <email> [--any] [--inline-cid]',
    );
  }

  const configService = new ConfigService(process.env);
  const mail = new TransactionalEmailService(configService, new GmailApiClient(configService));

  if (!mail.isEnvFlagEnabled(ENABLED_ENV)) {
    throw new Error(`${ENABLED_ENV} is not enabled`);
  }
  if (!mail.hasGmailCredentials()) {
    throw new Error('GMAIL_* credentials not configured');
  }

  const sendOnce = async () => {
    const { template, inlineImages } = await resolveWelcomeEmailContent(mail, {
      imageDelivery: inlineCid ? 'inline' : 'https',
    });
    const { subject, plain, html } = buildWelcomeEmailMessage(template);
    const messageId = await mail.send(
      { to: email, subject, plain, html, inlineImages },
      { boundaryPrefix: 'tk_welcome', fromEnvKey: FROM_ENV },
    );
    const mode = inlineCid ? 'inline-cid' : 'https';
    console.log(
      `Welcome email sent to=${email} mode=${mode} messageId=${messageId}`,
    );
  };

  if (sendToAny) {
    await sendOnce();
    return;
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
    throw new Error(`No user with email ${email} (use --any for QA without a users row)`);
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
    await sendOnce();
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
