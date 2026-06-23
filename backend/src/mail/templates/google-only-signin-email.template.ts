import { buildTransactionalEmailLayout } from '../transactional-email-layout.util';

export type GoogleOnlySignInEmailContent = {
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

export function buildGoogleOnlySignInEmailContent(input: {
  siteName?: string;
  logoCid?: string | null;
}): GoogleOnlySignInEmailContent {
  const siteName = input.siteName?.trim() || 'Tokenable';
  const safeSiteName = escapeHtml(siteName);

  const subject = `${siteName} account uses Google sign-in`;

  const text = [
    `This ${siteName} account uses Google sign-in, not a password.`,
    'Use Continue with Google on the sign-in screen.',
    '',
    `— ${siteName}`,
  ].join('\n');

  const cardBody = `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f9fafb;text-align:center;">
      Use Google sign-in
    </h1>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#9ca3af;text-align:center;">
      This ${safeSiteName} account does not use a password. Sign in with Google instead.
    </p>`;

  const html = buildTransactionalEmailLayout({
    siteName,
    logoCid: input.logoCid,
    pageTitle: subject,
    cardBodyHtml: cardBody,
  });

  return { subject, text, html };
}
