import {
  buildCenteredCardBlock,
  buildTransactionalEmailLayout,
} from '../transactional-email-layout.util';

export type VerificationEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildVerificationEmailContent(input: {
  verifyLink: string;
  siteName?: string;
  logoCid?: string | null;
}): VerificationEmailContent {
  const siteName = input.siteName?.trim() || 'Tokenable';
  const safeSiteName = escapeHtml(siteName);

  const subject = `Verify your ${siteName} email address`;

  const text = [
    `Thanks for signing up for ${siteName}.`,
    '',
    'Open this email in your mail app and tap the "Verify email address" button to confirm your account.',
    '',
    'This link expires in 48 hours.',
    'If you did not create an account, you can ignore this email.',
    '',
    `— ${siteName}`,
  ].join('\n');

  const intro = `<p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#9ca3af;text-align:center;">
      Thanks for joining ${safeSiteName}. Confirm your email to activate your account.
    </p>`;

  const cardBody =
    intro +
    buildCenteredCardBlock({
      title: 'Verify your email',
      buttonHref: input.verifyLink,
      buttonLabel: 'Verify email address',
      footnoteHtml: `Expires in <span style="color:#d1d5db;font-weight:600;">48 hours</span>. If you did not create a ${safeSiteName} account, ignore this message.`,
    });

  const html = buildTransactionalEmailLayout({
    siteName,
    logoCid: input.logoCid,
    pageTitle: subject,
    preheader: `Confirm your email to finish setting up your ${siteName} account.`,
    cardBodyHtml: cardBody,
  });

  return { subject, text, html };
}
