# DIYSEO hub: admin panel (users, billing, analytics, dashboard)

Date: 2026-11-10. Scope: the DIYSEO hub app only (this repo). Ads (`castelo-marketing`) and the other satellites are out of scope for this version.

## Intent and why

There is no way to see how the business is doing without opening the database or Stripe by hand: who signed up, who is paying, whose trial is about to end, how much was collected this month. The owner wants an admin area like the one on mycarplate.online (`~/Projects/mycarplate-www`, `app/(site)/admin`): Overview, Users with a per-user page, Analytics, a payments page, in a dark admin shell. It is for the owner to look at, mostly, with two actions: give a workspace the COMP plan and extend a trial.

## Current state

- `/admin` already exists in the hub (`app/admin`): dashboard (`page.tsx`), `users`, `sites`, `content`, `backups`, with `AdminShell` (`components/admin-shell.tsx`, nav: Dashboard, Users, Sites, Content, Backups).
- It is gated by one shared password: `ADMIN_PASSWORD` env, cookie `diyseo-admin-session` (`lib/admin-auth.ts`, `AdminLogoutForm`), independent from the Google login.
- Data in Prisma: `User`, `Workspace` (plan, trialEndsAt, stripeCustomerId, subscriptionStatus, planSyncedAt), `WorkspaceMember`, `AiUsage`, `SiteProject`, `Article`, `Keyword`, `WaitlistEntry`. A workspace has exactly one owner and each user belongs to one workspace.
- The plan is a projection of Stripe (`lib/billing.ts`, `projectPlan`); `lib/entitlements.ts` defines `TRIAL | STARTER | PRO | AGENCY | COMP | NONE` and `effectivePlan`; COMP is never billed and has no limits. Plan prices are in `lib/plans.ts`. Stripe client: `lib/stripe.ts` (`getStripe`).
- The auth session is NextAuth v5 with Google (see project `CLAUDE.md`).
- Satellites (`castelo-marketing`, MCP) authenticate against the hub by SSO and keep their own data. Not touched here.

## Goals

1. Only users on an admin list see the Admin menu and can open `/admin/*`. The list starts as `jfca68@gmail.com`. They sign in with their normal Google session.
2. **Dashboard:** without clicking, the owner sees (a) revenue this month, (b) new users, (c) trials about to end, each linking to the relevant users.
3. **Users:** searchable list and a page per user: plan, effective plan, subscription status, trial end, workspace, members, AI usage, sites, articles, Stripe customer.
4. **Payments:** subscriptions and their status, recent charges, failed payments, read from Stripe.
5. **Analytics:** signups over time, users by plan, AI usage. Concrete metrics are left to the builder.
6. **Two write actions:** give a workspace the COMP plan, and extend a trial. Both leave an audit record.
7. Everything else is read-only.

## Non-goals

- Ads campaign data, spend or errors; any other satellite's data. The hub will have to ask each satellite later; not now.
- Suspending or deleting accounts, refunds, editing prices, changing Stripe subscriptions, impersonating users.
- Replacing Stripe's own dashboard.

## Anti-goals

- A non-admin must never see admin data or learn that the admin area exists (no menu item, same response as an unknown route).
- COMP or a trial extension must not be undone by the next Stripe sync. The plan is a projection of Stripe, so the sync (`projectPlan`) must respect these two states.
- Stripe being slow or down must not break the Dashboard or Users pages; only the revenue figure degrades, visibly.
- Admin pages must never leak into the public blog or widget feed, and the existing admin pages (sites, content, backups) must keep working.
- No secret (Stripe keys, tokens) is ever rendered or sent to the browser.

## Decisions made with the user

- Hub only, whole-suite admin, Ads later.
- Admins are identified by their Google account; first admin is `jfca68@gmail.com`. They see the admin menu.
- Mostly read-only; actions: grant COMP, extend trial.
- Dashboard shows: revenue of the month, new users, trials about to end.
- Revenue is read from Stripe (actual charges), cached for a few minutes. An estimate (active subscriptions x plan price) is shown beside it as contrast.
- DIYSEO's Stripe account is separate from MyCarPlate's, so revenue and charges are read from the account behind `STRIPE_SECRET_KEY` with no product filtering.
- Look and sections follow the MyCarPlate admin (Overview, Users, Analytics, payments, Settings).

## My calls (the user did not decide these)

- The shared `ADMIN_PASSWORD` gate is removed and replaced by the admin list. The existing pages are reused and moved under the new gate rather than rewritten.
- The admin list lives in an env var (for example `ADMIN_EMAILS`, comma separated) so adding an admin needs no migration. Alternative: a boolean on `User`.
- Audit record for the two actions: who, when, target workspace, action, before and after values. Stored in a new table.
- Metrics for Analytics are chosen by the builder from data the hub already has.
- "Trials about to end" means ending within 7 days; the window is a constant.
- Dark admin shell like the current one; the MyCarPlate components are a visual reference, not code to copy.

### More calls, from the builder check

- **Plan sync needs no change for COMP or an unexpired trial:** `projectPlan` (`lib/billing-rules.ts`) already keeps COMP unconditionally and keeps a trial while `trialEndsAt` is in the future and there is no live subscription. The real work is at the edges below.
- **Extend trial:** a preset of 7 or 14 days, added to `max(now, trialEndsAt)`. If the trial had already expired, the action also sets `plan = TRIAL` (a stored `NONE` means no access, and the stored plan only changes on a Stripe webhook or checkout return). If the workspace has a live Stripe subscription, the action is refused with a clear message, because the subscription wins over a trial.
- **Grant COMP:** refused while the workspace has a live Stripe subscription (COMP would keep billing the customer); the panel tells the admin to cancel it in Stripe first.
- **Revoke COMP:** added, because `projectPlan` never leaves COMP and a mistaken grant would otherwise be permanent. It returns the workspace to `NONE` (or `TRIAL` if the trial is still in the future), with the same audit record.
- **The whole existing admin moves under the new gate:** not only the pages but `app/admin/backups/{download,restore,files/[filename]}` (they call `requireAdminAuth`), the login and logout actions in `app/admin/actions.ts`, and `components/admin-password-form.tsx`. `/admin` is in `PUBLIC_PREFIXES` in `middleware.ts`, so the gate lives in the layout, pages, routes and actions, and a non-admin gets `notFound()` instead of the password form.
- **Admin check:** `ADMIN_EMAILS`, comma separated, matched case-insensitively against the session email. An admin who has no workspace, or who is only a member, still counts.
- **Where the new actions live:** `app/admin/actions.ts` or a new admin actions file, not `lib/actions.ts`, since that is where the existing admin actions are. Zod schemas still go in `lib/validations.ts`.
- **Password removal:** the code and `.env.example` entry go; the `ADMIN_PASSWORD` variable on the OVH server stays until the new gate is verified in production.
- **Dashboard definitions:** "new users" are workspace owners created in the current UTC month (same UTC cut as `monthStartUtc` in `lib/entitlements.ts`), invited members excluded. Revenue is net of refunds, UTC month.
- **Audit table:** `AdminAuditLog(id, actorUserId, actorEmail, workspaceId, action, before Json, after Json, createdAt)`; `workspaceId` is not a hard foreign key, so the trail outlives a deleted workspace. Shown on the user page only.
- **Stripe cache:** production runs one PM2 process for the app (`ecosystem.config.js`), so a short in-process TTL cache is enough.
- **Tests:** the repo does have tests (`npm test` = `tsx --test tests/*.test.ts`); the line in `CLAUDE.md` saying there is no runner is out of date. The gate, the two actions, revoke, and the pure revenue and window logic get tests there.

## Constraints

- Follow the repo patterns (see `CLAUDE.md`): admin pages are server components scoped by the session; mutations are server actions in `lib/actions.ts` style with Zod schemas in `lib/validations.ts`; Prisma via `lib/prisma.ts`.
- Authorization is checked on the server for every admin page and every action, not only by hiding menu items.
- Next.js 15 App Router, React 19, Prisma (PostgreSQL), Tailwind. Tests run with `npm test` (`tsx --test`); see the call above on what gets tested.
- Production is the OVH server under PM2; migrations are applied with `prisma:migrate:deploy` before serving. Deploys go through GitHub Actions on push to `main`.
- Stripe is live: any Stripe call from the admin must be read-only.
- Currency: show the currency Stripe reports for each charge; do not assume one.

## Left to the builder

- Exact page layouts, charts and the analytics metrics.
- How the admin list is read and checked (a single helper used by layout, pages and actions).
- How the COMP and trial-extension states survive the Stripe sync.
- The cache for Stripe data (where, TTL of a few minutes) and what the UI shows when Stripe fails.
- Whether revenue includes refunds, and how the monthly window is cut (timezone).
- The shape of the audit table and whether it is shown anywhere.
- Migration of existing admin pages and removal of the password gate and its env var.
