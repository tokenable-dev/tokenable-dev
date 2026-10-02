# Transactional email (product)

User-facing notification mail sent via Gmail API (`GmailModule`). PSA/vault **inbound** mail pollers stay in `VaultModule` — do not mix with this stack.

## Layout

```
backend/src/email/
  email.module.ts              # Nest module — import from AuthModule, future feature modules
  transactional-email.service.ts # Gmail send, From header, env flags, public asset base URL
  rfc822.util.ts                 # multipart/alternative + multipart/related (inline CID images)
  repo-public-assets.util.ts     # Load PNG/SVG from frontend/public when running from monorepo
  types.ts
  templates/
    welcome/                     # First mail type — registration welcome
      welcome-email.service.ts   # Orchestration + users.welcome_email_sent_at idempotency
      welcome.template.ts        # HTML + plain text
      welcome.assets.ts          # CID inline images (hero, arrows, feature icons)
      welcome-feature-icons.util.ts  # sharp: SVG → PNG (Gmail blocks SVG data URIs)
      welcome-hero-composite.util.ts  # sharp: vault + wordmark + copy → one PNG (Gmail)
```

Frontend dev preview: `frontend/components/email/welcome/WelcomeEmailPreview.tsx`, route `/dev/welcome-email`.

Visual tokens follow the design handoff `Welcome Email.dc.html` (DC export is not pasted into send path — `welcome.template.ts` + Gmail-safe tables/CID). Body is a **light** card (white / gray feature rows); hero stays the dark composite PNG. `<meta name="color-scheme" content="light">` opts out of Gmail/iOS dark-mode color inversion on the HTML body.

Welcome footer links are centralized in `email-footer-links.util.ts`: notifications settings (`/settings?section=notifications`), unsubscribe UI (`/unsubscribe` — confirm modal only until backend wiring), `https://tokenable.io`, Instagram `@tokenable_io`.

## Adding a new mail type

1. Create `email/templates/<name>/` with `<name>.template.ts` (plain + HTML), optional `<name>.assets.ts`, and `<name>-email.service.ts` (business rules + idempotency).
2. Build content, then `TransactionalEmailService.send({ to, subject, plain, html, inlineImages })`.
3. Register the orchestration service in `email.module.ts` and export it.
4. Add env toggles as `*_EMAIL_ENABLED` / `*_EMAIL_FROM` (or shared `TRANSACTIONAL_EMAIL_FROM`).
5. Document the trigger in the relevant `docs/api/*.md` file.

## Environment

| Variable | Purpose |
|----------|---------|
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | Send scope for transactional mail |
| `WELCOME_EMAIL_ENABLED` | `1` / `true` to send welcome on new Privy registration |
| `WELCOME_EMAIL_FROM` | Optional From header override |
| `WELCOME_EMAIL_PUBLIC_ASSET_BASE_URL` | HTTPS origin for `/assets/email/*` when using URL images (fallback: `TRANSACTIONAL_EMAIL_PUBLIC_ASSET_BASE_URL`, then `https://app.tokenable.io`). CID mode builds hero with **sharp** when `frontend/public` is present; regenerate composite: `buildWelcomeHeroCompositePng()` → `frontend/public/assets/email/welcome-hero-composite.png`. |
| `WELCOME_EMAIL_INLINE_IMAGES` | `1` / `true`: legacy QA — all images as CID MIME parts (attachment UI in some clients). Default send path uses HTTPS hero/arrows + embedded PNG data URIs for feature badges. |
| `WELCOME_EMAIL_FEATURE_ICONS_HTTPS` | `1` / `true`: feature badges from `…/assets/email/welcome-feature-*.png` (after frontend deploy) instead of data URIs. |
| `TRANSACTIONAL_EMAIL_PUBLIC_ASSET_BASE_URL` | Default HTTPS asset base for future templates |
| `TRANSACTIONAL_EMAIL_FROM` | Default From when a template has no dedicated `*_EMAIL_FROM` |
| `TRANSACTIONAL_EMAIL_FRONTEND_URL` | App origin for links in email bodies (settings, unsubscribe, CTAs). Overrides `FRONTEND_URL`. In production, when `FRONTEND_URL` is localhost, defaults to `https://app.tokenable.io`. |
