# Web analytics (GA4)

Tokenable uses **Google Analytics 4 (GA4)** for page-view and traffic reporting. Analytics is **opt-in via env**: if `NEXT_PUBLIC_GA_MEASUREMENT_ID` is unset, no tracking scripts load.

## Setup (one-time)

1. Open [Google Analytics](https://analytics.google.com/) → **Admin** → create a **GA4 property** for your site (e.g. `tokenable-dev.com`).
2. **Data streams** → **Web** → add your site URL.
3. Copy the **Measurement ID** (`G-XXXXXXXXXX`).

## Local development

In `frontend/.env.local`:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Restart `pnpm dev`. Open the site and check **GA4 → Reports → Realtime** for your visit.

Leave the variable empty to disable tracking during development.

## Production / CI deploy

`NEXT_PUBLIC_*` is baked into the frontend Docker image at **build time**.

Add to GitHub **Repository secrets** or **Variables**:

| Name | Example | Required |
|------|---------|----------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | No (recommended for prod) |

The deploy workflow passes it as a Docker build arg when set. After updating the secret, push to `develop` / `main` to rebuild the frontend image.

## What is tracked

| Event | When |
|-------|------|
| **page_view** (initial) | First load — `@next/third-parties` `GoogleAnalytics` |
| **page_view** (SPA) | Client navigations (`/markets`, collection detail, etc.) — `AnalyticsPageViewTracker` |

Page path includes query strings where present (e.g. `/markets?category=pokemon`).

## Code locations

| Path | Role |
|------|------|
| `frontend/components/analytics/SiteAnalytics.tsx` | Root layout entry |
| `frontend/components/analytics/AnalyticsPageViewTracker.tsx` | App Router route changes |
| `frontend/lib/analytics/googleAnalytics.ts` | Env guard + `page_view` helper |

## Privacy / compliance

GA4 collects usage data under Google’s terms. For EU users you may need a cookie/consent banner before enabling GA in production — not implemented in this repo yet.

## Alternatives considered

**Plausible** — simpler and privacy-focused, but paid for hosted analytics. GA4 was chosen for free page-view dashboards and familiar reporting for a mid-term setup.
