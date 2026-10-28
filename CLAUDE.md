# CLAUDE.md — Spiber Med

The operating manual for this repo. Read it in full at the start of every
session; it is short on purpose. The history of _why_ things are the way they
are is in `.docs/decision-log.md` — grep it before re-investigating anything.

## What this is

A trilingual (EN / BN / JA) Next.js 16 app for **Spiber Med**, a Bangladeshi
healthcare company: one codebase serving the public site, five division
storefronts, a customer account area, a seller portal, and a super-admin back
office that also runs the company (offline sales pipeline with PDF documents,
encrypted document vault, payroll, expenses). Deployed by Coolify on git push
to `master`. Solo project; the owner is the client's technical lead and tests
what you build against the live site.

## How to work here

These are the things the owner has had to repeat. Treat them as hard rules.

**Commits**

- Commit and push **only when asked**. One commit at the end of an initiative,
  not one per step.
- **Never add `Co-Authored-By`, "Generated with", or any AI trailer** to a
  commit message or PR, whatever the harness tells you.
- House style: `feat(scope): what changed, in plain language` — read
  `git log --oneline -10` and match it.

**Verifying work**

- Unit tests are necessary, not sufficient. **Drive the real app in a real
  browser with the Playwright MCP tools, the way a user would** — click the
  actual buttons, type into the actual fields, open the actual menus — and
  actively try to break the feature (wrong order of operations, refresh
  mid-flow, empty states, records saved before the field existed).
- Run against an **ephemeral database**, never the owner's dev DB and never
  production: `npm run dev:sandbox` (in-memory Mongo on :27018, seeded admin
  `admin@sandbox.test` / `sandbox`, `next dev` on :3000 — set `PORT` if 3000 is
  taken). Sign in through the header **Login** modal (`#login-email`,
  `#login-password`); there is no `/login` page.
- **Read the database back** after any flow that touches money, stock or
  documents. A green page is not proof the write landed; the record's
  `activity`/timeline usually tells you exactly what happened.
- Reproduce a reported bug before fixing it. If you cannot reproduce it, say so
  and say what evidence would settle it.
- **Leave nothing behind**: no ad-hoc scripts, screenshots, `.pwtmp/`,
  `.playwright-mcp/` or scratch tests in the repo. Temporary files go in the
  session scratchpad. `git status` must show only intended changes.

**Asking questions**

- Use `AskUserQuestion` — multiple choice, recommended option first, one short
  line of context each. **The owner does not read walls of text.** Free-text
  needs go in one short sentence at the end.
- Ask only on genuine ambiguity involving **money, stock, auth or data loss**,
  or a visual direction. Everything else: decide, state the assumption, build.

**Scope and honesty**

- Do what was asked, completely. Don't quietly narrow, widen or "improve".
- Report what you verified and what you did not. A skipped check is stated,
  not implied.
- Reuse the **exact** shared component (`components/admin/ui/*`, `DataTable`,
  `FormSection`, `LocalizedInput`, `SelectField`, `StatusBadge`…). Never
  restyle a bespoke copy — "zero inconsistency" is an explicit requirement.
- Admin page shapes: **list** = `AdminPageHeader` + `DataTable` + list kit;
  **form** = bare `h1` + back-link + fields, no card; **detail** = shadcn
  `Card`s via `components/admin/ui/detail.tsx`.
- For a larger visual redesign, get the direction approved (an artifact or
  screenshots) before writing code.

**Keeping this file useful**

- `CLAUDE.md` holds **rules and gotchas only**. When you learn something the
  next session must know, add one line to the right section here and the full
  story to `.docs/decision-log.md`. Never paste a session narrative into this
  file.

## Locked decisions (do NOT re-ask)

- **One Next.js app** (App Router, TS strict): route handlers → services →
  repositories → Mongoose. Domain logic never in a route handler.
- **DB:** the existing MongoDB on Coolify via `MONGODB_URI`. Never create a
  second database. Standalone Mongo — **no transactions**; use atomic
  conditional updates + compensation.
- **Money = integer poisha.** VAT is charged on goods after discount, never on
  shipping/transport. AIT is what the _buyer withholds_ — informational only,
  never added to a total, and **never a cost**: it is reclaimed with the
  certificate, so it stays out of profit and shows as cash ("After AIT").
  **AIT is charged on goods after discount** — same base as VAT, never on the
  VAT-inclusive total; `aitOnGoods` in `lib/schemas/sales-order.ts` is the one
  place that is decided, for the PDF and the books alike.
- **Payments:** pluggable `PaymentProvider` (`manual` | `dev` |
  `paystation`); an unrecognised name **throws** — never silently falls back.
  **PayStation is wired for shop checkout (Phase 1 of
  `.docs/paystation-plan.md`, 2026-10-28)**; the plan's later phases
  (software/courses, pay-by-link, tourism) are not built. Rules:
  - Every try is a **`PaymentAttempt`** with its own `invoice_number`
    (PayStation refuses a reused one). A provider only `start`s and `check`s;
    **nothing a gateway sends is trusted** — the IPN and the customer's return
    only name an invoice. **`confirmAttempt` is the one door** (IPN, return
    `/api/payments/return/<invoice>`, sweeper, admin Re-check); a conditional
    write on the attempt decides who applies it, and order moves are
    conditional too (`transitionOrder` writes only if status + payment status
    are what it read; side effects run for the winner only).
  - PayStation reports a paid invoice as `"successful"` and a cancelled or
    declined one as **`processing`** — only success means anything. The
    sweeper (`/api/cron/expire-payments`, every 5 min — keep the path) checks
    open tries every run for an hour, hourly for a day, then abandons them,
    and **asks before cancelling** an expired hold. The IPN is a speed-up,
    never required. Money that arrives late/twice/wrong is never applied:
    the attempt goes `needs_refund` (Company › Online payments).
  - Totals floor to whole taka (`roundingMinor`, a Rounding line; VAT
    untouched). The company bears the fee (`pay_with_charge=0`): frozen per
    payment from dated per-method rates, a "Payment fee" order cost in the
    sales report (kept on returned payments too). No refund API: refunds are
    by hand, then recorded (reference) on the order's Cancel/Refund or the
    Needs-refund queue.
  - Payment points are switches in Company › Online payments (super admin),
    all off by default; `LIVE_PAYMENT_POINTS` says which are built, and none
    switches on without fee rates. An online order sends no email or bell
    at placement (it may be abandoned) — the "paid" email and "paid online"
    bell are its confirmation. Production refuses `PAYSTATION_ENV=sandbox`.
  - Locally: `PAYMENT_PROVIDER=paystation PAYSTATION_ENV=sandbox` with the
    public test merchant (`.env.example`); test card 5123450000000008 01/39
    CVV 100, 3-D Secure emulator "Y". `dev` mimics PayStation offline.
    Collected money settles to the bank (T+2). Disbursement is a separate,
    undocumented product (log 2026-10-26). The IPN URL is one per merchant,
    registered with PayStation (`/api/payments/webhook/paystation`).
    Owner-locked (plan): company pays the fee; own software + courses count as
    revenue; tourism collects a staff-set amount per quote, passed-on money
    typed as its cost; external apps (ZenHcare) stay offline.
- **Storage:** pluggable; **production uses local disk** (`ALLOW_LOCAL_STORAGE`,
  public under `public/uploads`, private under `PRIVATE_UPLOADS_DIR`, never
  statically served). R2 is a drop-in via env. Gated media only via
  `/api/media/*`, audited fail-closed.
- **Video:** Cloudflare Stream seam with a local/R2 fallback. **Email:**
  pluggable `Mailer`, console in dev.
- **i18n:** `en` / `bn` / `ja`; content fields `{ en, bn?, ja? }`, English
  fallback. BN/JA UI strings are machine-authored and flagged for native review.
- **Brands are display names, not identifiers.** Public: Medtrade, Spiber Kart,
  Digihealth, MedAcademy, Health Corner, Tourism. Internal (DB enums, API
  paths, folders, i18n keys) stay legacy: `instruments`, `marketplace`,
  `systems`, `academy`. Consulting was removed; its enum value remains.
- **Design** comes from the deployed landing page. Admin = shadcn on the
  `.admin-root` token scope (IBM Plex). Don't invent a look.
- **Sales documents** (proposal / invoice / challan) are **immutable versioned
  snapshots** rendered with `@react-pdf/renderer` and filed encrypted in the
  vault. Sales stock is **reserved at invoicing, written off at delivery**;
  whole-order delivery and payment only. Invoice numbers come from one global
  counter that never resets; challans have their own.
- **Two kinds of sales order, one pipeline.** `SalesOrder.kind` is
  `consumables` (default; rows from before have no field — always read it
  through `orderKindOf()` in `lib/sales/equipment.ts`) or `equipment`.
  Equipment = the same lines, money, stock, numbering and challan, but the
  paper is the company's **price offer**: headed "Commercial Proposal", the
  set named in one sentence, the `equipmentTable` (three rules, no boxes)
  carrying the machine in bold with its accessories numbered beneath and the
  total spelled out in words, then numbered "Label : value" terms
  (`labelledList`) with the manufacturer last. The bill is the same table
  headed "Commercial Invoice".
  **ONE machine per order** (`tooManyMachines`, refused on create and amend);
  **accessories are ordinary lines** carrying `role: "accessory"`, so they may
  come from the catalogue and reserve stock like anything else, and a priced
  one adds to the total — never a nested array, never a second money path.
  The role **sticks** through a kind change, or switching back and forth
  flattens a set into many machines. Equipment lines carry `model`,
  `manufacturer`, `origin`, `serialNo` (the serial prints on the challan
  only, folded into the Specification cell). **A price is optional** — zero
  means "not priced yet": the offer may go out, the invoice may not
  (`no_price`, refused in `transitionOrder` and `generateInvoice`).
  The six letter terms plus `deliveryScope` are per proposal
  (`snapshot.equipmentTerms`, defaults in `EQUIPMENT_TERM_DEFAULTS`), never
  per template. **VAT is ONE entry for the set** — `vatRateBp`, or the
  figure `vatAmountMinor` (on goods after discount, never transport; named
  by `namedVatRateBp`) — never per line; it prints as the table's VAT row
  (`vatLabel`) above a total that includes it, whose words are
  `{{table.totalInWords}}` (the row's own figure). The kind is chosen on New order and fixed once a proposal
  exists; reprints choose the layout from `templateRef.kind`, the challan
  from the order's kind.
- **PDF layout is data.** Every document renders through the block-based
  template engine (`lib/pdf/engine`); the built-in template is **version 0**
  and lives in code (no seed). Published `PdfTemplate` rows are **immutable**
  (revert/reset go through the draft) and each generated document pins
  `templateRef` so reprints never change. Payslips are not pinned. Seal /
  signature images are `stamp` blocks — anchored to the page (fixed spot) or
  to a block (rides with it across pages) — stored
  **encrypted** (`PdfAsset`, needs `COMPANY_VAULT_KEY`), undeletable while
  referenced — and always printed by a template that carries them.
- **No document takes a page it does not need.** Template documents render
  through `renderFitted` / `fitDocument` (`lib/pdf/render.ts`), never bare
  `renderPdf`: the fewest pages any level reaches (`lib/pdf/engine/fit.ts`:
  spacing, then text −0.5 / −1 pt), with the least tightening that reaches
  them — at ANY length, not only 2 → 1 (a 36-line proposal went to 3 pages
  when only 2 → 1 was tried). If that layout's last page has no table rows,
  everything after the last table travels with the table's closing rows
  (`tailWithTable`, measured on an unbroken sheet first). Level 0 is the
  template untouched; the pen space and stationery never shrink.
- **Directors are shareholders.** The company issued a fixed pool of shares
  (Settings `hr.sharePool`, 14,000 at ৳100); each director holds some
  (`employee_share_rates.shares`, append-only, effective from a month). A
  **profit period** = the sales report's **cash after AIT − fixed salaries
  earned in it**, split by **shares ÷ shares issued** (never ÷ shares
  allocated — unallocated money stays with the company). Each period stands
  alone: one that does not clear its salaries pays zero shares, never a debt,
  and nothing carries into the next. A claim booked against a client visit
  therefore does reduce the pool; the reimbursement itself never does.
  `rateBp` rows are legacy (percentage of revenue) and computed the old way
  until `migrate-share-rates-to-shares` rewrites them.
- **Profit split and payday are two settings** (owner's choice, 2026-10-26,
  "complete control"). The **profit cycle** (Settings `hr.profitCycle`, one for
  the company) cuts time into profit periods — calendar months until changed;
  every N months / twice a month / N weeks / N days (`lib/hr/cycles.ts`). A
  longer period pools its months (Nov −৳20k + Dec +৳1L → ৳80k split). **Pay
  schedules** (`PaySchedule`, any number, one default; the built-in Monthly is
  virtual until something must point at it) decide when each person is paid;
  directors on different schedules still split the same periods. A
  **payout** (`PayrollPayout`) pays everything earned and unpaid up to a pay
  period's end: share lines of **approved** periods that ended by then, fixed
  salary **by the day** (`salaryBetween`; pointer `Employee.salaryPaidThrough`,
  cumulative rounding so any cut of a month sums to the month), and approved
  payroll claims (`payrollPayoutId`). Every item is taken by a conditional
  update on its source; a payout that loses a race hands back what it took and
  is `cancelled`. Only a person's latest payout can be voided. There is no
  "Mark paid" any more. Cycles are versions from a day and **never re-cut a
  stored run or a paid pay period** (`cycle_locked`). Run keys: `2026-11` for
  a month, `2026-11-01~2026-11-15` otherwise. A run without `format` (approved
  before 2026-10-26) still holds payable salary lines and frozen claims;
  payouts pay those too.
- **An expense claim is a bill.** `Expense.lines` (day, category, note,
  amount) with `amountMinor` = their sum, computed by the service — every
  money path (payroll, totals, dashboard) reads only the sum. A bill is
  approved and paid **whole**; a wrong line is taken off by editing it while
  `submitted` (logged in its history). Claims from before bills have no
  `lines`: read through `expenseLinesOf()` / `expenseReceiptIdsOf()`
  (`lib/hr/expense-lines.ts`), never `category` / `receiptDocumentId`. The
  sales report costs each line on its own day.
- **Email signatures** are `Employee.emailSignature` (allowlisted HTML + a
  logo flag), set on the employee page by a super admin. A personal mailbox
  signs with its owner's only; every shared mailbox offers everyone's
  (`signatureChoices`). In the composer it is a `mailSignature` block between
  the typing line and a `mailQuote` block (`mail-nodes.ts`); the quick reply
  appends it at send. The logo is `img[data-mail-logo]`, sent as an inline
  `cid:` part — `sanitizeOutgoingHtml(html, { logoCid })` drops every other
  image. Never a remote image.
- **Super-admin only:** Documents vault, Sales, People/HR, hard-delete.
- **Employees have one company address.** Creating an Employee creates
  `businessEmail` (= portal login = mailbox on the company mail server), the
  `employee`-role User and a 24 h invite to the **personal** `email`. The app
  reads/sends mail through ONE Dovecot master user (env), never a
  per-employee password; the mailbox's own password is stored encrypted
  (`Mailbox.passwordCiphertext`, vault key) only for phone setup, and
  revealing it is audited. Mailboxes are created via the `MAIL_PROVISIONER`
  seam (`http` = the `ops/mail-provisioner` sidecar in the Coolify mail
  stack; `memory` for tests/sandbox; an unknown name throws, unset in prod
  throws when first needed). Reading goes through `MAIL_STORE` (`imap` = the
  company server via `MAIL_MASTER_USER/PASSWORD`, login `<mailbox>*<master>`;
  `memory` = fixtures). A `Mailbox` row decides who may open what: owner,
  `assignedUserIds` (shared), or any super admin — the last is audited
  (`mail.mailbox.open`); trash/junk moves are audited too. **Shared
  mailboxes (sales@, career@) are created from Company › Shared mailboxes**:
  new on the server → the provisioner creates the account with a password
  kept encrypted (reveal/reset in the row, audited); already there →
  recorded. There is no catch-all: mail to an address that does not exist
  is refused at the door with a bounce, never stored — check the server
  log (`mail.log`, ~4 weeks) before assuming a message arrived. Bodies are
  sanitised server-side (`lib/mail/sanitize.ts`): remote images blocked
  until asked, `cid:` images served via the attachment route. Sending
  goes through `MAIL_TRANSPORT` (`smtp` as `<mailbox>*<master>` on 465;
  `memory`): composed once, delivered, the same bytes filed in Sent, audited
  (`mail.message.send`). **Employee portal** (`(staff)/me/*`,
  `lib/services/me.service.ts`): every read is scoped to the person (leads
  assigned/sourced, orders created or on their leads, visits attended, own
  claims, own payroll line); portal writes (`/api/admin/me/*`) pin the
  employee from the session, never from the body. Roundcube stays as a
  fallback. The mail page is the shadcn "mail" layout (resizable panes,
  pane widths in the `admin-mail-layout` cookie so SSR paints them);
  list previews are a partial IMAP peek (`lib/mail/preview.ts`), never a
  download. The list is ordered by **arrival date (INTERNALDATE), UID as
  the tie-break** — never by UID alone: mail copied in from the old
  provider keeps its date but takes a fresh UID. The topbar bell shows unread mail for own + assigned mailboxes
  (`lib/services/mail-notify.service.ts`, cached ~20 s, never a super
  admin's elevated reach) and deep-links `?mailbox=&folder=&uid=`; mail
  items are read by opening them, never from the bell. Starred is a
  view across folders (`listStarred`), so a list row always carries its
  `folder` and the client's selection is `{ folder, uid }`. Folders
  ("labels") are real IMAP folders: create/rename/delete only custom, empty
  ones (`createFolder`/`renameFolder`/`deleteFolder`, audited); the
  server's own folders are refused as `reserved`. Bodies are composed in
  TipTap (`mail-editor.tsx`): the client sends `html` + `text`, the
  server re-sanitises the HTML (`lib/mail/outgoing-html.ts`, strict
  allowlist) and derives the plain-text twin from it. **Live updates** are
  server-sent events (`GET …/events?folder=`) fed by one IMAP IDLE
  connection per open tab (`MailStore.subscribe`; the memory store emits on
  its own writes, and the memory transport delivers to any mailbox the
  process already holds so the sandbox shows mail arriving); the client only
  refetches on an event and relays it to the bell (`MAIL_CHANGED_EVENT`).
  The bell counts own + assigned mailboxes, plus every _shared_ mailbox for a
  super admin — never a colleague's personal one; "Mark all read" there
  flags the listed mail `\\Seen` (`markMailRead`), and `/admin/notifications`
  is the full list (staff path in `proxy.ts`). Plan + status: log
  2026-09-13 / 2026-09-14.
- **Written documents** (Company › Paperwork › Documents; notices, letters,
  memos, agreements) are the **super admin's**: TipTap body in
  `AuthoredDocument`, live A4 pages from one shared pager
  (`lib/documents/pager.ts`), the letterhead drawn from the same company
  data as the invoices, **PDF by headless Chromium printing the editor's own
  HTML** (`lib/documents/print`; react-pdf mis-shapes Bengali conjuncts —
  decided with the owner), versions filed encrypted in the vault under
  `Company/Documents/<Kind>s/<year>`, per-type numbers from `Counter`
  (`SPM-NTC-2026-001`) assigned when sent, sent = locked. **Signing:** an
  employee has ONE signature — a `PdfAsset` of kind `signature` (never a
  template stamp) pointed to by `Employee.signatureAssetId`; set on the
  Add-employee panel, the employee page's Signature card, or the portal's
  My signature (`lib/services/hr/employee-signature.service.ts`, audited).
  The author places slots (Insert → Signature slot); **Send** takes the
  number, locks, files the "sent" PDF and tells the slot people (sign) and
  any extra readers (acknowledge) — bell row addressed to them
  (`AdminNotification.forUserIds`) + mail to their company address. In the
  portal (`/admin/me/documents`) they type their name as on the record and
  tick; the recipient row freezes the asset id they signed with, so a
  replaced signature never changes a signed document; the last act renders
  the final PDF with every signature and files it as `completed`. Signed
  images are render-time state (`lib/documents/slots.ts`
  `withSignatures`), never stored in the body — nor are merge values
  (`withMergeValues`), TOC page numbers or footnote numbers: the printer
  works them out and `updateDocument` strips them. **Reissue** unlocks a
  sent document keeping its number and freezes that round's recipients
  onto the last filed version. **Review:** the author asks directors
  (anyone with a login); the document goes `in_review` (still editable);
  reviewers comment from `/admin/me/reviews/<id>` (any admin may join);
  the author replies and resolves. **A comment never touches the body** —
  it is anchored by quote + context (`lib/documents/anchors.ts`) and drawn
  as editor-only decorations (`comment-anchors.ts`); review writes never
  bump `rev`. Word in/out: `lib/documents/docx/*` (mammoth + docx). Plan:
  `.docs/documents-plan.md` (complete). **The vault is `/admin/company/vault`**
  (file manager, API `/api/admin/company/fs/*`); `/admin/company/documents`
  and `/api/admin/company/documents/*` are the written documents. The
  Company section lands on its own dashboard (`/admin/company`). A super
  admin's mail opens on the company mailbox (`primaryMailbox()`, default
  `info@<domain>`, `MAIL_PRIMARY_MAILBOX` to change) — never on whatever
  sorts first.
- **Every password flow lives in the sign-in modal** on the home page
  (`components/auth/auth-modal.tsx`, views login / register / forgot /
  reset): email links are `/{locale}?auth=reset&token=…` (invites add
  `&invite=1`), "forgot" is `?auth=forgot`, and the params are stripped on
  mount. `/reset-password` only redirects there. There is no standalone
  auth page or `(auth)` shell any more — don't add one. Password rules
  (8–200 chars, a letter, a number) are `lib/auth/password-rules.ts`, the
  one source for the Zod `password` and the forms' live checklist. The
  navbar's way into a person's own surface is `workspaceFor()` in
  `use-session.ts` (admin → /admin, employee → /admin/me, seller → /seller).
- **Ads: Google AdSense in blog posts only** — two in-article slots after the
  3rd and 6th paragraph with content (`lib/ads/adsense.ts`, written into the
  sanitized HTML so the space is in the first paint). Super-admin setting at
  Blog › Ads (`adsense`); the publisher ID alone serves `/ads.txt`. Never on
  shops, checkout or accounts; the label may only read "Advertisements" (or
  "Sponsored links"). Auto ads stay off in AdSense. Log 2026-10-27.
- **Seed data: none in prod.** Empty catalogues show "Coming soon".

## Stack

Next.js 16 (App Router, `proxy.ts` not `middleware.ts`) · TypeScript strict ·
Tailwind v4 · shadcn/ui (admin) · next-intl · Mongoose 9 · Zod 4 · jose JWT in
httpOnly cookies + bcryptjs · framer-motion · recharts · sonner ·
@react-pdf/renderer · vitest (+ mongodb-memory-server) · Playwright · **npm**.
Code at repo root, `@/* → ./*`.

## Conventions

- Zod schemas in `lib/schemas` are the single source of truth; models and types
  derive from them. Validate every endpoint input.
- Soft-delete; never hard-delete users, orders, products or money records.
  Timestamps everywhere; index what you query and sort.
- Admin mutations: `requireAdmin`/`requireSuperAdmin` → Zod → service →
  `writeAudit(entry, req)`. Non-GET admin/account/seller APIs are same-origin
  checked in `proxy.ts`.
- New fields are **optional or defaulted** so existing documents keep working —
  no migrations unless unavoidable, and then a guarded, idempotent, dry-run
  script under `scripts/`.
- Best-effort side effects (emails, notifications, vault filing) use
  `Promise.allSettled` / try-catch and never fail the business operation.
- Accessible (WCAG AA, measured not assumed), responsive, `prefers-reduced-motion`
  honoured. Lighthouse ≥ 90 on public pages.

## Where things live

| Area            | Path                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public site     | `app/[locale]/(site)/…` — `medtrade`, `kart`, `digihealth`, `medacademy`, `tourism`, `health-corner`, `blog`, `account`, `become-a-seller`                                                                                                                                                              |
| Admin           | `app/[locale]/admin/(ops)/…` (Operations ⇄ Company, admin-only layout) · `admin/(staff)/me` (employee portal, `requireEmployee`); nav in `components/admin/shell/nav.ts` (`NavViewer`)                                                                                                                  |
| Mail seam       | `lib/mail/{address,config,credentials,sanitize}.ts` · `lib/mail/provisioner/*` (accounts) · `lib/mail/store/*` (reading; `MAIL_STORE` imap or memory, Dovecot master user) · `lib/services/mail*.ts` · pages `(staff)/mail`, `(staff)/me/mail`, `(ops)/company/mail` · sidecar `ops/mail-provisioner/*` |
| Seller portal   | `app/[locale]/seller/…`                                                                                                                                                                                                                                                                                 |
| APIs            | `app/api/…` (`/api/admin/*`, `/api/media/*` gated streams, `/api/cron/*` bearer `CRON_SECRET`)                                                                                                                                                                                                          |
| Domain          | `lib/models` · `lib/schemas` · `lib/repositories` · `lib/services`                                                                                                                                                                                                                                      |
| Shared admin UI | `components/admin/ui/*` (form-shell, data-table, list kit, detail, select-field, localized-input, unsaved-changes)                                                                                                                                                                                      |
| PDFs            | `lib/pdf/engine/*` (schema `lib/schemas/pdf-template.ts`, defaults, blocks, fixtures) · `lib/pdf/{documents,payslip}.tsx` wrappers · editor `components/admin/pdf-templates/*`                                                                                                                          |
| Pluggable seams | `lib/payments` · `lib/storage` · `lib/video` · `lib/mailer` · `lib/travel` · `lib/chat` · `lib/fulfillment`                                                                                                                                                                                             |
| Payroll         | periods `lib/hr/cycles.ts` · `lib/services/hr/{payroll,pay-schedule,payout}.service.ts` · pages `(ops)/company/people/{payroll,payouts}` · portal `(staff)/me/payslips`                                                                                                                                 |
| Documents       | `lib/documents/{types,extensions,chrome,pager,render}.ts` · `lib/documents/print/*` (Chromium) · `lib/services/documents/*` · editor `components/admin/documents/*` · fonts `public/fonts/docs` · dashboard loader `lib/services/company-dashboard.service.ts`                                          |
| i18n            | `messages/{en,bn,ja}.json`, `i18n/routing.ts` is the locale source of truth                                                                                                                                                                                                                             |
| Tests           | `tests/*.test.ts` (vitest, serial; **gitignored** along with `e2e/`)                                                                                                                                                                                                                                    |
| Scripts         | `scripts/*.mjs` — most are dry-run by default (`--commit` to write, `--force-prod` for a non-local host); `sync-indexes`, `seed`, `create-admin`, `demo-seed*`, `dev-sandbox` write as soon as they run                                                                                                 |

Useful scripts: `dev:sandbox` (ephemeral app), `create-admin`, `sync-indexes`,
`reset-seed` (destructive, local), `migrate-*`, `qa-medtrade`, `audit-medtrade`,
`make-pdf-assets`, `pdf-preview`.

## Local dev and verification

- `npm run dev` uses `.env.local` → the docker `spiber-mongo` DB, which holds
  **deliberate QA fixtures — don't wipe it** unless asked. The owner's own dev
  server is usually on :3000 or :3001.
- **Shell env beats `.env.local`** (`MONGODB_URI=… MONGODB_DB=… npx next dev
-p 3007`), which is how an ephemeral run is pointed elsewhere.
- Document generation needs `COMPANY_VAULT_KEY` (64 hex); without it the vault
  returns 503 rather than ever writing plaintext.
- Seeding a user by hand: `roles: ["super_admin"]` (array), `emailVerified:
true`, `tokenVersion: 0`. `Setting` docs key on `key`, not `_id`.
- Before claiming done: `npx tsc --noEmit`, `npx eslint app components lib
tests`, `npm test`, and the browser pass above. Then `git status`.

## Gotchas — each of these has cost real time; check them first

**Dev loop**

- **Turbopack serves a stale `globals.css`** after an edit (9 times in the
  log). Confirm the new rule/token is actually in `document.styleSheets` /
  `getComputedStyle(document.documentElement)` before believing any
  measurement; edit the file's content again (a bare `touch` did not do it)
  or `rm -rf .next` to force it.
- **Restart the dev server after any Mongoose schema edit** — the model
  registry is cached per process and the stale schema silently strips new
  fields on save.
- A killed dev server leaves a corrupt `.next/dev/types/validator.ts` →
  phantom `tsc` errors. `rm -rf .next`, then typecheck. And `rm -rf .next`
  while the dying server still holds `.next/dev` half-deletes it: the
  next `next dev` boots on the remains and every nested route answers a
  bare 404. Kill node, wait, confirm the directory is gone, then start —
  and probe a deep route before testing (`/api/admin/company/sales/orders/x/documents/x/1`
  must answer 401, not an HTML 404). A force-killed server alone can leave
  that state, and the first start on a fresh `.next` can too: a second
  start, without deleting again, fixed it (2026-10-27).
- The first `next dev` after `rm -rf .next` can 500 every page on
  `next/font/google queries have exactly one entry` (Noto Sans JP, Turbopack).
  Stop it and start again — the second clean start served normally.
- **`dev:sandbox` inherits `.env.local`**, including `EMAIL_PROVIDER=smtp`:
  employee invites go out over real SMTP (2026-10-26 they failed auth, so
  nothing was sent). Set `EMAIL_PROVIDER=console` in the shell for a sandbox
  run.
- `tests/mail-live` fails before **09:12 UTC** (15:12 Dhaka): the memory
  store's fixtures are stamped today at 09:12 UTC and sort above a message
  delivered earlier in the day. Rerun after — not a regression.
- Windows: free a port with `taskkill //PID <pid> //T //F` (netstat for the
  pid); stopping the npm wrapper orphans the Next child. `next dev -p 3005`,
  never `npm run dev -- --port`.
- The sandbox blocks Mongo TCP — use `dangerouslyDisableSandbox` for anything
  that connects to a database.

**Data layer**

- **`.lean()` does not apply Mongoose defaults.** Every read of a new optional
  field needs `?? default`; type such fields optional so the compiler forces
  it. Documents saved before the field existed will otherwise crash `.map()`.
- **The list kit's `dayBounds` / `applyDateRange` are UTC days**, but a day
  field stored at Dhaka midnight (`Expense.spentAt` and its lines,
  `Visit.visitedAt`) sits at 18:00 UTC the day before — filter such a field
  with Dhaka bounds (`dhakaDayRange` in `expenses.repo.ts`) or every row lands
  a day off. The visits list still uses UTC bounds.
- `doveadm fetch` folds long headers (Outlook Message-IDs) onto a
  continuation line — a line-by-line parser reads them as blank. Prove a
  message's absence with `doveadm search … header message-id "<id>"`, never
  with a parsed dump.
- Mongoose strips `createdAt` from `$set` (use the raw driver to age a row in
  tests); pipeline updates need `{ updatePipeline: true }`; `$in` works in
  partial-index filters; `null` inside `$in` also matches an absent field.
- A sales order carries AIT **twice**: `aitRateBp` (what we expect, printed on
  the invoice) and `withholding` (what the report reads). `generateInvoice`
  writes the second from the first as `source: "expected"`; the `…` menu writes
  `source: "confirmed"` and a regenerated invoice must never overwrite that.
  Absent `source` means confirmed — old rows were all typed by a person.
- An order's `vatRateBp` is the **configured** rate even when VAT is typed
  on the lines — never print it as the rate of per-line VAT. The invoice
  names the lines' common rate (`invoiceVatRateBp` in `context.ts`); it once
  printed "VAT (0%)" over 5% on every line.
- `catalog-admin.service.updateProductWithStock` rebuilds `variants[]` — copy
  `reservedQty` across or reservations are erased.
- Use `returnDocument: "after"`, not `new: true`.
- **A Buffer field read with `.lean()` is a BSON `Binary`**, and
  `Buffer.from(binary)` returns garbage without throwing — go through
  `ciphertextToBuffer` (`lib/mail/credentials.ts`) or its `.buffer`.
- Next refuses a re-exported segment config (`export { dynamic } from …`) —
  declare it again in the re-exporting page. A `route.ts` may export only
  handlers and config: a shared helper goes in a sibling `_status.ts` /
  `_guard.ts`, never exported from the route.
- `/admin/*` pages are guarded by the `(ops)` route-group layout (admin role)
  and `(staff)` pages by `requireEmployee`; the root admin layout only
  requires _staff_. A new admin page tree goes under `(ops)`, never beside
  it. The proxy sends an employee on an ops URL to `/admin/me`.
- **A sidebar that hides a page is not a guard.** Super-admin trees carry
  their own layout calling `requireSuperAdmin` (`company/people/layout.tsx`,
  `company/sales/layout.tsx`); until 2026-10-26 a plain admin who typed the
  URL saw every director's pay and the sales report.
- **Nor is a layout that withholds `children`.** Next renders the page
  alongside its layout and ships the page's RSC payload anyway: behind the
  Sales refusal card a plain admin still received client names and cost
  figures (fixed 2026-10-27). Every page under a super-admin layout calls
  `requireSuperAdmin()` itself before loading anything;
  `tests/super-admin-pages.test.ts` fails a page that does not.
- `templateRef` absent or `version: 0` on a document version means the built-in
  layout — never backfill it; `getTemplateForRender` is the one choke point.
- A `bullets` block prints every item; `hideEmptyItems` is opt-in because
  "Delivery: within {{terms.deliveryDays}} days" must still print at zero.
  Don't make hide-when-empty the default on any block that existing
  templates use.
- A price column beside a quantity column prints **quantity × unit price**,
  or the column does not add up to the total under it.
- Adding a block type means four places, not one: the schema union, the
  renderer's switch, `catalogue.ts` (info + `newBlock` + `blockSummary`) and
  an inspector form in `block-form.tsx`. The renderer's switch is not
  exhaustive-checked, so a missing form fails silently — the inspector just
  shows the shared spacing fields.
- Page budgets are measured, not guessed: render with `TemplateDocument`'s
  `onLayout` and read the block boxes (A4 content runs 171→790 pt with the
  letterhead). A letter's closing + signature travel as one piece via
  `minPresenceAhead`, or a page arrives holding nothing but a signature —
  but `renderFitted` decides first, from how the pages came out; the
  built-ins' hand-set presences only matter where it cannot fit or glue.

**React / Next**

- React Compiler lint: no `setState` in an effect (use `useSyncExternalStore`
  or derive during render), no ref reads during render, timers live in refs,
  `Date.now()` in render is flagged even in server components.
- **A client component must never import a Mongoose model** — the driver ends
  up in the bundle and the page 500s. Put shared constants in `lib/*` files
  with no DB import.
- React 19 warns on any `<script>` element in a client-rendered tree. Pre-paint
  scripts go in `<div hidden dangerouslySetInnerHTML={{__html: "<script>…"}} />`.
- **framer-motion writes transforms one frame late.** Never pair a framer
  `animate` transform with a same-commit position/layout change — use an
  inline `style.transform` + CSS transition.
- Content wrapped in `Reveal`/`useInView` can stick at `opacity: 0` (rails,
  grids, anything clipped). Don't wrap cards in it; scroll into view and assert
  `opacity > 0.95` before screenshotting.
- An admin editor keeps typed state while sibling panels call
  `router.refresh()`; unsaved edits look saved. Use
  `components/admin/ui/unsaved-changes.ts` (`useUnsavedGuard` in the editor,
  `hasUnsavedChanges()` in the panels) on any new editor.
- Pushing the URL you are already on races `router.refresh()`; on an existing
  record just refresh.
- **Invalidating a react-query key while its observer is still mounted
  refetches it at once** — "mark unread" re-read (and re-marked) the open
  message because the invalidate ran before `setSelected(null)` unmounted
  the reader. Drop the query (`removeQueries`) or patch the cache instead.
- **A server-sent event stream behind Traefik's `gzip` middleware is held
  back until ~1 KB has accumulated** (the gzip wrapper waits to decide
  whether to compress), so small events never reach the browser. Open the
  stream with a comment of a few KB (`events/route.ts`) — after that every
  flush goes straight through — and keep a poll-driven fallback.
- Anything a client must agree with the server on at first paint (pane
  widths, a collapsed state) goes in a **cookie read by the page**, not
  localStorage: a client-only read hydrates as a style mismatch. And a
  `"use client"` module cannot export a plain helper to a server page —
  keep such helpers in `lib/`.
- A derived `<Select>` value cannot represent a choice whose payload is still
  empty ("Someone else…" with no name yet) — hold the choice in state.
- **A Radix Dialog's portal mounts a render after `open` flips**, so an
  effect keyed on `open` never sees the content's elements (a `<canvas>`
  ref is still null). Size or measure from the element's ref callback, and
  use `clientWidth` — a bounding rect read during the zoom-in animation is
  95 % of the real box.
- **Zod 4 `.partial()` still fills defaults** for absent keys: a PATCH schema
  derived from a defaulted object arrives complete and resets every other
  field on merge. Build patch schemas from bare fields (see
  `documentSettingsPatchSchema`). And **`z.record(someEnum, …)` demands
  every enum key** (types and runtime): a patch naming one key needs
  `z.partialRecord` (`paymentSettingsPatchSchema`).
- TipTap: pin `@tiptap/*` to **exactly `3.24.0`** (`^` breaks peer deps);
  `generateHTML` under Node comes from `@tiptap/html/server` (the bare
  import throws "browser environment"). `useEditorState` created while the
  editor is still `null` (Next, `immediatelyRender: false`) keeps that
  empty snapshot until the first transaction — use `useEditorStat`
  (`components/admin/documents/use-editor-stat.ts`) for anything shown
  before the user types (it follows document updates only; the mail
  toolbar, which follows the caret, reads the marks directly until the
  snapshot exists). StarterKit 3 keeps an empty trailing paragraph, so
  inserting at `doc.content.size` lands below a blank line.
- **The document pager must never measure its own output.** It blanks its
  stylesheet, measures the untouched layout (client rects ÷ zoom scale — not
  `offsetTop`, which rounds), writes the pushes back, all in one frame.
  Measuring with the pushes applied and subtracting them out oscillated
  every frame (a paragraph blinking between two pages). Pushes are an
  `nth-child` stylesheet, never attributes on ProseMirror nodes, and are
  measured from the last block with height (margins fall through empty ones).
  Footnotes reserve their room at the foot of the page their reference
  lands on (`NoteMetrics`) — the screen and the printer measure the note in
  the same `.doc-footnotes` styling, so a block whose note does not fit
  moves with it.
- A custom TipTap node whose tag a **mark** also matches (`sup` → the
  superscript mark) needs `priority` on its parse rule, or pasted/imported
  HTML comes back as the mark; and node attributes are never echoed as raw
  HTML attributes (`quiet()` in `extensions.ts`) — a raw `title` is a
  tooltip and a raw data-URL attribute doubles the printed HTML.
- A Radix `Select` returns focus to its trigger after a choice; a toolbar
  select that sends focus into an editor passes `keepFocus` on
  `SelectField`, or the next keystroke reopens the list.
- Playwright drives the Word-like editor by **mouse-dragging real text
  ranges** (Range rects → `mouse.down/move/up`) and clicking at the end of
  a paragraph's box; typing after opening a select without closing it
  landed mid-word. The reviewer's read-only view still tracks the DOM
  selection (ProseMirror observes `selectionchange` inside it), which is
  what the "Comment" bubble relies on.
- A react-pdf `View` `render` prop does get `totalPages` at runtime (the
  typings say otherwise); absolute children of `Page` are measured from the
  padded content box, not the sheet.
- Where blocks landed: `TemplateDocument`'s `onLayout` reads react-pdf's
  laid-out tree from `Document onRender` (`_INTERNAL__LAYOUT__DATA_`); the
  container's `document` is the un-laid tree (boxes NaN). Only a page's
  direct children have page-absolute boxes; nested boxes are relative to
  their parent. The editor rasterises previews with `pdfjs-dist` in the
  browser only — the server has no rasteriser.
- **react-pdf never refuses an unbreakable piece taller than the room**: one
  taller than a page is placed anyway and every child squeezed to fit (rows
  at 5 pt) — nothing "overflows", so a box check finds nothing. Measure such
  a piece on a `Page wrap={false}` sheet first (`fit.measure`).
- `@react-pdf/renderer` is **server-only**: the template editor previews via
  `POST /api/admin/company/pdf-templates/preview`; client code may import only
  `lib/schemas/pdf-template.ts` and `lib/pdf/engine/{paths,catalogue,defaults}`.
- A stamp anchored to the **page** stays put when a longer document carries
  the signature row to the next page; a new stamp now defaults to the
  signature row, but a template saved earlier may still hold page-anchored
  seals — check "Anchored to" before blaming the renderer.
- Text runs are kerned per JSX fragment: `"Subject: " + x` and one string
  differ by sub-pixels. PDF parity is proven by text + Ghostscript pixel diff
  (`gswin64c -sDEVICE=pgmraw`), never by content-stream bytes.
- **Tables break through `PagedTable`** (`lib/pdf/engine/blocks/paged-table.tsx`)
  — never a bare wrapping `View` of rows: react-pdf slices a row at the page
  edge, stretches the first piece to the page bottom (so the frame lives on
  the rows, not the table box), and leaves a `fixed` head alone when the
  next row moves. A `render` prop must never _add_ height on a page: the
  page is re-laid-out at its pre-render height and `flexShrink` cannot be
  0 (`0` reads as unset), so everything on the page gets squeezed; give the
  node static children and let the render prop only remove. No React hooks
  in `lib/pdf/engine` — routes import it as a server module.

**CSS / layout**

- Tailwind v4: an **unlayered** element rule beats every utility regardless of
  specificity — keep `a`/`button` rules inside `@layer base`. Base border
  colour must be set there too (`* { border-color: var(--border) }`), or
  `border-b` paints in text colour.
- Any token set on `.admin-root` that `.dark` also sets needs an explicit
  `.dark .admin-root` line, or light values win in dark mode.
- A `FormPanel` is portaled outside `.admin-root`: its text inherits the
  body's 16px, not the admin's 13px. Size new text in a panel against that
  form's own labels (14px), and lay a panel form out with container queries
  (`@container` / `@2xl:`) — its width is not the viewport's.
- Field borders use `--color-border-field` (3:1), decorative borders use
  `--color-border`. Don't darken the shared token to "fix" visibility.
- Grid/flex children default to `min-width: auto` — add `min-width: 0` before
  hunting phantom overflow. A grid's implicit `auto` track also honours a
  `truncate` child's full-text min-content — use `grid-cols-1` (minmax(0,1fr)).
  shadcn `SelectTrigger` is `w-fit whitespace-nowrap`: a long option makes it
  overflow its grid column until it (or its flex row) gets `min-w-0`.
- A **modal Radix menu scroll-locks `<body>`**, and with `html { overflow-x:
clip }` that makes body the sticky containing block: a menu inside a sticky
  bar drops off-screen. Use `modal={false}` (+ `side="top"`). `html { overflow-x: clip }` is deliberate (not
  `hidden`); leave it.
- Right-aligned table headers must carry the same right padding as the
  padded inputs beneath them (cell `pr-2` + input 12px, measured), or they
  drift right of their figures.
- The home page runs a global Lenis smooth-scroll: nested scrollers need
  `data-lenis-prevent`, and `window.scrollTo` does not work there.
- `color-mix()` serialises as 0–1 floats and Tailwind's `/N` opacity mixes in
  oklab — measure contrast on painted pixels via a canvas, never by parsing.

**Playwright**

- `DataTable` renders a desktop table **and** a hidden mobile card list, so
  every row locator matches twice: scope to `main table` / `:visible`, and
  scope admin buttons to `main` (sidebar items share names).
- `:has-text()` is a substring match (`View` hits `Reviews`); use `:text-is()`.
- Radix `Select` options need `scrollIntoView` in a 64-item list; the trigger
  text is the readable value.
- `page.mouse.wheel()` resolves before the scroll applies — settle-poll on
  `scrollY`; test one direction against a control. `.check()` auto-scrolls.
  `isVisible()` cannot see ancestor clipping.
- Sonner toasts auto-dismiss in ~4 s — find and click a toast action inside
  one `evaluate`, not across two tool calls.
- A blocked dialog stays open behind a toast; `Escape` first.
- "It didn't scroll/save" is usually your measurement, not the app — assert on
  what changed, never on two nulls being equal.
- ProseMirror applies a caret move (click, Ctrl+End) on `selectionchange`; a
  key sent in the same instant uses the **old** selection (Enter split the
  first line). Pause ~150 ms after moving the caret before typing.
- The payroll page opens on the **previous** month; a claim approved today
  sits on the current month's run — open it with `?month=`.
- PayStation's sandbox sends the customer back by a hop `page.route` cannot
  intercept (neither on our return path nor on their host). To test "paid
  and closed the tab" (IPN only), give a pending order an extra attempt whose
  sandbox link has a dead `callback_url`, pay that link, then POST the IPN.

**Patching files from the shell**

- The same backslash-eating bites `node -e '…'` and a heredoc that feeds a
  patch script: `"\\Seen"` arrived as a single backslash and a regex lost
  its `\\/`. Write patch scripts with the Write tool, never inline.
- `nodemailer/lib/mail-composer` must be imported as
  `…/mail-composer/index.js`: Next externalises nodemailer and Node's ESM
  resolver refuses a directory import (the dev-start warning was that).

- Bash heredocs here **eat backslashes** (`\\n` → `\n`, regex escapes break).
  Write files containing regexes or JSX `{"\n"}` with the Write/Edit tool, or
  build the escape with `String.fromCharCode(92)`. A `\\b` in a heredoc once
  became a literal **backspace byte** inside a test's regex: the guard never
  matched, every page was skipped, and the test passed on nothing — `od -c`
  the line when a new test passes too easily.
- Use an assert-and-replace runner: every `find` must match exactly N times or
  nothing is written. Use `str.replace(a, () => b)` — a replacement **string**
  treats `$` as a substitution. `split(a).join(b)` takes a string, not a
  function. Never regex over whitespace next to quotes.
- After the shadcn CLI, check `package.json`: it once installed a package
  literally named `cn`. Never put a bespoke component on a filename the CLI
  writes.

## Deploy

- Coolify auto-deploys `master`. It builds with **nixpacks** and runs
  `next start` (seen in the app's Coolify config on 2026-09-14); there is no
  Dockerfile in the repo — the old note about one was stale. Env lives in
  the Coolify UI, never in git.
- Document PDFs need a Chromium on the box: `DOCS_CHROME_PATH` — a path, or
  a bare name looked up on PATH (dev finds Playwright's/Chrome/Edge on its
  own). Production gets it from `nixpacks.toml` (`nixPkgs = ["...",
"chromium"]`, added 2026-09-14) with `DOCS_CHROME_PATH=chromium` in the
  Coolify env; without a browser Preview PDF and File version answer 503
  `print_failed` (filed versions still open — they are vault bytes).
- Scheduled (Coolify › Scheduled Tasks, run inside the app container):
  `/api/cron/low-stock-digest` daily at 03:00 UTC via `curl` with
  `Authorization: Bearer $CRON_SECRET` (runtime-only env, since 2026-10-18).
  `/api/cron/expire-payments` every 5 minutes (`*/5 * * * *`, same `curl`
  shape, since 2026-10-28; answers `{"expired":0}` while payments are
  `manual`) — keep that path when the PayStation sweeper replaces its body.
  **Env values are never read by Claude**: no snapshot/screenshot of the
  Environment Variables page (it prints every value) and no `value` column
  from `coolify-db`. Auto mode refuses both scripted work on that page and
  a direct `coolify-db` write (even flags only), so the owner makes env
  changes on the page; verify names and flags from `coolify-db`.
- Required in prod: `COMPANY_VAULT_KEY`, `SUPER_ADMIN_EMAILS`, `APP_URL`,
  `ALLOW_LOCAL_STORAGE=true` + one persistent volume at `/data`
  (`UPLOADS_DIR=/data/uploads`, `PRIVATE_UPLOADS_DIR=/data/private`). Applied
  migrations are recorded in the log; check it before running one again.
- **Every site on `TRAEFIK DEFAULT CERT`** = Traefik skipped its `letsencrypt`
  resolver; `docker logs coolify-proxy | grep -i acme` on `spiber-vps` says
  why. On 2026-10-17 it was `/data/coolify/proxy/acme.json` at mode 711 (must
  be **600**) — Traefik checks the mode only at startup, so a bad chmod hides
  until the next reboot. Fix: `chmod 600` it, `docker restart coolify-proxy`.
  The mail server takes its cert from the same file (read-only mount), so
  IMAP/SMTP break at the next renewal too.
- **Prod Mongo has no public port** (closed 2026-10-18; the app uses the
  internal hostname). Run a prod script inside the app container, which
  supplies `MONGODB_URI` — on `spiber-vps`:
  `docker exec -it $(docker ps -qf name=^njozkhkbcp0g0k5fut31migf) node scripts/<x>.mjs …`.
  **Read the script first**: `sync-indexes`, `seed`, `create-admin`,
  `demo-seed*` write as soon as they run.
- Coolify backs up Mongo daily at 21:00 UTC and keeps 7 on the server's own
  disk (`/data/coolify/backups/…`; a gzipped mongodump archive despite the
  `.tar.gz` name). Nothing is off-site, and the `/data` volume (uploads +
  vault) has no backup at all.
- The app's Coolify healthcheck is `GET localhost:3000/api/health` (no DB).
  Traefik stops routing to a container that fails it, so that route must stay
  cheap and always 200.

## History

`.docs/decision-log.md` — every session since 2026-06-02, newest last: what was
built, what broke, the measurements, and the fixtures left in the local DB.
Append there; distil here.
