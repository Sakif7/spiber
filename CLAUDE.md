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
- **2026-06-02 (Phase 1 — Instruments e-commerce)** — confirmed decisions + implementation notes:
  - **Domain:** changed to **spibermed.com** (was spiberhcl.com) across `site-config`, layout metadata, and contact emails. Set `APP_URL=https://spibermed.com` in Coolify.
  - **Locked Q&A:** stock decrements **at order placement** (reserve; restore on cancel/refund); **guest checkout** (httpOnly `guest_id` cookie cart, merge on login; guest order lookup by number+email); **specs-only** (product variants deferred); **flat shipping + free-over-threshold, tax 0** (configurable `Setting`). Money = integer **poisha**.
  - **No Mongo transactions:** placement uses atomic conditional `$inc` (oversell-proof) + a compensation saga, so it works on **standalone** Coolify Mongo (replica set not required). `Product.stockQty` is denormalized + every change writes an auditable `InventoryMovement`.
  - **Payments:** pluggable `PaymentProvider` (`lib/payments`), default **manual/offline** (`PAYMENT_PROVIDER=manual`); order `pending` → admin marks paid. Gateways are stubs.
  - **Storage:** pluggable `Storage` (`lib/storage`) — **R2** (S3 API, server-side upload, no CORS/presign) when `R2_*` set, else **local-disk** dev fallback (`public/uploads`, gitignored). Admin uploads via `/api/admin/uploads`. **Deps added:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`; dev `mongodb-memory-server`.
  - **Admin** under `/[locale]/admin/*` (English-first UI), server-guarded; list/detail pages read repositories directly; **mutations** go through `/api/admin/*` (`isAdmin` + Zod + `AuditLog`). `connect.ts` now reads `MONGODB_URI` lazily (testability).
  - **Mongoose 9 note:** `FilterQuery` renamed → use `NonNullable<Parameters<typeof Model.countDocuments>[0]>` for filter types. Lean reads typed via `Lean<T> = T & { _id }` (`lib/models/_shared.ts`). Ref id fields widened to `ObjectId | string` where Zod string ids are written.
  - **Deferred:** full browser purchase e2e (needs seed fixtures — order logic covered by integration tests); product variants; real gateways; durable rate-limit store; header mega-menu i18n.
- **2026-06-02 (loading states)** — Global navigation feedback: public storefront uses a client `RouteTransitionOverlay` (blur veil + brand spinner, 140ms grace, persistent aria-live region) mounted in `(site)/layout.tsx` + an exported `startRouteOverlay()` for programmatic navs (wired into shop filters); admin uses route-level `loading.tsx` shimmer skeletons (`components/admin/skeletons.tsx`). No `(site)/loading.tsx` (the old page stays blurred during the wait). CSS in globals.css honors `prefers-reduced-motion`.
- **2026-06-03 (Phase 2 — Academy LMS)** — confirmed decisions + implementation notes:
  - **Video:** pluggable `VideoProvider` seam (`lib/video`) — **Cloudflare Stream** (server upload, processing-status poll, **signed iframe playback** via `iframe.videodelivery.net` + `CF_STREAM_SIGNING_KEY`/`_KEY_ID`) when `CF_STREAM_*` set, else a **local/R2 file fallback** (stores via the `Storage` seam, plays a plain `<video>`). Mirrors the Phase 1 storage pattern; the LMS is fully buildable/testable without a Stream account. Large-file TUS upload deferred (basic ≤200MB server upload). Real-Stream adaptive-HLS verification deferred until creds are set.
  - **Enrollment:** its own entity (`Enrollment`, not an `Order`) with a reused `PaymentRef`. **Direct per-course enroll → manual/offline payment**: free courses (total 0) activate instantly; paid start `pending` until an admin marks them `active` (= paid + access). No cart; idempotent on a client key; mirrors `order.service` (state machine + timeline + emails). Statuses: `pending|active|cancelled|refunded` (payment paid-ness lives in `payment.status`). "Already enrolled" guarded in the service (partial unique index can't use `$in`).
  - **Course content:** `Course` embeds `modules → lessons` (+ embedded `quiz`); modules/lessons carry a **stable string `id`** (generated server-side in `toCourseDoc`, referenced by `Enrollment.progress`) so the whole tree saves wholesale. Admin saves the entire tree via one PATCH.
  - **Security:** quiz `correctOptionId`/`explanation` are **never serialized to the client** — the player posts answers to `/api/academy/quiz` and the server grades. Lesson playback is server-gated (active enrollment OR `isFreePreview`); signed URL fetched server-side.
  - **Certificate:** enrollment-derived (`certificateId` + `completedAt` on 100% completion) — no separate collection; printable on-page view at `/academy/certificate/[id]` (shareable by unguessable id). PDF export deferred.
  - **Coupons:** reused `Coupon` + `validateCoupon`, adding optional `appliesTo: all|instruments|academy` (default `all`, backward-compatible); academy enroll validates with scope `academy`.
  - **Reorder:** new dep **`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`** for accessible drag-reorder in the course builder (up/down fallback). Each `DndContext` has a stable `id` to avoid the SSR `aria-describedby` hydration mismatch.
  - **Schema note:** module/lesson/quiz-question ids are **optional on input** (API backfills); quiz **option** ids stay client-provided since `correctOptionId` references them.
  - **Admin** sidebar regrouped into **Instruments** + **Academy** sections (`admin-nav.tsx`); dashboard KPI grid is `auto-fit` and includes **new enrollments**.
  - **Gated media delivery (no Stream):** chose **R2** for media. Lesson **video/audio** stream through an enrollment-checked route `/api/media/lesson/[courseId]/[lessonId]` with **HTTP Range** support — never a public URL (free-preview lessons are open; locked lessons 403 without an active enrollment, even for admins). The `Storage` seam gained `getObject(key, range)` (R2 `GetObjectCommand` / local `fs` Range); the local `VideoProvider` now stores the storage **key** as `videoUid` (not a URL) and the player builds the gated route for `file` playback (audio rendered via `<audio>`, detected by extension), while Stream keeps its signed iframe. Resources (uploaded via `/api/admin/uploads`, now allowing `application/pdf`, 25MB; the media uploader also accepts audio, 200MB). For strict isolation use a **private R2 bucket** (gated route uses the authenticated S3 API regardless); `R2_PUBLIC_BASE_URL` still serves public images. Verified locally: 200 + Range 206 for free-preview, 403 for locked.
  - **2026-06-03 — Gated PDF / lesson resources:** course material (PDF handouts, images, etc.) is no longer public — it streams through an enrollment-checked route `/api/media/resource/[courseId]/[lessonId]/[index]` mirroring the video route (free-preview open; otherwise active-enrollment required; HTTP Range; `Content-Disposition: inline` so PDFs open in the browser viewer). `/api/admin/uploads` now also returns the raw storage **key**; the course-builder `ResourceEditor` stores that key (not the public URL), and `lessonResource.fileKey` is treated as a storage key (the route still recovers a key from any legacy public URL). The lesson player renders each resource via the gated route by index (storage keys never reach the client) and embeds an inline PDF viewer (`<iframe>`) for `.pdf` resources. Verified locally: free-preview PDF 200 + inline + Range 206, locked anon 401, locked admin-without-enrollment 403, bad index 404.
