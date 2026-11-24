# Environment
Status: Approved | Last updated: 2026-11-24

Names and purposes only; never record values.

- `DATABASE_URL`: Supabase Transaction pooler, port 6543; used by src/db/index.ts in the Next.js server runtime. postgres.js prepared statements are disabled.
- `DATABASE_URL_MIGRATIONS`: Supabase Session pooler, port 5432; used by root drizzle.config.ts for drizzle-kit tooling.
- `NEXT_PUBLIC_SUPABASE_URL`: public Supabase project API URL; browser/server Auth clients and session refresh.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public Supabase anon API key; browser/server Auth clients and session refresh. Never substitute a service-role key.
- `NODE_ENV`: framework/runtime environment selector; database client caching is enabled outside production. Do not manually override Next.js environment modes.

## Local setup
.env.local exists at the project root and is git-ignored. Its contents were not inspected. Next.js loads runtime environment variables; Drizzle config separately loads .env.local through dotenv with quiet output. Required URL names are checked by code without printing values. Do not copy .env.local into documentation or commits.

## Vercel setup
Set required server environment variables in Vercel rather than committing files. DATABASE_URL is for application runtime; DATABASE_URL_MIGRATIONS is only needed in an approved migration execution environment. Deployment and migration workflow are not configured in Phase 1.

Set both public Supabase Auth variables locally and in the appropriate Vercel environment before building. Public configuration is embedded in browser bundles at build time. Owner creates accounts in the Supabase dashboard and reports public sign-ups already disabled there. No signup endpoint or admin credential is added to OS.

Storage, Gemini, Instagram and WhatsApp configuration remains for future phases. No .env.local contents are inspected or printed; framework/tooling loads required names internally. Never invent credentials or place secrets in NEXT_PUBLIC_ variables.

## Open questions
- Future Storage/integration variable names and credential lifecycle.
- Local/preview/production database separation and migration execution workflow.
