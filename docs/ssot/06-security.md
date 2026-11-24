# Security
Status: Approved | Last updated: 2026-11-24

- Never open, print, log, echo or commit .env.local, connection strings or passwords. Check .env.local existence only; application/tooling may load it without exposing its contents.
- Verify `git check-ignore .env.local`; fix .gitignore if needed. It is currently ignored by `.env*` and is not tracked.
- Secrets belong only in ignored .env.local or Vercel environment variables. No database URLs/service keys in browser code or NEXT_PUBLIC_ variables.
- All database access uses Drizzle on the server. Guard database modules against client imports.
- Supabase Auth handles email/password login. Invite-only: owner creates accounts in the Supabase dashboard; no public sign-up UI or route. Owner reports public sign-ups disabled manually; this is not independently verified.
- No roles or permissions for now: every authenticated user has the same application access. This is an explicit known limitation, not per-record authorization.
- Authorize with server-side auth.getUser(), never trust auth.getSession(). A Next.js src/proxy.ts refreshes session cookies and redirects unauthenticated requests to /login except /login and static assets. Protected server pages, actions and route handlers independently validate the user.
- Enable RLS on every application table with no public policies; decide the authorized server database role before creating tables.
- API error responses must be generic. Server diagnostics must also exclude passwords/connection strings; never serialize raw driver errors without sanitization.
- Instagram/WhatsApp webhooks verify provider signatures/tokens before processing. Exact verification implementation belongs to Phase 8.
- Gemini credentials and requests are server-side only.

The health route is retained as an authenticated connectivity diagnostic. It performs its own auth.getUser() check before any database query. It uses await connection() rather than the incompatible force-dynamic export with Cache Components. No public policy is created for profiles. Server Drizzle access requires a suitable database role; role capability is verified separately, never assumed from browser Auth.

The only intentionally public NEXT_PUBLIC_ values are the Supabase project URL and anon key requested for Auth. They are public configuration, not a service-role key. Never expose database credentials or service keys.

Phase 2 verification limitation: profiles currently does not exist in the connected database, so RLS/trigger enforcement and runtime profile writes are not established. The SQL is a reviewed draft pending actual generation and migration. Auth packages are missing and the anon-key variable name is absent; no login, logout, refresh or successful route protection is claimed.

Latest verification supersedes the earlier limitation above: Phase 3A preflight confirmed profiles exists, RLS enabled, zero policies, and—after the forward 0002 Phase 2 repair—the shared timestamp function and enabled BEFORE UPDATE row trigger exist. All four expected env names are present; values were never displayed. Auth packages are installed (see 03-tech-stack.md). This catalog verification does not establish all browser/login/session acceptance checks.

## Approved Phase 3A access boundary (2026-11-24)
Approved revision: business data functions accept plain inputs and perform no session/authentication checks themselves. They remain guarded by import "server-only" and expose no routes/actions. Callers establish trust first: Phase 3B server actions call the existing requireUser()/getUser() helper; Phase 8 webhooks verify provider signatures/tokens before processing. createLeadWithContact takes plain input for reuse from both entrypoints without a browser session. Database initialization remains lazy. A server-only import is a bundle boundary, not authorization. All authenticated users retain equal access; no ownership/role field is added. This supersedes the opaque-context design.

Input is validated with shared strict Zod schemas. Caller-supplied normalized fields, timestamps and deletion flags are rejected. Parameterized queries handle input; only fixed value-set constants enter SQL CHECK literals. All default entity reads/lists/updates exclude deleted rows. Raw database errors and their causes never leave the data layer. Deadlocks/serialization failures return a retryable generic error; identity conflicts and uniqueness failures have safe typed error codes. No service-role Auth key is introduced.

## Open questions
- Password recovery, invite-email/password establishment flow, session expiration and revocation policy beyond provider defaults.
- Runtime database role/RLS interaction and Storage bucket access controls.
- Webhook replay/idempotency, token rotation, audit/retention and rate-limiting policy.
- Meta lead-ads permissions, app review and permitted data access remain undecided for Phase 8.
