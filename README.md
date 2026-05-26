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

## Folder layout

```
app/                          ← Next.js App Router
  api/                        ← route handlers (testimonials, news, newsletter, quote)
  layout.tsx · page.tsx · globals.css
components/
  layout/                     ← persistent chrome
    utility-bar.tsx · sticky-header.tsx · footer.tsx
  sections/                   ← one file per homepage section, top → bottom
    hero.tsx
    pillars.tsx
    business-segments.tsx
    skill-development.tsx
    capital-equipment.tsx
    csr-band.tsx
    stats-band.tsx
    testimonials.tsx
    management.tsx
    latest-news.tsx
    cta-band.tsx
  ui/                         ← shared building blocks (barrel: @/components/ui)
    arrow.tsx · container.tsx · eyebrow.tsx · placeholder.tsx
    reveal.tsx · scroll-stack.tsx · section.tsx · section-title.tsx · index.ts
hooks/                        ← client React hooks (barrel: @/hooks)
  use-magnetic.ts · use-count-up.ts · index.ts
lib/                          ← framework-agnostic helpers
  content-types.ts            ← Testimonial / Post types
  design-tokens.ts            ← typed token export (colors, type, spacing, motion, specs)
  mongodb.ts                  ← cached MongoClient
scripts/seed.mjs              ← seed testimonials + posts collections
```

## Import conventions

```ts
import { Container, Section, Reveal } from "@/components/ui";
import { useMagnetic, useCountUp } from "@/hooks";
import type { Testimonial, Post } from "@/lib/content-types";
import { Hero } from "@/components/sections/hero";
```

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/testimonials` | GET | Returns testimonials sorted by `order`. |
| `/api/news` | GET | Returns the latest news posts. |
| `/api/newsletter` | POST `{ email }` | Upserts an email into `newsletter`. |
| `/api/quote` | POST `{ name, email, org?, phone?, message, category? }` | Captures a quote request. |
