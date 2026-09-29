import {
  buildWelcomeEmailHtml,
  buildWelcomeEmailPlainText,
  buildWelcomeEmailRfc822,
} from './welcome.template';

describe('welcome.template', () => {
  const input = {
    frontendUrl: 'https://app.tokenable.io',
    heroImgSrc: 'https://app.tokenable.io/assets/email/welcome-hero-composite.png',
    heroComposite: true,
    arrowWhiteImgSrc:
      'https://app.tokenable.io/assets/email/welcome-arrow-white.png',
    arrowLinkImgSrc:
      'https://app.tokenable.io/assets/email/welcome-arrow-link.png',
    featureAuthIconSrc:
      'https://app.tokenable.io/assets/email/welcome-feature-auth.png',
    featureVaultIconSrc:
      'https://app.tokenable.io/assets/email/welcome-feature-vault.png',
    featureSettleIconSrc:
      'https://app.tokenable.io/assets/email/welcome-feature-settle.png',
  };

  it('includes hero copy and feature rows in HTML', () => {
    const html = buildWelcomeEmailHtml(input);
    expect(html).toContain('What Tokenable provides everyone');
    expect(html).toContain('Authentication');
    expect(html).toContain('Browse markets');
    expect(html).toContain(input.arrowWhiteImgSrc);
    expect(html).toContain(input.featureAuthIconSrc);
    expect(html).not.toContain('data:image/svg+xml');
    expect(html).toContain('rgba(0,0,0,0.08)');
    expect(html).toContain('#FFFFFF');
    expect(html).toContain('color-scheme" content="light"');
    expect(html).toContain(input.heroImgSrc);
    expect(html).toContain('width="600" height="330"');
    expect(html).toContain('tk-welcome-hero');
    expect(html).toContain('height:auto');
    expect(html).toContain('Welcome to Tokenable');
    expect(html).not.toContain('margin-top:-330px');
    expect(html).toContain(
      'https://app.tokenable.io/settings?section=notifications',
    );
    expect(html).toContain('https://app.tokenable.io/unsubscribe');
    expect(html).toContain('https://tokenable.io');
    expect(html).toContain('https://www.instagram.com/tokenable_io');
  });

  it('builds multipart RFC822', () => {
    const raw = buildWelcomeEmailRfc822({
      to: 'user@example.com',
      from: 'Tokenable <hello@tokenable.io>',
      template: input,
    });
    expect(raw).toContain('To: user@example.com');
    expect(raw).toContain('multipart/alternative');
    expect(buildWelcomeEmailPlainText(input)).toContain('Browse markets');
  });

  it('embeds inline images with multipart/related', () => {
    const raw = buildWelcomeEmailRfc822({
      to: 'user@example.com',
      from: 'Tokenable <hello@tokenable.io>',
      template: {
        ...input,
        heroImgSrc: 'cid:welcome-hero@tokenable',
        heroComposite: true,
        arrowWhiteImgSrc: 'cid:welcome-arrow-white@tokenable',
        arrowLinkImgSrc: 'cid:welcome-arrow-link@tokenable',
        featureAuthIconSrc: 'cid:welcome-feature-auth@tokenable',
        featureVaultIconSrc: 'cid:welcome-feature-vault@tokenable',
        featureSettleIconSrc: 'cid:welcome-feature-settle@tokenable',
      },
      inlineImages: [
        {
          cid: 'welcome-hero@tokenable',
          filename: 'welcome-hero.png',
          mimeType: 'image/png',
          data: Buffer.from('hero'),
        },
      ],
    });
    expect(raw).toContain('multipart/related');
    expect(raw).toContain('Content-ID: <welcome-hero@tokenable>');
    expect(raw).toContain('cid:welcome-hero@tokenable');
    const htmlIdx = raw.indexOf('text/html');
    const cidIdx = raw.indexOf('Content-ID: <welcome-hero@tokenable>');
    expect(htmlIdx).toBeGreaterThan(-1);
    expect(cidIdx).toBeGreaterThan(htmlIdx);
  });
});
