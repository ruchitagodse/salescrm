# Architecture
Status: Draft | Last updated: 2026-11-24

## Fixed decisions and reasons
- One standalone product and app instance: keeps customization in the same application.
- One PostgreSQL database as the single source of truth: keeps business state authoritative in one place.
- No tenant/organization identifiers or switching: the product is not multi-tenant.
- Next.js App Router with server-side Drizzle access only: keeps database credentials and queries off the browser.
- Supabase hosts PostgreSQL, Auth and Storage: uses the selected managed platform for persistence, identity and files.
- Supabase Auth with server-side authorization: Phase 2 explicitly grants equal application access to every authenticated user, with no roles/permissions; validate identity using auth.getUser().
- RLS on every table with no public policies: browser/public database access is closed.
- Runtime transaction pooler on port 6543 with prepared statements disabled: matches the selected Supabase connection mode.
- Migration session pooler on port 5432: separates schema tooling from transaction-pooled runtime access.
- Vercel deployment: uses the selected Next.js hosting platform.
- Gemini calls are server-side only: keeps provider credentials out of client bundles.

## Request and data flow
Browser -> Next.js server (Server Component, route handler or server action) -> Drizzle -> postgres.js -> Supabase PostgreSQL.

Supabase Auth provides login/session identity; Next.js server code authorizes operations before database access. Supabase Storage supplies file storage; bucket and access design remain open. Instagram Graph API, WhatsApp Business Cloud API and Gemini connect through server code. Incoming webhooks must pass signature/token verification before processing.

## Phase 1 implementation notes
Phase 1 temporarily disabled Cache Components for force-dynamic. Phase 2 restores the original Cache Components and partial prefetching settings, uses await connection() for health requests, and requires authentication for the diagnostic. Auth-dependent rendering stays behind Suspense boundaries; do not cache user identity globally.

Phase 2 prerender fix: the shared server Auth helper awaits connection() before entering the SDK and outside its error catch, allowing prerendering to suspend correctly before token-expiry clock reads. Profile database imports occur only after the authenticated request gate, avoiding driver initialization during protected-layout module evaluation. Suspense alone does not establish request-time execution.

## Approved Phase 3A caller boundary (2026-11-24)
Server-only business data functions accept plain input, including createLeadWithContact(input), and do not authenticate callers. Phase 3B server actions must call the existing auth helper first; Phase 8 webhooks must verify provider signatures/tokens first. No session/user-context object is passed into this shared data layer. Database initialization stays lazy. Server-only imports prevent browser bundling but are not authorization. Meta ads intake is selected for Phase 8 alongside Instagram/WhatsApp; provider API details remain open.

## Open questions
- Database runtime role and least-privilege/RLS strategy for authorized server access.
- Storage access design and advanced session lifecycle policy; equal authenticated access and SSR cookie sessions are decided for Phase 2.
- Deployment environments and integration scaling/queue worker design beyond Phase 8 bounded redelivery/manual recovery.
- Long-term caching strategy after the temporary endpoint is removed.

## Phase 7 analytics (Approved 2026-11-26)
Authenticated /analytics awaits requireUser before report access, inside Suspense using the existing request-time auth helper. Server-only data/analytics.ts executes a parameterized pure analytics-query.ts builder in one read-only repeatable-read transaction. No global user-data cache, new tables or migrations. Read models distinguish inclusive India selected-period cash/bookings/cohorts from current all-time balances/pipeline. Client Recharts leaves receive exact decimal strings; only dimensionless bigint-normalized plot ratios become Numbers. Exact tables remain accessible alongside charts. No history-as-of, forecast or AI claims.

## Phase 8 intake architecture (2026-11-26)
Three exact public webhook route handlers replace session auth with provider HMAC/token verification and an explicit channel/account boundary. Pure webhook-handler.ts orchestrates bounded byte reading, verification, parsing and injected persistence/processing; server-only wrappers provide configuration and Drizzle operations. Native fetch/crypto are used, with fixed Graph origins, server Authorization headers, timeouts, redirect rejection and no cache. Instagram Login is the implemented variant; Graph version is explicitly configured, not guessed.

A supported batch is inserted durably before bounded synchronous processing. Unique channel/account/event keys never expire on business soft deletion. Processing rechecks/locks the event, serializes account-scoped sender creation with a transaction advisory lock, and commits enquiry/contact/identity/success together through createEnquiryInTransaction. Follow-up messages reuse the identity's live lead; archived parents require review. Enrichment happens before the write transaction, outside DB locks. Failed work rolls back and records a safe review code without replacing concurrent success. The proxy exempts only exact callback paths; authenticated /integrations and retry actions call requireUser first. Provider redelivery plus manual retries supply recovery; no autonomous queue worker/scheduler is claimed. See docs/integrations/meta-setup.md for throughput limits and external setup.

## Phase 9 analyst architecture (Approved 2026-11-26)
Authenticated /analyst previews an explicit aggregate-only projection of Phase 7 analytics inside Suspense. The generation server action uses runAnalyst, which calls requireUser before validating dates/focus or touching configuration/data/provider code. Each submission rebuilds authoritative read-only analytics; no client-supplied snapshot/prompt is trusted. analyst-values.ts allowlists exact numeric strings and fixed category constants, discarding outstanding-order rows and all record/free-text context. ai/config.ts and ai/gemini.ts are server-only production boundaries; analyst-provider.ts is the injectable transport/schema seam exercised offline.

Native fetch calls only the fixed Gemini generateContent HTTPS endpoint with a private header key, explicit validated model, bounded structured JSON output, timeout/no redirects/no cache/no automatic retries. Current responseFormat.text schema fields are used rather than deprecated schema-format fields. Responses must be complete, bounded, schema-valid and cite known fact IDs; references are checked but interpretation is not proven. No tools, arbitrary SQL, mutations, background calls or global report/data cache. Only per-user cooldown metadata lives in a bounded process-local map; it is not shared quota enforcement. Reports are ephemeral client state, not database history. Provider billing, retention/model availability and live acceptance remain manual setup.
