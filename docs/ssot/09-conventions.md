# Repository conventions
Status: Draft | Last updated: 2026-11-24

## Verified layout
- `src/app/`: App Router; existing layout.tsx, page.tsx, globals.css, page.module.css and favicon.ico.
- `public/`: starter SVG assets.
- Root: package.json/package-lock.json, tsconfig.json, next.config.ts, eslint.config.mjs, .gitignore and AGENTS.md.
- `node_modules/`, `.next/` and ignored .env.local exist locally; generated/dependency files are not source.
- No database code, schema or migrations existed at initial audit.
- Phase 1 adds `src/db/index.ts`, `src/db/schema/index.ts`, `src/app/api/health/db/route.ts`, root drizzle.config.ts and `docs/ssot/`.
- `drizzle/` is the configured migration output directory; no business migration is required for an empty schema.

## Implementation rules
- Use strict TypeScript (already enabled); `@/*` resolves to `./src/*`.
- Preserve Next.js special filenames (page.tsx, layout.tsx, route.ts). Other file naming remains undecided.
- Server Components are the default; use client boundaries only where interactivity requires them. Database and provider secrets remain in server modules. Do not pass secrets through serialized props.
- Product styling uses SCSS, no Tailwind. Phase 2 replaces starter CSS with src/app/globals.scss for the minimal login/application shell and uses a system font without build-time font downloads. Broader styling organization remains open.
- API failures use generic responses; retain useful sanitized diagnostics only in server logs.
- Read relevant installed Next.js guides before writing framework code and heed deprecations.
- Update SSOT in the same commit whenever decisions change.

## Commit and branch notes
Initial working tree has pre-existing modifications to package.json and package-lock.json. Preserve unrelated user changes. No commit, branch rename or push is part of Phase 1. Commit message and branch naming conventions are not specified in the brief.

## Open questions
- Feature-folder organization and general file naming conventions.
- SCSS modules/global styles, tokens and styling organization.
- Commit format, branch workflow and review/merge policy.

## Phase 2 layout
`src/lib/supabase/` contains config, browser/server clients and session refresh. `src/lib/auth.ts` verifies users; `src/lib/profiles.ts` authorizes the profile upsert. `src/proxy.ts` is the Next.js 16 request protection entrypoint. `src/app/login/` is public; `src/app/(protected)/` contains the authenticated layout, dashboard and logout action. Root error.tsx uses the installed Next.js `retry` callback. `src/db/schema/` contains reusable columns and profiles; only managed public tables are exported from its index. `scripts/verify-db-foundation.mjs` prints env-name presence and safe catalog flags only. `drizzle/drafts/phase-2-foundation.sql` is an unqueued draft, not an applied or generated migration.

## Approved Phase 3A data conventions (2026-11-24)
src/lib/data/ holds server-only company/contact/lead CRUD and common safe errors. Under the approved Phase 3A revision, functions take plain inputs and never perform auth themselves. Future actions call the existing auth helper first; future webhooks verify provider signatures/tokens first. No AuthenticatedContext/getDataContext interface remains. Shared pure modules: lead-values.ts, normalize.ts, contact-merge.ts and validation.ts. tests/*.test.mjs use Node's test runner and direct TypeScript imports; npm test accesses no environment file or database.

Lists accept optional literal substring search, page (1 through 1,000,000), pageSize (1 through 100, default 25). Lead lists filter status/source/contact; contact lists filter company. Companies search name; contact and lead searches use contact name/phone/email, including stored normalized identifiers. Wildcards in search text are escaped. Order is created_at descending, then UUID descending. Offset pagination and count/items are separate queries: concurrent writes may change totals between them. Lead DTOs return budgetPaise as decimal strings; database operations retain bigint. Other DTO timestamp values are Date objects, serialized by the framework/JSON boundary.

Known data-layer conflict behavior: conflicting phone/email owners require manual resolution; existing-contact merges are not implemented. Soft deletion never cascades, and parent visibility does not silently hide live child entities. Relationship changes validate/lock a live parent. No restore API, hard-delete API, assignment fields, activity creation or business UI/routes are introduced.

Phase 3A migration work is manual: generate/review schema SQL, then append drizzle/drafts/phase-3a-triggers.sql to the generated migration before application. Check .enableRLS() output and source/status/lost/contact-method checks plus partial uniqueness/FK/index definitions. Draft supplements are never automatically executed. The old Phase 2 draft is superseded; 0002 is the forward repair for the empty recorded 0001.

## Phase 3B UI layout (2026-11-24)
`src/app/(protected)/companies/`, `contacts/` and `leads/` each have list, new and [id] routes. Private `_crm/` modules contain shared forms, navigation, pagination, server page components, read helpers and server actions; `crm.scss` provides responsive tables/forms/navigation using the existing system font. Protected loading and not-found files provide route feedback. List/detail/new page reads independently await requireUser() inside Suspense boundaries; no user data is globally cached. Every exported mutation action calls requireUser() before any data function, validates shared Zod input, sanitizes errors and revalidates affected list/detail/new paths. Delete actions require an explicit confirmation checkbox and only soft-delete.

Lead actions force entry_method=manual. New enquiry forms delegate contact reuse and lead insertion to createLeadWithContact; success links the reused contact and conflicts surface without merging existing contacts. Inline company creation is a separate explicit save before enquiry submission: it remains saved if the enquiry is abandoned or fails. Company selectors currently load all active companies; an unavailable existing company link is retained unless changed. Related leads remain available when their contact is soft-deleted, per data-layer conventions.

`src/lib/money.ts` parses ungrouped non-negative rupee strings into bigint paise (at most two decimal places, signed PostgreSQL bigint upper bound), formats Indian grouping via Intl on bigint, and round-trips editable values without Number conversion. Blank budget is null. Monetary number inputs are rejected. `tests/money.test.mjs` adds pure conversion/formatting tests. Existing legacy negative budgets can display but must be changed or cleared to save through this UI. General count/page arithmetic remains numeric and is unrelated to money.
