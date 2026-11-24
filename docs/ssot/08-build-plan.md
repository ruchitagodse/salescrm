# Build plan
Status: Approved | Last updated: 2026-11-24

## Phases and status
| Phase | Objective | Status |
| --- | --- | --- |
| 1. PostgreSQL setup and connection | Server-only Drizzle client, separate migration configuration and verified health query | In progress |
| 2. Auth and DB foundation | Invite-only Supabase login, equal authenticated access, server authorization, profiles and RLS | In progress |
| 3. Lead and contact management | Phase 3A schema/data layer and Phase 3B companies/contacts/leads UI implemented; manual browser acceptance pending | In progress |
| 4. Sales pipeline | Deal/stage workflows | Not started |
| 5. Activities and follow-ups | Sales actions and follow-up work | Not started |
| 6. Quotations, orders, payments, expenses | Commercial and financial records | Not started |
| 7. Analytics | Revenue/business reporting and charts | Not started |
| 8. Meta ads, Instagram and WhatsApp integrations | Verified provider lead/message intake; API versions/permissions/app review and idempotency undecided | Not started |
| 9. AI business analyst | Server-side Gemini analysis and sales recommendations | Not started |
| 10. Testing and deployment | Integrated validation and Vercel deployment | Not started |

## Working protocol
One phase at a time, in small working increments. Before coding, state objective, files and dependencies. Implement, then run `npx tsc --noEmit`, `npm run lint`, `npm run build` and phase-specific runtime checks. Report actual results, untested behavior, limitations and proposed next step. Stop and wait for Ruchita's confirmation before the next phase. Update this file after every phase; never claim unrun checks passed.

## Phase 1 verification
Implementation is present, but Phase 1 is not complete:
- `npx tsc --noEmit`: passed, including the final rerun after the diagnostic change.
- `npm run lint`: passed, including the final rerun after the diagnostic change.
- `npm run build`: failed fetching the starter's Geist/Geist Mono Google fonts. Out-of-sandbox retry was rejected; no successful production build is claimed.
- `npx drizzle-kit generate`: failed with sandbox `spawn EPERM` while loading config. Out-of-sandbox retry was rejected. Migration generation/config execution remains unverified; no migration was applied.
- Dev server: sandbox launch failed with `spawn EPERM`; authorized out-of-sandbox launch succeeded at 127.0.0.1:3100.
- `Invoke-RestMethod` health requests: HTTP 500. Server-side sanitized cause chain reports PostgreSQL `28P01` (authentication rejection). Generic response confirmed; successful `select now()`/serverTime remains unverified.
- Shutdown: Ctrl+C sent and dev-server command exited; a subsequent HTTP probe confirmed no listener responds on port 3100.
- `git diff --check`: passed (line-ending notices only).

No environment file was inspected and no credentials were modified. No business tables, Auth flows or Phase 2 work were started. Runtime and migration URL host/port configuration is specified in code/docs but not independently inspected. Correct runtime authentication privately and rerun outstanding checks before marking Phase 1 complete.

## Phase 2
Authorized by Ruchita on 2026-11-24 despite incomplete Phase 1 verification. Approved decisions: invite-only owner-created accounts; no roles/permissions; bigint INR paise; business soft deletion; shared updated_at trigger. Restore scaffold Cache Components/partial prefetching and use connection() for the authenticated health route. Implement Supabase SSR cookie clients, src/proxy.ts and independent server checks; profiles only, no business tables. Actual verification results are below. Phase 3 requires explicit confirmation.

### Phase 2 actual results (2026-11-24)
Implementation files are present; Phase 2 is incomplete and is not approved as working:
- Dependency install failed with ENOTCACHED; requested escalation was rejected. Neither Supabase package is installed. Declared ranges are not installed-version claims, and package-lock.json is not synchronized for these additions.
- Environment-name presence only: DATABASE_URL, DATABASE_URL_MIGRATIONS and NEXT_PUBLIC_SUPABASE_URL present; NEXT_PUBLIC_SUPABASE_ANON_KEY missing. No values were displayed.
- TypeScript failed with four TS2307 errors for the missing Supabase packages; no other TypeScript diagnostics were reported in that run. This does not verify types once dependencies are available.
- Lint passed, including the final rerun after code changes.
- Build failed. Initial run also rejected runtime = 'nodejs' with Cache Components; that export was removed per the installed guide. Final build reported only unresolved @supabase/ssr imports. No build pass or Google font fetch is claimed; the Google font imports were removed.
- drizzle-kit generate failed with spawn EPERM despite exit code 0 on one attempt. Escalation was rejected. Generated metadata is not fabricated. drizzle/drafts/phase-2-foundation.sql is a reviewed, unqueued SQL draft only, containing profiles, RLS, FK, shared timestamp function and trigger. No policies or business tables are included.
- npm run db:migrate exited 0 with an empty journal: no profiles migration was applied. This is a no-op, not a successful Phase 2 schema deployment.
- node scripts/verify-db-foundation.mjs connected using DATABASE_URL_MIGRATIONS and queried pg_class/pg_policies/pg_trigger. Actual catalog flags: profiles_exists=false, rls_enabled=false, policy_count=0, updated_at_trigger=false. The script correctly exited 1. Session pooler authentication/connectivity succeeds; profiles/RLS/trigger verification fails because the schema is absent.
- Dev launch in sandbox failed with spawn EPERM. Escalated launch reached ready then exited because an existing user-owned dev server (port 3000) holds the project lock; that server was left running. A logged-out GET / against port 3000 returned HTTP 500, not a login redirect. Auth protection is not runtime-verified while dependencies are absent. Temporary port 3100 has no listener.
- git diff --check passed with line-ending notices only; .env.local remains ignored. No secrets were read/displayed/committed and no commit was made.

### Remaining Phase 2 work and manual verification
1. Install the requested Supabase packages and synchronize the lockfile: npm install @supabase/supabase-js @supabase/ssr. Record exact installed versions in 03-tech-stack.md.
2. Owner privately supplies NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local; do not paste or print values. Keep public sign-ups disabled. The account must already have a usable email/password established through the dashboard/provider; this app has no invite callback or password recovery flow.
3. Run npm run db:generate in an environment permitting the compiler process. Review generated SQL: only public.profiles is managed, auth.users is referenced but not created/altered, RLS enabled, no policies. Append the reviewed set_updated_at function/trigger from the draft to the generated migration. Do not apply the draft separately or fabricate snapshots/journal entries.
4. Run npm run db:migrate; then node scripts/verify-db-foundation.mjs must report profiles_exists=true, rls_enabled=true, policy_count=0 and updated_at_trigger=true. Verify the runtime DB role can insert profiles with RLS enabled and no policies; no browser-side policies should be added.
5. Rerun npx tsc --noEmit, npm run lint and npm run build, resolving any further installed-version issues before marking Phase 2 complete.
6. With a working dev server, open an incognito window and request /. Confirm redirect to /login. Confirm unknown paths and /api/health/db also redirect when logged out; static assets remain accessible.
7. At /login, submit the owner's invited account email/password privately. Confirm / shows the correct email; refresh and revisit / to verify cookie persistence. Confirm exactly one matching public.profiles row exists; existing profiles must not be overwritten by subsequent visits. A separate browser account must never see this user's email.
8. Confirm a wrong password and unknown email receive the same generic message, with no sign-up UI/route. While authenticated, /api/health/db should return ok=true and serverTime. Sign out, confirm /login, then revisit / and the health endpoint to verify access is denied. Test expired-session refresh when possible; do not record session cookies or credentials.
9. Test updated_at maintenance with a controlled profile update in a database transaction and rollback; verify ON DELETE CASCADE only against a disposable test account. These behaviors are specified by the draft but not live-tested here.

Known limitations: all authenticated users have equal access with no roles or per-record permissions; invite provisioning/password establishment is manual; account removal/session revocation, password recovery, advanced session policy and runtime DB least-privilege design remain open. No business tables were created. Stop before Phase 3.

## Open questions
- Outstanding Phase 1 and Phase 2 verification must be reported honestly before proceeding.

## Phase 2 repair and Phase 3A authorization (2026-11-24)
The empty 0001_updated_at_trigger.sql did not install a function or trigger. Live catalog inspection confirmed both absent, not just a name mismatch. Forward SQL-only migration 0002_repair_profiles_updated_at preserves prior migration history, creates public.set_updated_at() and attaches the profiles trigger; its snapshot intentionally leaves the table schema unchanged. npm run db:migrate exited 0 with a success marker. Updated verifier checks an enabled BEFORE UPDATE row trigger targeting the shared public function, rather than a fixed trigger name. Preflight rerun passed: profiles exists, RLS true, policy count zero, function/trigger true. npx tsc --noEmit also passed. Phase 3A may proceed under Ruchita's explicit conditional authorization. This does not imply every historical Phase 2 browser acceptance check passed.

Phase 3A scope: three business schemas, shared value sets/normalization/Zod validation, authenticated server-only CRUD and transactional enquiry/contact deduplication, pure unit tests. No UI/routes and no Phase 3 migration generation or application. Actual verification results follow; stop before 3B.

### Phase 3A implementation and actual checks
Initial Phase 3A added companies/contacts/leads with shared columns, RESTRICT FKs, RLS, CHECKs and indexes; shared normalization/Zod schemas; safe-error CRUD/search/filter/pagination; and transactional fill-only enquiry matching. The initial opaque AuthenticatedContext design is superseded by the approved plain-input caller boundary. Lead DTO budgets remain decimal strings. No Phase 3 UI/routes were added or changed.

- Preflight: passed after applying only the Phase 2 forward repair. Final verifier flags: profiles_exists=true, rls_enabled=true, policy_count=0, updated_at_trigger=true, timestamp_function_exists=true. Trigger names: profiles_set_updated_at. TypeScript preflight passed before Phase 3A began.
- npx tsc --noEmit after implementation: passed.
- npm run lint after implementation: passed, including the final rerun after verifier refinement.
- npm test: 18 tests passed, zero failures. Covers India/international normalization, invalid/empty identifiers, idempotence, same/split matches, fill-only preservation, conversion timestamp transitions, exact bigint budgets and bounds, contact reachability, unknown/forged fields, status/source sets, lost reasons, calendar dates and update/pagination validation.
- The initial default Node test runner was blocked by EPERM spawning workers; elevated retry was rejected. The final supported test-isolation=none mode ran these pure tests successfully inside the sandbox. Node prints a harmless module-type inference warning; the package-wide module mode was not changed.
- npm run build: compiled successfully; then failed spawning the TypeScript worker with EPERM. Elevated retry was rejected. Full production build/prerender pass is not claimed; independent TypeScript checking passed.
- git diff --check passed with line-ending notices only. .env.local remains ignored; only variable-name presence was printed by the verifier. No env values, credentials or connection strings were read/displayed/committed; no commit was made.

Only the authorized Phase 2 trigger repair changed the live database. The Phase 3A data functions were not invoked, and no business-table migration was generated or applied. Live CRUD/search/pagination, DB CHECK/unique/FK enforcement, transaction rollback, contention/retry behavior and business-table RLS/timestamp triggers remain untested. Existing browser/session acceptance tests were not rerun.

### Exact owner commands and SQL review before Phase 3B
Run locally from C:\Ruchita\psas:

```powershell
npx drizzle-kit generate
```

Review the NEW generated migration before applying it. It must only manage companies/contacts/leads (not recreate profiles/auth.users), include UUID/timestamptz/bigint/date columns, entry_method (NOT NULL, default manual), nullable source_detail, RESTRICT FKs, both live-only non-null contact UNIQUE indexes, the requested btree indexes, the contact-method CHECK, source/status/entry-method CHECKs matching the shared arrays (including meta_ads) and the lost_reason CHECK. Verify ENABLE ROW LEVEL SECURITY on all three tables with NO policies. If RLS statements are absent despite .enableRLS(), add explicit ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY statements. Append the statements in drizzle/drafts/phase-3a-triggers.sql AFTER the table DDL to attach the already-existing shared set_updated_at() function, omitting triggers already present in prior applied migrations. The supplement is not an automatically queued migration. Do not apply the superseded Phase 2 draft.

Then run:

```powershell
npm run db:migrate
npx tsc --noEmit
npm run lint
npm test
npm run build
```

After migration, verify all three RLS flags, zero policies, timestamp triggers and constraints before exercising CRUD through a caller that authenticates users or verifies provider signatures. No test records have been inserted by the agent. Phase 3 remains In progress while migration/live checks and full build are pending. Phase 3B requires Ruchita's confirmation.

Open questions carried forward: merging existing contacts/split-match resolution; parent/child soft-delete and restore UX; restore collisions on unique identifiers; negative-budget rules and additional status transition restrictions; broader session/database-role least privilege and later-phase entity workflows. No ownership/assignment or activity features are included.

### Approved Phase 3A revision: manual entry and future provider intake (2026-11-24)
Reconfirmed preflight first: profiles, RLS, zero policies, shared timestamp function/trigger and npx tsc --noEmit all passed. This revision adds meta_ads to the single source array, adds entry_method with a shared manual/integration CHECK and default manual, and adds nullable source_detail. Phase 3 is manual entry in OS; Meta ads/Instagram/WhatsApp intake remains Phase 8. All data functions now accept plain inputs, perform no auth and retain server-only guards; the obsolete context module/export is removed. Callers authenticate users (3B) or verify provider signatures (8) first. The enquiry transaction, normalization, fill-only matching, soft-delete filtering and bigint serialization are retained.

Checks for this revision: post-edit TypeScript passed; lint passed; npm test passed 21 tests including metadata defaults, integration input and partial-update preservation. Build compiled successfully then failed at worker spawning (EPERM); elevated retry was rejected, so full production build is unverified. git diff --check passed and .env.local remains ignored. No migration generation/application, UI/routes, live CRUD calls or database writes were performed. Preflight only read the existing foundation. No env values were inspected/displayed and no commit was made.

New/open Phase 8 questions: webhook idempotency and replay keys (the enquiry transaction creates a lead for every call and is not a webhook idempotency mechanism); Meta lead-ads permissions/app review/API version; attribution of integration-created leads and campaign/ad/form/provider identifiers. Existing-contact merges remain out of scope. Generate/review/apply SQL using the commands above before live CRUD verification. Stop before Phase 3B.

## Phase 3B UI implementation (2026-11-24)
Runtime follow-up: /leads failed because both configured database connections lack leads.entry_method and leads.source_detail (sanitized read-shape query: PostgreSQL 42703). Local 0004_daffy_the_twelve.sql includes both columns and the entry-method/source CHECK updates, but its hash is absent from the live migration journal. UUID defaults alone did not establish that this entire migration was applied. Added optional `node scripts/verify-db-foundation.mjs --business` checks for business table RLS/UUID defaults/zero policies and every lead column used by the application; it correctly fails and lists only the two missing column names. Generic data errors now log whitelisted PostgreSQL codes from the cause chain, never raw messages/SQL/parameters/URLs. TypeScript and lint passed. No migration was applied and the runtime issue remains pending owner migration application under the Phase 3B no-migrations constraint. Run `npm run db:migrate`, then `node scripts/verify-db-foundation.mjs --business` (expected: exit 0 and missingLeadColumns=[]), and reload /leads. No schema generation is necessary for the existing pending SQL.

Authorization: Ruchita requested continuation after applying UUID defaults. Preflight passed: profiles/RLS/zero policies/shared trigger verified; companies, contacts and leads each exist with RLS and gen_random_uuid() defaults; npx tsc --noEmit passed. Data functions already used plain input with no session/user argument, so no auth signature refactor was needed. No environment values were read or printed.

Increment 1 implemented the protected navigation, responsive SCSS shell, company/contact lists with literal search and pagination, create/detail/edit forms, safe inline validation, duplicate-company warnings, company links and contact-related leads, and confirmed soft deletion. TypeScript and lint passed after this increment.

Increment 2 implemented lead search/status/source filters and newest-first rows, badges and exact INR budgets; the combined enquiry form with company selection or a separately saved inline new company; reused-contact success links and safe split-match errors; detail/edit/status/lost-reason flows and confirmed soft deletion. Server actions authenticate first, validate shared schemas, force manual entry and revalidate affected paths. Conversion timestamps remain managed by the data layer. Existing deleted parent links are preserved on unrelated edits.

Actual checks:
- Preflight foundation script, business catalog query and TypeScript: passed.
- Increment 1 TypeScript and lint: passed.
- Increment 2 TypeScript initially found two inferred-field type errors in the form-value helper; const-generic key typing fixed them. Final npx tsc --noEmit and npm run lint both passed.
- npm test: 25 tests passed, including four new pure money tests for exact conversion, non-negative/two-decimal validation, signed-bigint bounds, Indian grouping and round-trip precision above Number.MAX_SAFE_INTEGER.
- Initial sandbox npm run build compiled then failed with worker spawn EPERM. The environment-required elevated retry revealed the same typing errors; after the fix the authorized full build passed compilation, TypeScript, page-data collection and prerendering of all 15 pages. Protected CRM pages use partial prerendering with dynamic streamed content; no clock/prerender error was reported.
- git diff --check passed, including final whitespace review after documentation updates. .env.local remains ignored. No new dependencies, migration generation/application, browser interaction, business-record submission or commit was performed by the agent.

Implementation passes static/unit/build checks; interactive UI, real form writes, auth expiry, validation focus behavior, mobile layout and accessibility have not been exercised in a browser. All authenticated users still have equal access. Selectors load all active companies, and inline company saves are separate from the enquiry transaction. No restore/import/integration, deal/pipeline, activity, role or existing-contact-merge features were added. Phase 4 has not started.

### Manual browser acceptance before Phase 4
Run `npm run dev` if the dev server is not already running (expected: Ready and a local URL), then sign in privately at /login. Visit /companies, /contacts and /leads; verify navigation, empty states, search, filters, pagination, keyboard focus and a narrow/mobile viewport. Create/edit a company and create a case-variant duplicate: saving must succeed with a warning. Create a contact, verify company association/detail links, and confirm the last contact method cannot be removed. Create an enquiry with budget 125000.50 and optional selected/new company; verify ₹1,25,000.50. Repeat its phone/email and confirm a new lead is added to the existing contact without overwriting known fields. Use phone/email belonging to different contacts and verify a safe error with no partial lead write. Test all statuses, mandatory lost_reason, converted_at, contact-related lead links and refresh persistence. Confirm each soft-delete checkbox step and disappearance from normal lists; retained child records and unavailable-parent notices are expected. Log out and confirm protected URLs/actions cannot access data. No migration commands are required for this UI increment. Stop before Phase 4 pending Ruchita's review.

## Latest Phase 2 regression fix: prerender clock access (2026-11-24)
Ruchita reported a blocking Date.now() prerender diagnostic at AuthenticatedShell. Added await connection() at the start of the shared getAuthenticatedUser helper, outside the broad catch, and deferred the profile's database module import until after requireUser(). This ensures Auth/driver initialization runs at request time while preserving Cache Components and Suspense. No dependencies or business schema were changed in this fix.

Actual checks for this fix:
- npx tsc --noEmit: passed.
- npm run lint: passed.
- npm run build: compilation passed, then worker spawning failed with EPERM during TypeScript. Escalated retry was rejected. Complete build/prerender verification remains untested.
- Logged-out GET / on the existing dev server at port 3000: HTTP 307 with Location /login. The server was left running.
- git diff --check: passed with line-ending notices only.
- Installed packages are now @supabase/ssr 0.6.1 and @supabase/supabase-js 2.119.2; the earlier absent-dependency results are historical.
- Manual: refresh / while signed in and confirm the Date.now() overlay is gone and the dashboard opens; no authenticated browser session or credentials were accessed by the agent. Existing migration/Phase 2 acceptance checks are not rerun or assumed to pass.

No .env.local contents were read or displayed; no secrets were printed or committed. Phase 3 has not started.
