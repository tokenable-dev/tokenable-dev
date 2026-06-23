import { buildPasswordResetEmailContent } from './password-reset-email.template';

describe('buildPasswordResetEmailContent', () => {
  it('renders centered card on light canvas with left brand header', () => {
    const { subject, html } = buildPasswordResetEmailContent({
      resetLink: 'https://tokenable-dev.com/auth/reset-password?token=abc',
      logoCid: 'tokenable-logo@mail',
    });

    expect(subject).toBe('Reset your Tokenable password');
    expect(html).toContain('background-color:#e8ecf1');
    expect(html).toContain('cid:tokenable-logo@mail');
    expect(html).toContain('text-align:center');
    expect(html).toContain('Reset password');
    expect(html).not.toContain('Or copy');
  });
});
