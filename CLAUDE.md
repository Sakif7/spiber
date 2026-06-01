# CLAUDE.md — Spiber Med

Persistent context for every session. Read this, then `docs/build-spec.md` for the phase you're on, then `docs/build-progress.md` to see where things stand. Keep this file and the progress file updated.

## What this is

A bilingual (English + Bangla) platform for **Spiber Med**, built as a **single Next.js full-stack app** (storefront + admin + API route handlers). Five divisions — **Spiber Instruments** (medical devices e-commerce), **Spiber Academy** (training/courses LMS), **Spiber Systems** (digital health software), **Spiber Tourism** (medical tourism + air ticket, inquiry/booking based), **Spiber Consulting** (healthcare advisory, services + appointments) — plus a **blog**. Tourism, Consulting, and Systems' custom-solutions share one generalized `Inquiry` pipeline. Full requirements: `docs/build-spec.md`.

## Locked decisions (do NOT re-ask)

- **Architecture:** one Next.js app (App Router, TS). Server code in service → repository layers over Mongoose. Could be extracted to a standalone API later; don't couple domain logic to HTTP.
- **DB:** existing MongoDB on Coolify — connect via `MONGODB_URI`, never create a second DB.
- **Payments:** pluggable `PaymentProvider`; default = **manual/offline** (bank transfer / COD, admin marks paid). SSLCommerz / AamarPay / Stripe are drop-in via env. Currency **BDT only**.
- **Video:** **Cloudflare Stream**, signed playback URLs, no direct download.
- **Storage:** **Cloudflare R2** (S3-compatible).
- **Email:** pluggable `Mailer`; default logs to console in dev; Resend/SMTP via env.
- **i18n:** English + Bangla via next-intl, locale-prefixed routes; content fields are `{ en, bn }`; English fallback; include a Bangla font.
- **Design:** extract the design system (palette, type, spacing, components) from the **already-deployed landing page** — do not invent a new look.
- **Seed data:** none. Empty catalogs show a branded **"Coming soon"** state.
- **Tourism/Consulting:** inquiry/booking based. Packages, partner facilities, and services are admin-managed content. Air-ticket & bookings use a pluggable `FlightProvider` (default manual/request); consulting uses request→admin-confirm `Appointment`. One generalized `Inquiry` pipeline for all lead flows.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (admin/forms) + TanStack Query + React Hook Form/Zod + next-intl · Mongoose · JWT (jose, httpOnly cookies) + bcryptjs · Cloudflare R2 + Stream · Coolify · **npm**. Code at repo root (no `src/`). Next 16 uses `proxy.ts` (not `middleware.ts`).

## Conventions

- TypeScript strict. Validate every endpoint input with Zod. Shared Zod schemas are the single source of truth; derive Mongoose models and TS types from them.
- Service/repository layers — route handlers stay thin. Business logic (pricing, stock, enrollment, payment verification) lives in services and is unit-tested.
- Soft-delete records with history; never hard-delete orders/users/products/financial records. Timestamps everywhere. Index queried/sorted fields.
- No secrets in the repo — env only. Admin routes server-guarded by role (RBAC), not just UI-hidden.
- Signed URLs for protected media/video. Verify payment webhooks server-side before marking paid; idempotent order creation.
- Bilingual + responsive + accessible (WCAG AA). Lighthouse ≥ 90 on public pages.

## Build order (strict)

Phase 0 Foundation → Phase 1 Instruments (e-commerce) → Phase 2 Academy (LMS) → Phase 3 Systems → Phase 4 Tourism → Phase 5 Consulting → Phase 6 Blog. Finish, deploy, and verify each phase before the next. See `docs/build-spec.md` §8 and `docs/build-progress.md`.

## Run / deploy

- Local: `npm run dev` (copy `.env.example` → `.env.local`). An optional `docker-compose.yml` exists only to run a local Mongo if needed — not used for deployment.
- Prod: repo is **connected to Coolify for git auto-deploy**. Build pack = **Dockerfile** (root multi-stage `Dockerfile`, Next.js `output: 'standalone'`, start `node server.js` with `HOSTNAME=0.0.0.0`, port 3000, `/health` check). Env vars live in the Coolify UI — never commit `.env`.

## When to ask vs proceed

Proceed by default. Ask one focused question only on genuine ambiguity involving **money, stock, auth, or data loss**. If you add any dependency/service or deviate from a decision above, record it in the "Decision log" below.

## Decision log

- (append dated entries here as you make implementation choices)
- **2026-06-02** — DB layer confirmed as **Mongoose** (per spec §3.1), despite the landing page currently using the native `mongodb` v7 driver (`lib/mongodb.ts`). Phase 0 will add Mongoose and build Zod → model → repository → service layers; the native-driver `getDb()` stays only for the existing landing-page read routes (testimonials/news/newsletter/quote) during transition, then is retired.
- **2026-06-02 (Phase 0 build)** — Implementation choices, all confirmed with the user before building:
  - **Folder layout:** kept root-level `app/`/`components/`/`lib/` (NOT `src/` as in spec §5); `@/* → ./*`. Logged as an intentional deviation.
  - **Package manager:** **npm** (kept committed `package-lock.json`); spec said pnpm. Use npm everywhere.
  - **i18n:** next-intl 4 with `[locale]` segment; **Next 16 renamed `middleware.ts` → `proxy.ts`** (root `proxy.ts`, Node runtime). `app/[locale]/layout.tsx` is the root layout (no `app/layout.tsx`); home moved to `app/[locale]/(site)/page.tsx`.
  - **Native driver retired:** `lib/mongodb.ts` deleted, `mongodb` pkg uninstalled (Mongoose bundles its own). Mongoose connection cached on `globalThis` in `lib/db/connect.ts`.
  - **Auth:** `jose` (JWT access+refresh+verify+reset, `purpose` claim) + `bcryptjs` (12 rounds). httpOnly cookies. Admin guarded in `proxy.ts` (jose-only, no Mongoose) + re-checked in admin layout. First admin bootstrapped via `SUPER_ADMIN_EMAILS` env. Rate-limit is **in-memory** (Phase 0) — swap to Redis/Upstash when scaling (follow-up).
  - **Deps added:** next-intl, mongoose, zod (v4), jose, bcryptjs, @tanstack/react-query, react-hook-form, @hookform/resolvers, clsx, tailwind-merge, class-variance-authority, lucide-react, radix-ui; dev: prettier(+tailwind plugin), husky, lint-staged, vitest, @vitejs/plugin-react, jsdom, @testing-library/\*, @playwright/test, @types/bcryptjs.
  - **shadcn/ui:** adopted for admin/forms only (`button`, `input`, `label` added via `shadcn@canary`; `components.json` present). shadcn token layer added to `app/globals.css` mapped onto existing palette; marketing components use inline `var(--color-*)` styles and are unaffected. `lib/cn.ts` upgraded to clsx+tailwind-merge.
  - **Health check:** `/api/health` (the proxy matcher excludes `/api`, so a top-level `/health` page can't work with locale routing). Point Coolify's health check at `/api/health`.
  - **Docker:** deferred per user (Coolify auto-builds); `next.config.ts` sets `output: 'standalone'` + `serverExternalPackages: ['mongoose']`.
