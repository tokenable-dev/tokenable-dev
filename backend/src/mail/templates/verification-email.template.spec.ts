import { buildVerificationEmailContent } from './verification-email.template';

describe('buildVerificationEmailContent', () => {
  it('renders white wordmark and verify CTA without raw link block', () => {
    const { subject, text, html } = buildVerificationEmailContent({
      verifyLink: 'https://tokenable-dev.com/api/auth/verify-email?token=abc',
    });

    expect(subject).toBe('Verify your Tokenable email address');
    expect(text).toContain('Verify email address" button');
    expect(text).not.toContain('verify-email');
    expect(html).toContain('color:#ffffff');
    expect(html).toContain('Tokenable');
    expect(html).not.toContain('copy and paste');
  });

  it('embeds inline logo via cid when provided', () => {
    const { html } = buildVerificationEmailContent({
      verifyLink: 'https://tokenable-dev.com/api/auth/verify-email?token=abc',
      logoCid: 'tokenable-logo@mail',
    });

    expect(html).toContain('cid:tokenable-logo@mail');
    expect(html).toContain('src="cid:tokenable-logo@mail"');
  });
});
