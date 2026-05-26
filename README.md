# SPIBER MED — Next.js + Tailwind + Framer Motion + MongoDB

A 1:1 production build of the SPIBER MED design system handoff (claude.ai/design
project `Spiber 2.0`). The homepage renders all 13 sections from the prototype,
animated with Framer Motion, with content optionally driven by MongoDB.

## Run

```bash
npm install
cp .env.local.example .env.local   # then point MONGODB_URI at your instance
npm run dev                        # http://localhost:3000
```

The site renders without MongoDB — it falls back to baked-in copy that matches
the prototype. Provide a `MONGODB_URI` to enable dynamic testimonials, news,
quote submissions, and newsletter signups.

```bash
node scripts/seed.mjs              # seed testimonials + posts collections
```

## Design system

Tokens live in two synchronised places:

- `app/globals.css` — CSS custom properties + Tailwind 4 `@theme` block. The
  source of truth for runtime styling.
- `lib/design-tokens.ts` — typed export of every token (colors, type scale,
  spacing, radii, shadows, motion, component specs). Carry this file into any
  other surface to reproduce the system.

## Component map

| Section file | Sections it renders |
|---|---|
| `components/chrome.tsx` | UtilityBar · StickyHeader (mega menu) · CTABand · Footer |
| `components/hero.tsx` | Hero (mesh gradient, tagline rotator, ECG scene, partner marquee) |
| `components/mid-sections.tsx` | Pillars · BusinessSegments · SkillDevelopment |
| `components/low-sections.tsx` | CapitalEquipment · CSRBand · StatsBand |
| `components/social-sections.tsx` | Testimonials · Management · LatestNews |
| `components/primitives.tsx` | Reveal · useMagnetic · useCountUp · Placeholder · Container · Section · Eyebrow · SectionTitle · Arrow |

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/testimonials` | GET | Returns testimonials sorted by `order`. |
| `/api/news` | GET | Returns the latest news posts. |
| `/api/newsletter` | POST `{ email }` | Upserts an email into `newsletter`. |
| `/api/quote` | POST `{ name, email, org?, phone?, message, category? }` | Captures a quote request. |
