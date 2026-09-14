# Frontend hooks

Feature-scoped React hooks. Prefer importing the owning file (`@/hooks/auth/useTradeAccessGate`) unless a folder barrel has real fan-in.

## Folders

| Folder | Role |
|--------|------|
| `analytics/` | GA page-view helpers |
| `auth/` | Session readiness, sell/trade/nav gates, linked wallet, header wallet menu |
| `chain/` | Active-chain contract addresses |
| `collection-ai-insight/` | Cardhedger AI insight panel query |
| `collection-detail/` | Collection PDP composition, listings, trade CTAs, gallery, similar items |
| `collection-dual-price-chart/` | Dual price-series chart option builder |
| `collection-grade-chart/` | Grade price series for charts |
| `collection-overview/` | Overview board layout math |
| `home/` | Home ticker / top movers / just vaulted / hero carousel |
| `layout/` | GNB / shell breakpoint helpers |
| `list-rwa/` | List-RWA modal + price suggestions |
| `marketplace/` | Catalog infinite list + GNB catalog search; admin cover under `marketplace/collection-hero/` |
| `marketplace-admin/` | Admin RQ hooks (users, vault, inventory, roles, …) |
| `markets/` | Markets page data (orders/snapshots/sort) + infinite scroll |
| `media/` | Resolve media URLs + Cardhedger catalog covers |
| `notifications/` | In-app marketplace notifications |
| `partner/` | Active partner session + redeem metadata images |
| `portfolio/` | Holdings page, bids, redeem, certificate, sort/nav/perf |
| `rwa-detail/` | Token metadata for cert / list-modal hosts |
| `sell/` | Sell flow + shipping panels |
| `token-offer/` | Criteria / token bid offer flow |
| `ui/` | Client mount, mobile viewport, modal scroll lock |
| `unified-order-book/` | Unified ask/bid book for collection trade UI |
| `vault/` | Mint form + submission display-by-cert |
| `wallet/` | Privy fiat onramp + funding status |
| `watchlist/` | Watchlist toggle + snapshot enrichment |
| `useElementSize.ts` (root) | ResizeObserver size (charts) |

## Notes

- Keep `markets/` separate from `marketplace/` (browse page vs catalog/trade APIs).
- Snapshot helpers for Markets / Watchlist / Admin stay domain-local — shared batch API, different wiring.
