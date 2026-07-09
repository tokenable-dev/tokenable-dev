# Hero 3D carousel — performance

Home hero graded-card ring (`hero-slab-3d.js` port). **Visual layout is fixed**; this doc covers runtime tiers and fallbacks only.

## Files

| File | Role |
|------|------|
| `lib/home/heroCarouselCapability.ts` | Tier detection (`full` / `reduced` / `fallback`) |
| `lib/home/heroCarouselAssets.ts` | Texture URLs (no Three.js import) |
| `lib/home/heroCarouselPreload.ts` | Image preload before WebGL init |
| `lib/home/heroCarouselFallback.ts` | Static slab when WebGL skipped |
| `lib/home/heroSlabCarousel.ts` | Three.js scene (dynamic import) |
| `components/home/HomeHeroSlabCarousel.tsx` | Mount, pause, code-split |

## Tiers

| Tier | When | Cards | Notes |
|------|------|-------|-------|
| **full** | Desktop, capable GPU | 10 | PMREM env, antialias, DPR ≤ 2 |
| **reduced** | Desktop, low-end heuristic | 6 | No PMREM, DPR ≤ 1.25, 30fps cap, no rim transmission |
| **fallback** | Mobile, `prefers-reduced-motion`, no WebGL, init timeout | — | Static `hero-slab.jpg` in same host slot |

## Runtime governance

- `IntersectionObserver` on `.home-hero` — pauses rAF when off-screen
- `document.visibilitychange` — pauses when tab hidden
- Init timeout 10s → fallback

## UI unchanged on full tier

- Same orbit, materials (rim **without** `transmission`), overlay CSS variables, layout.
- Reduced tier: fewer cards only on low-end desktops (not visible on full-tier machines).
- Mobile: static slab replaces WebGL in existing `home-hero__carousel-mobile` slot; overlay hidden via CSS (unchanged from prototype mobile).

## QA checklist

- [ ] Desktop full: 10 cards, drag + auto-spin
- [ ] Desktop reduced: 6 cards (force via DevTools / low-end device)
- [ ] Mobile: static slab, no Three.js chunk
- [ ] Scroll past hero → CPU drops (rAF paused)
- [ ] `prefers-reduced-motion` → fallback
