/** Canonical footer URLs for transactional / marketing emails. */
export function buildEmailFooterLinks(frontendUrl: string) {
  const base = frontendUrl.replace(/\/$/, '');
  return {
    managePreferencesUrl: `${base}/settings?section=notifications`,
    unsubscribeUrl: `${base}/unsubscribe`,
    marketingSiteUrl: 'https://tokenable.io',
    instagramUrl: 'https://www.instagram.com/tokenable_io',
  };
}
