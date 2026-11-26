# Environment
Status: Approved | Last updated: 2026-11-26

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

Storage configuration remains for a future phase; Phase 8 integration and Phase 9 Gemini names are documented below. No .env.local contents are inspected or printed; framework/tooling loads required names internally. Never invent credentials or place secrets in NEXT_PUBLIC_ variables.

## Open questions
- Future Storage variable names and provider credential lifecycle/rotation; Gemini names are finalized below.
- Local/preview/production database separation and migration execution workflow.

## Phase 8 server-only names (2026-11-26)
Each channel is optional and disabled unless all its required values are present. Never use NEXT_PUBLIC_ for these names, and do not share their values in chat. Existing environment contents are not inspected.
- META_ADS_APP_SECRET, META_ADS_VERIFY_TOKEN, META_ADS_PAGE_ID, META_ADS_PAGE_ACCESS_TOKEN: lead-form callback signing/verification, one allowed Page and lead retrieval credential.
- INSTAGRAM_APP_SECRET, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN: Instagram Login professional-account callback verification, account allowlist and scoped-user profile lookup. Facebook Login/Unified Login variants are not assumed interchangeable; this implementation uses graph.instagram.com.
- WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID: Cloud API callback verification and one allowed phone-number ID; inbound-only requires no outbound access token in OS.
- META_GRAPH_API_VERSION: explicit supported version in vNN.N form for Graph retrieval; no unverified default. Set the same tested subscription version in the provider dashboard. Credential provisioning/expiry/rotation and permissions remain manual.
Only required-name/presence booleans may be displayed by setup checks; never values. Channels disabled by missing configuration return generic unavailable responses. Accounts/app products may use different app secrets; the route reads the corresponding channel secret.

## Phase 9 server-only names (2026-11-26)
- GEMINI_API_KEY: private Gemini Developer API key, supplied only through the server request header. Never NEXT_PUBLIC_, browser code, URL queries, logs or committed files.
- GEMINI_MODEL: explicit available Gemini model identifier supporting generateContent structured JSON output. No guessed model/version default; validate its identifier before constructing the fixed provider URL.
Missing/invalid configuration disables generation while allowing aggregate preview. Presence checks print names/booleans only. Owner verifies the selected provider project's billing/quota, applicable data terms and permissions before using real business data. No provider data-retention or training guarantee is implied by OS; review the provider's current account terms. No automatic key provisioning, quota changes or paid calls are performed by checks.

## Quotation sending / confirmed public branding (2026-11-26)
Names only; no credentials from chat are copied into files.
- SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASSWORD: server-only Gmail SMTP configuration. Rotate the credential shared in chat before configuring its replacement privately. CONTACT_TO_EMAIL is not used as the quotation recipient: each send uses an explicitly selected/entered client recipient.
- WHATSAPP_ACCESS_TOKEN: server-only outbound Business API credential. WHATSAPP_PHONE_NUMBER_ID and META_GRAPH_API_VERSION remain the existing account/version names. Existing webhook secret/verification/subscription setup is needed for verified session and delivery events.
- WHATSAPP_QUOTATION_TEMPLATE and WHATSAPP_TEMPLATE_LANGUAGE: optional provider-approved template with a document header and no variable body parameters, required when no verified inbound message exists within 24 hours. A compatible approved template and recipient eligibility are provider prerequisites, not automatically provisioned by OS.
- QUOTATION_BUSINESS_ADDRESS, QUOTATION_PUBLIC_EMAIL, QUOTATION_PUBLIC_PHONE: confirmed public branding only. Current supplied address/phone/public email were explicitly unverified, so they are omitted unless the owner configures confirmed values. Brand PROSPERA Digital Solutions, website https://prosperadigitalstudio.vercel.app/ and sign-off Ruchita Godse were supplied; no verified legal-business/tax-registration claim is invented.
A runtime name/presence check found all SMTP/outbound WhatsApp/public-contact names above missing. Sending stays visibly unavailable; PDF generation/download remains independent. Provider credentials, domain/account settings and public contact confirmation require owner setup. No SMTP/WhatsApp send was performed by the agent.
