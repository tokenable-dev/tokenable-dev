import {
  buildCenteredCardBlock,
  buildTransactionalEmailLayout,
} from '../transactional-email-layout.util';

export type PasswordResetEmailContent = {
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

export function buildPasswordResetEmailContent(input: {
  resetLink: string;
  siteName?: string;
  logoCid?: string | null;
}): PasswordResetEmailContent {
  const siteName = input.siteName?.trim() || 'Tokenable';

  const subject = `Reset your ${siteName} password`;

  const text = [
    `Reset your ${siteName} password using the button in this email.`,
    '',
    'This link expires in 1 hour.',
    'If you did not request this, ignore this email.',
    '',
    `— ${siteName}`,
  ].join('\n');

  const cardBody = buildCenteredCardBlock({
    title: 'Reset password',
    buttonHref: input.resetLink,
    buttonLabel: 'Choose new password',
    footnoteHtml:
      'Expires in <span style="color:#d1d5db;font-weight:600;">1 hour</span>. If you did not request this, ignore this message.',
  });

  const html = buildTransactionalEmailLayout({
    siteName,
    logoCid: input.logoCid,
    pageTitle: subject,
    preheader: `Reset your ${siteName} password.`,
    cardBodyHtml: cardBody,
  });

  return { subject, text, html };
}
