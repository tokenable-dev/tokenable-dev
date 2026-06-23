import { buildVerificationEmailContent } from './verification-email.template';

describe('buildVerificationEmailContent', () => {
  it('renders centered card on light canvas with cid icon', () => {
    const { html } = buildVerificationEmailContent({
      verifyLink: 'https://tokenable-dev.com/api/auth/verify-email?token=abc',
      logoCid: 'tokenable-logo@mail',
    });

    expect(html).toContain('background-color:#e8ecf1');
    expect(html).toContain('cid:tokenable-logo@mail');
    expect(html).toContain('text-align:center');
    expect(html).toContain('Verify your email');
    expect(html).not.toContain('copy and paste');
  });
});
