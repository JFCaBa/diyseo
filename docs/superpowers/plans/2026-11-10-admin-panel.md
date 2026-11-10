# Hub admin panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared-password `/admin` of the DIYSEO hub with an admin area open only to the emails in `ADMIN_EMAILS`, adding a dashboard (revenue from Stripe, new users, trials ending), user pages, payments, analytics, and two audited actions (grant/revoke COMP, extend trial).

**Architecture:** Gate = one helper module (`lib/admin-auth.ts`) over a pure, edge-safe email check (`lib/admin-access.ts`), used by the layout, every page, the backups route handlers and every action. Numbers come from pure functions (`lib/admin-metrics.ts`, `lib/admin-revenue.ts`) that are unit-tested; Stripe is read-only behind a small TTL cache (`lib/admin-stripe.ts`). Plan changes are decided by pure rules (`lib/admin-plan-rules.ts`) and applied by server actions under `lockWorkspace`, each writing an `AdminAuditLog` row.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma/PostgreSQL, Tailwind, Zod, Stripe Node SDK, `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-10-admin-panel-design.md`

## Global Constraints

- Admins are identified only by `ADMIN_EMAILS` (comma separated, matched case-insensitively against the session email); unset or empty means nobody is admin.
- A non-admin or signed-out visitor gets `notFound()` on every `/admin/*` page and a 404 `Response` on every admin route handler; admin server actions throw `Error("Forbidden")`. `/admin` was in `PUBLIC_PREFIXES` in `middleware.ts`; Task 1 removes it so signed-out requests are redirected, but middleware only sees a cookie, so every entry point still checks the admin email for itself.
- Stripe is live: admin code only calls `list`/`retrieve` methods, never create/update/cancel/refund.
- Revenue is net of refunds, UTC calendar month (`monthStartUtc` in `lib/entitlements.ts`), grouped by the currency Stripe reports. DIYSEO's Stripe account is not shared with MyCarPlate, so no product filtering.
- "New users" = workspace owners (`User` with a `workspace`) created in the current UTC month. "Trials ending" = `plan = TRIAL` with `trialEndsAt` within the next 7 days (`TRIALS_ENDING_DAYS = 7`).
- Extend-trial presets are 7 or 14 days, added to `max(now, trialEndsAt)`, and set `plan = TRIAL`. COMP and extend are refused while the workspace has a live Stripe subscription status (`active`, `trialing`, `past_due`).
- New mutations live in `app/admin/actions.ts` with Zod schemas in `lib/validations.ts`; Prisma via `lib/prisma.ts`; relative imports in `tests/` (as the existing tests do).
- Do not remove `ADMIN_PASSWORD` from the production server; only the code and `.env.example` entry go.
- Run `npm test`, `npx tsc --noEmit` and `npm run lint` before each commit; commit messages follow the repo's `type(scope): subject` style.

## Review Focus

Inputs and conditions the spec implies that no feature test would otherwise exercise; each has a test in the named task.

1. A signed-out visitor, a non-admin user, or a direct POST of an admin action hits the admin area: must see a 404 / be refused, never the password form or data. (Task 1)
2. `ADMIN_EMAILS` unset, empty, padded with spaces, mixed case, or the session email missing: nobody is admin by accident, and `JFCA68@Gmail.com` still matches `jfca68@gmail.com`. (Task 1)
3. Stripe slow, down or misconfigured (no key): dashboard and payments still render and revenue reads "unavailable", not a crash or a zero. (Task 3)
4. Grant COMP on a workspace with a live subscription, extend a trial that already expired, revoke COMP while a subscription is live (refused), double submit (idempotent through `opId`): each gives the rule's outcome, and the plan ends up where the rules say. (Tasks 5, 6)
5. Revenue with several currencies, partial refunds, fully refunded charges, zero charges, and a charge at the month boundary (UTC). (Task 3)

---

### Task 1: Admin gate and shell

**Files:**
- Create: `lib/admin-access.ts`, `tests/admin-access.test.ts`, `tests/admin-middleware.test.ts`
- Modify: `middleware.ts` (remove `"/admin"` from `PUBLIC_PREFIXES`), `lib/admin-auth.ts` (rewrite), `app/admin/layout.tsx`, `app/admin/page.tsx` (drop password form branch), `app/admin/{users,sites,content,backups}/page.tsx`, `app/admin/backups/{download,restore}/route.ts`, `app/admin/backups/files/[filename]/route.ts`, `app/admin/actions.ts` (remove login/logout/rate-limit code; `adminToggleArticleStatus` uses `requireAdminAction`), `components/admin-shell.tsx`, `components/sidebar-nav.tsx`, `app/[siteId]/layout.tsx`, `.env.example`
- Delete: `components/admin-password-form.tsx`, `components/admin-logout-form.tsx`

**Interfaces:**
- Produces:
  - `isAdminEmail(email: string | null | undefined, env?: Record<string, string | undefined>): boolean` in `lib/admin-access.ts` (edge-safe, no Prisma; same style as `lib/access.ts`).
  - In `lib/admin-auth.ts`: `type AdminUser = { id: string; email: string }`; `getAdmin(): Promise<AdminUser | null>` (reads `auth()`, null unless `session.user.id` and `isAdminEmail(session.user.email)`); `requireAdmin(): Promise<AdminUser>` (calls `notFound()`); `requireAdminAction(): Promise<AdminUser>` (throws `Error("Forbidden")`); `adminRouteGuard(): Promise<AdminUser | Response>` (404 `Response` when not admin).
  - `SidebarNav` gains optional prop `isAdmin?: boolean`.

- [ ] **Step 1: Write the failing test** `tests/admin-access.test.ts`: `isAdminEmail("jfca68@gmail.com", { ADMIN_EMAILS: "jfca68@gmail.com" })` is true; `"JFCA68@Gmail.com"` against `" jfca68@gmail.com , other@x.com "` is true; unset env, `ADMIN_EMAILS: ""`, `ADMIN_EMAILS: " , "`, `null` email, `undefined` email, `""` email and a non-listed email are all false.
- [ ] **Step 2: Run** `npx tsx --test tests/admin-access.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `isAdminEmail`** by copying the `listedEmails` approach from `lib/access.ts` against `env.ADMIN_EMAILS`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Rewrite `lib/admin-auth.ts`** with the four exports above; remove the cookie, password and session-hash code. Keep `import "server-only"`.
- [ ] **Step 6: Move every entry point under the gate.** Layout: `await requireAdmin()` then `AdminShell`; no unauthenticated branch. Each page calls `requireAdmin()` first (existing pages that call `requireAdminAuth` switch to it; `page.tsx` loses the password form). The three backups route handlers start with `const admin = await adminRouteGuard(); if (admin instanceof Response) return admin;`. `adminToggleArticleStatus` calls `requireAdminAction()`. Delete the two password/logout components and the login, logout and rate-limit code in `actions.ts`.
- [ ] **Step 7: Shell and menu.** `AdminShell` nav gets Payments (`/admin/payments`) and Analytics (`/admin/analytics`) entries and, in place of the logout form, a "Back to app" link to `/`; its subtitle drops "read-only". In `app/[siteId]/layout.tsx` compute `isAdminEmail(session.user.email)` and pass `isAdmin` to `SidebarNav`, which renders an "Admin" link to `/admin` (absolute, not prefixed with the site id) under the Account group only when true.
- [ ] **Step 7b: Middleware as an extra layer.** Remove `"/admin"` from `PUBLIC_PREFIXES` so a request with no session cookie is redirected to `/` before reaching any admin entry (middleware cannot check the admin email, since sessions are database-backed; the per-entry guards remain the real check). Test in `tests/admin-middleware.test.ts`: `middleware(new NextRequest("http://x/admin"))` and `/admin/users` without cookies redirect to `/`; with an `authjs.session-token` cookie they pass through; `/blog` stays public.
- [ ] **Step 8: `.env.example`:** replace `ADMIN_PASSWORD` with `ADMIN_EMAILS=""` plus a one-line comment.
- [ ] **Step 9: Verify.** `npm test`, `npx tsc --noEmit`, `npm run lint` pass; `grep -rn "ADMIN_PASSWORD\|requireAdminAuth\|isAdminAuthenticated" app components lib` finds nothing. Manually with `ADMIN_EMAILS` set to the dev account: `/admin` shows the shell when signed in, and a 404 when signed out or when `ADMIN_EMAILS` is empty; `/admin/backups/download` answers 404 when signed out.
- [ ] **Step 10: Commit** `feat(admin): gate /admin by ADMIN_EMAILS instead of a shared password`

### Task 2: Metrics functions and dashboard

**Files:**
- Create: `lib/admin-metrics.ts`, `tests/admin-metrics.test.ts`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin` (Task 1), `monthStartUtc`, `effectivePlan`, `WorkspacePlan` from `lib/entitlements.ts`.
- Produces in `lib/admin-metrics.ts`:
  - `TRIALS_ENDING_DAYS = 7`; `trialEndingWindow(now: Date): { from: Date; to: Date }` (`from = now`, `to = now + 7 days`).
  - `bucketByWeekUtc(dates: Date[], now: Date, weeks: number): { weekStart: Date; count: number }[]` (Monday-start UTC weeks, oldest first, always `weeks` entries, zero-filled).
  - `countByEffectivePlan(workspaces: { plan: string; trialEndsAt: Date | null }[], now: Date): Record<WorkspacePlan, number>` (every key present).

- [ ] **Step 1: Write failing tests:** the window ends exactly 7 days after `now`; `bucketByWeekUtc` puts a Sunday 23:59 UTC and the following Monday 00:00 UTC in different buckets, returns exactly `weeks` entries with zero counts for empty weeks, and ignores dates older than the first bucket; `countByEffectivePlan` counts an expired `TRIAL` as `NONE`, a `TRIAL` ending exactly `now` as `NONE`, `COMP` as `COMP`, an unknown plan string as `NONE`, and returns 0 for absent plans.
- [ ] **Step 2: Run** `npx tsx --test tests/admin-metrics.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the three functions** in `lib/admin-metrics.ts` (pure; reuse `effectivePlan`).
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Dashboard.** `app/admin/page.tsx` keeps its existing platform counts and adds, above them, three cards: **Revenue this month** (a placeholder slot filled in Task 3), **New users this month** (`prisma.user.count` where `workspace` is not null and `createdAt >= monthStartUtc(now)`), and **Trials ending in 7 days** (workspaces with `plan: "TRIAL"` and `trialEndsAt` within `trialEndingWindow(now)`, listing owner email and end date, each linking to `/admin/users/<ownerId>`).
- [ ] **Step 6: Verify** `npm test`, `npx tsc --noEmit`, `npm run lint`; open `/admin` with seeded data and check the two DB-backed cards.
- [ ] **Step 7: Commit** `feat(admin): dashboard cards for new users and trials ending`

### Task 3: Stripe revenue, with cache and failure handling

**Files:**
- Create: `lib/admin-revenue.ts`, `lib/admin-stripe.ts`, `tests/admin-revenue.test.ts`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `getStripe` (`lib/stripe.ts`), `monthStartUtc`, `PLANS` (`lib/plans.ts`), `countByEffectivePlan` (Task 2).
- Produces:
  - `lib/admin-revenue.ts`: `type ChargeLike = { amount: number; amountRefunded: number; paid: boolean; currency: string }`; `netRevenueByCurrency(charges: ChargeLike[]): { currency: string; amountMinor: number }[]` (paid charges only, `amount - amountRefunded`, never negative, sorted by currency); `estimateMonthlyFromPlans(counts: Record<WorkspacePlan, number>): number` (STARTER/PRO/AGENCY counts times `monthlyPrice` from `PLANS`); `createTtlCache<T>(ttlMs: number, now?: () => number): { get(key: string, load: () => Promise<T>): Promise<T> }` (entries are per key; a failed load is not cached); `formatMinor(amountMinor: number, currency: string, locale?: string): string` (converts minor units using the currency's own fraction digits from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`, so GBP divides by 100 and JPY by 1).
  - `lib/admin-stripe.ts`: `type MonthRevenue = { ok: true; totals: { currency: string; amountMinor: number }[]; fetchedAt: Date } | { ok: false }`; `getMonthRevenue(now?: Date): Promise<MonthRevenue>` (TTL 5 minutes, cache key `YYYY-MM` of the UTC month so a lookup after midnight on the 1st never reuses last month; lists charges with `created: { gte: monthStart, lt: nextMonthStart }` using `autoPagingToArray`, maps `amount_refunded`; any error, including a missing `STRIPE_SECRET_KEY`, logs once and returns `{ ok: false }`; use a 10 s timeout through the Stripe client option or `Promise.race`).

- [ ] **Step 1: Write failing tests** in `tests/admin-revenue.test.ts`: two currencies are summed separately and sorted; a partial refund subtracts; a fully refunded charge contributes 0; an unpaid charge is ignored; an empty list gives `[]`; a refund larger than the amount cannot go negative; `estimateMonthlyFromPlans` with `{ STARTER: 2, PRO: 1, COMP: 5, TRIAL: 3, NONE: 1, AGENCY: 0 }` equals `2 * 29 + 79`; the TTL cache calls `load` once per key within the TTL, again after it, again for a different key (e.g. `2026-11` then `2026-12`) even within the TTL, and re-calls `load` after a rejected load; `formatMinor(2900, "GBP")` renders 29.00 pounds and `formatMinor(2900, "JPY")` renders 2,900 yen.
- [ ] **Step 2: Run** `npx tsx --test tests/admin-revenue.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `lib/admin-revenue.ts`** (pure).
- [ ] **Step 4: Implement `lib/admin-stripe.ts`** with only `charges.list`. The month boundary passed to Stripe is `Math.floor(monthStartUtc(now).getTime() / 1000)`.
- [ ] **Step 5: Run the tests.** Expected: PASS.
- [ ] **Step 6: Fill the dashboard's revenue card.** Show each currency total through `formatMinor`; label the card "Charges this month, net of refunds on them" (a refund issued this month on an older charge is not counted, by design); beneath it, "Estimate from plans: £X" using `estimateMonthlyFromPlans(countByEffectivePlan(...))`. When `ok` is false show "Stripe unavailable" with the estimate still visible.
- [ ] **Step 7: Verify** with `STRIPE_SECRET_KEY` unset that `/admin` still renders and shows "Stripe unavailable"; with a test-mode key, that a test charge appears. Run `npm test`, `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 8: Commit** `feat(admin): month revenue from Stripe with cache and a plan-price estimate`

### Task 4: Users list and user page

**Files:**
- Create: `app/admin/users/[id]/page.tsx`
- Modify: `app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `effectivePlan`, `monthStartUtc`.
- Produces: list route `/admin/users?q=<text>` and detail route `/admin/users/<userId>`; the detail page renders a slot for the plan actions (Task 6) keyed on the user's workspace id.

- [ ] **Step 1: List.** Server component reading `searchParams.q`; filters by case-insensitive `contains` on email or name (page size 50 with `?page=` and a total count); columns: email, name, created, effective plan, subscription status, sites. Rows link to the detail page. Empty result shows a message.
- [ ] **Step 2: Detail.** `requireAdmin()` first; unknown id or a user without a workspace-less record still renders what exists (`notFound()` only when the user id does not exist). Sections: account (email, name, created, sign-in provider from `accounts`), workspace (name, role, stored plan, effective plan, trial end, subscription status, Stripe customer id as text with a link to the Stripe dashboard customer page, last plan sync), members, AI usage this month (committed `AiUsage` count by `kind`), sites with article counts.
- [ ] **Step 3: Verify** with `npm run lint`, `npx tsc --noEmit`, and by opening the list, searching, and opening a user, a member (non-owner) and a user with no workspace.
- [ ] **Step 4: Commit** `feat(admin): searchable user list and per-user page`

### Task 5: Plan-change rules and audit table

**Files:**
- Create: `lib/admin-plan-rules.ts`, `tests/admin-plan-rules.test.ts`, `prisma/migrations/20261110090000_add_admin_audit_log/migration.sql`
- Modify: `prisma/schema.prisma`, `lib/billing-rules.ts` (export `isLiveStatus`)

**Interfaces:**
- Consumes: `LIVE_STATUSES` in `lib/billing-rules.ts` (add `export function isLiveStatus(status: string | null | undefined): boolean`).
- Produces in `lib/admin-plan-rules.ts`:
  - `EXTEND_PRESETS = [7, 14] as const`.
  - `type WorkspaceState = { plan: string; trialEndsAt: Date | null; subscriptionStatus: string | null }`.
  - `type Decision = { ok: true; plan: "COMP" | "TRIAL" | "NONE"; trialEndsAt: Date | null } | { ok: false; reason: string }`.
  - `decideGrantComp(ws: WorkspaceState): Decision`, `decideRevokeComp(ws: WorkspaceState, now: Date): Decision`, `decideExtendTrial(ws: WorkspaceState, days: number, now: Date): Decision`.
- Prisma model `AdminAuditLog { id cuid, opId String @unique, actorUserId String, actorEmail String, workspaceId String (no relation, so the trail outlives the workspace), action String, before Json, after Json, createdAt DateTime @default(now()) }` with `@@index([workspaceId, createdAt])`.

- [ ] **Step 1: Write failing tests** with fixed dates: grant COMP on TRIAL/NONE/STARTER (no live status) gives `{ ok: true, plan: "COMP", trialEndsAt: null }`; grant on COMP is refused ("already COMP"); grant with `subscriptionStatus` `active`, `trialing` or `past_due` is refused with a reason mentioning cancelling in Stripe, while `canceled` and `null` are allowed; revoke on a non-COMP workspace is refused; revoke with `subscriptionStatus` `active`, `trialing` or `past_due` is refused (reason: live subscription, resolve it in Stripe first), while `canceled` and `null` are allowed; revoke COMP with a future `trialEndsAt` gives `TRIAL` keeping that date, with a past or null one gives `NONE`; extend with a future end adds the days to it, with an expired end adds them to `now` and sets `plan: "TRIAL"`, on `NONE` with null end adds to `now`; extend on COMP is refused; extend with a live subscription is refused; extend with `days` not in `EXTEND_PRESETS` (for example 0, -7, 30, 7.5) is refused.
- [ ] **Step 2: Run** `npx tsx --test tests/admin-plan-rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Export `isLiveStatus`** from `lib/billing-rules.ts` (reusing `LIVE_STATUSES`) and implement the three functions.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Add the Prisma model and migration** (`npm run prisma:migrate` locally to generate it; keep the generated folder name pattern `2026…_add_admin_audit_log`); `npm run prisma:generate`.
- [ ] **Step 6: Verify** `npm test`, `npx tsc --noEmit`.
- [ ] **Step 7: Commit** `feat(admin): plan-change rules and audit log table`

### Task 6: Plan actions and their UI

**Files:**
- Modify: `app/admin/actions.ts`, `lib/validations.ts`, `app/admin/users/[id]/page.tsx`
- Create: `components/admin-plan-actions.tsx`

**Interfaces:**
- Consumes: `requireAdminAction` (Task 1), `decideGrantComp`/`decideRevokeComp`/`decideExtendTrial`/`EXTEND_PRESETS` (Task 5), `lockWorkspace` (`lib/quota.ts`), `syncWorkspaceFromStripe` (`lib/billing.ts`).
- Produces: `type AdminPlanActionState = { error?: string; success?: string }`; every action form carries a hidden `opId` (a UUID generated when the form renders) validated by the Zod schemas; actions `adminGrantComp`, `adminRevokeComp`, `adminExtendTrial`, each `(prev: AdminPlanActionState, formData: FormData) => Promise<AdminPlanActionState>`; Zod schemas `adminWorkspaceActionSchema` (`workspaceId` non-empty string) and `adminExtendTrialSchema` (adds `days` coerced to one of `EXTEND_PRESETS`) in `lib/validations.ts`.

- [ ] **Step 1: Implement the three actions.** Each: `requireAdminAction()`, parse with Zod (invalid gives `{ error: "Invalid request." }`), then in `prisma.$transaction` call `lockWorkspace(tx, id)`, first look up an `AdminAuditLog` with the same `opId` and, if found, return its original `{ success }` without changing anything (a double submit is idempotent), then re-read the workspace (`plan`, `trialEndsAt`, `subscriptionStatus`), apply the matching `decide*`; on `ok: false` return `{ error: reason }`; on `ok: true` update `plan` and `trialEndsAt` and insert an `AdminAuditLog` row (`action` is `GRANT_COMP`, `REVOKE_COMP` or `EXTEND_TRIAL`; `before` and `after` hold `plan`, `trialEndsAt`, and `days` for the extension) in the same transaction. `adminRevokeComp` does not call Stripe: revoke is refused while a subscription is live, so the rule's result is final. Then `revalidatePath("/admin")` and `revalidatePath("/admin/users/" + userId)` where `userId` is a hidden field with the id of the page being viewed.
- [ ] **Step 2: UI.** `components/admin-plan-actions.tsx` (client, `useActionState`): shows the stored and effective plan, a "Give COMP plan" button (or "Revoke COMP" when COMP), and a trial-extension form with the two presets, disabling what the rules would refuse and showing the reason text. Each button asks for a native-free confirmation by a second click ("Confirm"). Place it on the user page, beneath the workspace section, and list the last 10 `AdminAuditLog` rows for that workspace below it.
- [ ] **Step 3: Test the action path against the database** (dev DB or a throwaway one): grant COMP on a TRIAL workspace; extend an expired trial and confirm `plan` is `TRIAL` and the effective plan is `TRIAL`; extend again and confirm the date moved from the new end; revoke COMP and confirm `TRIAL` or `NONE` as the rules say; try grant, and revoke COMP, on a workspace whose `subscriptionStatus` is set to `active` and confirm the refusals and that no audit row was written; submit the same extension twice with the same `opId`, sequentially and concurrently, and confirm the date moved once and only one audit row exists; with different `opId`s two extensions apply in sequence. Confirm that calling an action while signed out or as a non-admin throws `Forbidden` and changes nothing.
- [ ] **Step 4: Verify** `npm test`, `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 5: Commit** `feat(admin): grant/revoke COMP and extend trial, with audit log`

### Task 7: Payments page

**Files:**
- Create: `app/admin/payments/page.tsx`
- Modify: `lib/admin-stripe.ts`

**Interfaces:**
- Consumes: `getStripe`, `createTtlCache` (Task 3), `planFromLookupKey` (`lib/entitlements.ts`), `requireAdmin`.
- Produces in `lib/admin-stripe.ts`: `getPaymentsOverview(now?: Date): Promise<{ ok: true; subscriptions: SubscriptionRow[]; charges: ChargeRow[]; failed: ChargeRow[]; fetchedAt: Date } | { ok: false }>` (same 5-minute cache and failure handling as `getMonthRevenue`; reads only: `subscriptions.list({ status: "all", limit: 100 })` and `charges.list({ created: { gte: thirtyDaysAgo }, limit: 100 })`, each with `autoPagingToArray({ limit: 2000 })`; `charges` is the 50 newest of those and `failed` is filtered from all of them), where `SubscriptionRow = { id; customerId; status; plan: PlanId | null; interval: string | null; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean }` and `ChargeRow = { id; customerId: string | null; amount; currency; status; paid; refunded; failureMessage: string | null; created: Date }`.

- [ ] **Step 1: Implement `getPaymentsOverview`.** `failed` is the charges with `status === "failed"` among all charges of the last 30 days, not only the 50 shown.
- [ ] **Step 2: Page.** `requireAdmin()` first; table of subscriptions (plan, status, period end, cancel flag), recent charges, and failed payments; each customer id resolved to the owning workspace's owner email through one `prisma.workspace.findMany({ where: { stripeCustomerId: { in: ids } } })`, linking to `/admin/users/<ownerId>`. When `ok` is false show "Stripe unavailable. Try again in a few minutes." and nothing else breaks.
- [ ] **Step 2b: Verify** with the key unset that the page shows the unavailable message, and with a test-mode key that rows and links appear. `npm run lint`, `npx tsc --noEmit`.
- [ ] **Step 3: Commit** `feat(admin): payments page read from Stripe`

### Task 8: Analytics page

**Files:**
- Create: `app/admin/analytics/page.tsx`

**Interfaces:**
- Consumes: `bucketByWeekUtc`, `countByEffectivePlan` (Task 2), `monthStartUtc`, `requireAdmin`.

- [ ] **Step 1: Page.** `requireAdmin()` first. Three blocks, drawn with plain Tailwind bars (no chart library): signups per week for the last 12 weeks (owners' `User.createdAt` through `bucketByWeekUtc`), users by effective plan (`countByEffectivePlan` over all workspaces), and committed AI usage for the last 6 months by month and `kind`, aggregated in PostgreSQL (`prisma.$queryRaw` with `date_trunc('month', "createdAt" AT TIME ZONE 'UTC')`, `status = 'COMMITTED'`), not by loading rows into Node. Each block states what it counts.
- [ ] **Step 2: Verify** with seeded data (`npm run prisma:seed`) that the bars render, an empty database renders zeros without errors, and `npm run lint` and `npx tsc --noEmit` pass.
- [ ] **Step 3: Commit** `feat(admin): analytics page`

### Task 9: Docs, full check and deploy notes

**Files:**
- Modify: `CLAUDE.md`, `README.md` (only where it mentions the admin password)

- [ ] **Step 1: Update `CLAUDE.md`:** the "no test runner" line becomes `npm test` (`tsx --test tests/*.test.ts`), and the admin surface is described as gated by `ADMIN_EMAILS` through `lib/admin-auth.ts` (with the four helpers and the rule that every admin page, route handler and action checks for itself because middleware lets `/admin` through).
- [ ] **Step 2: Full check:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; all pass.
- [ ] **Step 3: Write the deploy checklist in the commit body and the final report (do not deploy without asking):** set `ADMIN_EMAILS=jfca68@gmail.com` in `/opt/diyseo/.env` before the deploy; the deploy runs `prisma:migrate:deploy` for `AdminAuditLog`; after deploy confirm `/admin` is a 404 signed out and works for the admin; only then remove `ADMIN_PASSWORD` from the server env.
- [ ] **Step 4: Commit** `docs(admin): document the ADMIN_EMAILS gate and the real test command`
