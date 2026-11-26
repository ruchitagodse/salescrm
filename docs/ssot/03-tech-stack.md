# Technology stack
Status: Draft | Last updated: 2026-11-24

Declared ranges come from package.json; exact installed versions were read from local package metadata. No dependencies were added for Phase 1.

## Runtime dependencies
- Next.js: App Router framework; declared/installed `16.4.6`.
- React and react-dom: UI and rendering; declared/installed `19.3.0` each.
- drizzle-orm: server-side PostgreSQL ORM; declared `^0.45.4`, installed `0.45.4`.
- postgres: postgres.js PostgreSQL driver; declared `^4.1.1`, installed `4.1.1`.
- sass: SCSS compiler; declared `^1.108.2`, installed `1.108.2`.

## Development dependencies
- TypeScript: strict typed implementation; declared `^5`, installed `5.9.3`.
- drizzle-kit: schema generation, migration and Studio tooling; declared `^0.31.11`, installed `0.31.11`.
- dotenv: loads .env.local for Drizzle tooling; declared `^18.0.10`, installed `18.0.10`.
- ESLint: linting; declared `^9`, installed `9.39.5`.
- eslint-config-next: Next.js lint rules; declared/installed `16.4.6`.
- @types/node: Node types; declared `^20`, installed `20.19.43`.
- @types/react and @types/react-dom: React types; declared `^19`, installed `19.3.0` each.

## Selected, not installed/configured by Phase 1
- Meta ads lead intake — Phase 8 server adapter implemented using native fetch; explicit Graph version/configuration and live provider acceptance required.
- Supabase: PostgreSQL hosting, Auth and Storage. Hosting region/health/free-plan claims are user-provided and not independently verified. Server/SDK version not established.
- Recharts: installed for Phase 7 charts; see versions below.
- Gemini API: Phase 9 server-side REST analyst implemented; explicit model/key configuration and live acceptance pending.
- Instagram Graph API: Phase 8 inbound adapter and sender profile lookup implemented for Instagram Login; explicit Graph version/configuration required.
- WhatsApp Business Cloud API: Phase 8 inbound callback adapter implemented; outbound messaging is excluded.
- Vercel: deployment; not configured or tested here.

## Initial Phase 2 dependency state (historical)
package.json now declares @supabase/supabase-js `^2.49.4` and @supabase/ssr `^0.6.1`, compatible API baselines for Supabase Auth and cookie-based SSR clients. Neither is installed: npm returned ENOTCACHED and installation escalation was rejected. These are declared ranges, not verified installed versions. The package lock remains at the pre-install state and must be synchronized by a successful npm install before npm ci/build can pass. No installed version is claimed. Existing installed dependency versions above remain unchanged.

Phase 2 restores Cache Components and partial prefetching. The starter Google font downloads are removed; minimal UI uses a system font and globals.scss. SSR cookie handling follows the [Supabase server client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client); authorization explicitly uses getUser() as required by this project.

### Latest dependency observation, 2026-11-24 prerender fix
Supabase packages are now installed locally: @supabase/ssr 0.6.1 (package.json ^0.6.1), @supabase/supabase-js 2.119.2 (package.json ^2.119.2). These versions were read from local package metadata; the agent did not install or change these packages in the prerender-fix turn. Earlier missing-package results above are historical. TypeScript and lint now pass; build compiles but is blocked at worker spawning with EPERM, so full build/prerender success is not claimed.

## Phase 3A additions (2026-11-24)
- zod: declared ^4.6.7, installed 4.6.7; strict shared input validation and exact bigint parsing.
- libphonenumber-js: declared ^1.13.17, installed 1.13.17; E.164 parsing/validation using max metadata and default country IN. [Maintainer documentation](https://github.com/catamphetamine/libphonenumber-js).
- Node built-in test runner, Node 24.20.0 locally: no test-framework dependency. npm test uses TypeScript stripping and test-isolation=none for these pure modules, avoiding restricted worker spawning. TypeScript allowImportingTsExtensions is enabled under the existing noEmit mode so Node can load shared validation imports directly.

Installation succeeded after authorized network escalation. npm reported four moderate dependency advisories; no automatic/breaking audit fix was applied. Package versions above are local metadata observations.

Node observed locally: `24.20.0`; this is an observation, not a production version decision. Existing starter styles are CSS; product styling must use SCSS, with no Tailwind.

## Phase 1 observed state
Server-only Drizzle/postgres.js client, health route, empty schema module, dotenv-backed Drizzle config and db:generate/db:migrate/db:studio scripts are implemented. No packages were installed and the pre-existing lockfile changes were preserved. The dev route runs and PostgreSQL rejects authentication (`28P01`); a successful DB query is not verified. Generation is blocked by sandbox process spawning and the build by starter Google font fetching; escalation retries for those checks were rejected. See 08-build-plan.md for check results. Supabase connectivity success, project region/health/plan, Auth, Storage and deployment are not independently established.

## Open questions
- Versions/SDKs for future integrations and Supabase Storage.
- Supported production Node.js version and dependency upgrade policy.

## Phase 7 dependencies (2026-11-26)
Recharts 3.11.1 (^3.11.1) and react-is 19.3.1 (^19.3.1) installed; package-lock synchronized. Installation initially hit restricted cache access, then succeeded with authorized network access. Recharts is used only in the client chart leaf; authenticated server aggregates pass decimal-string DTOs. [Official installation guide](https://recharts.github.io/en-US/guide/installation/). Existing React/Next versions are unchanged.

## Phase 8 integration adapters (2026-11-26)
No additional package dependency. Native server fetch, node:crypto HMAC/timingSafeEqual, existing Zod/Drizzle/postgres.js support inbound leadgen, Instagram Login messages/profile retrieval and WhatsApp Cloud API messages. The Graph version is required configuration rather than a guessed default; API host/token/login variants are not interchangeable. Provider app permissions, access levels, asset subscriptions and production review are manual and unverified. Primary provider references and current setup instructions are linked in docs/integrations/meta-setup.md; no provider SDK or outbound API is installed. Earlier not-implemented observations above are historical.

## Phase 9 Gemini adapter (2026-11-26)
No new dependency/SDK: native server fetch and existing Zod validate Gemini structured JSON and evidence references. GEMINI_MODEL is explicit private configuration, with no hardcoded/guessed model default. generateContent v1beta REST remains documented; the current API discovery document supplies generationConfig.responseFormat.text (mimeType APPLICATION_JSON and schema), replacing deprecated schema-format fields. Server-only wrapper keeps production calls off the browser. Current primary references/model/billing acceptance steps are in docs/ai-analyst-setup.md; no real key/model call was performed by automated checks.

## Quotation enhancement dependencies (2026-11-26)
PDFKit 0.21.0 and Nodemailer 10.6.1 installed; @types/pdfkit/@types/nodemailer are development dependencies. No rendering/browser service or SMTP SDK credential is bundled into clients. Noto Sans assets are vendored with their OFL license (full font from google/fonts and bold WOFF sourced from Fontsource); no runtime font download is needed. The temporary Fontsource package dependency was removed after vendoring. Fonts are included through Next output-file tracing. Next serverExternalPackages explicitly externalizes PDFKit/Nodemailer: bundling PDFKit caused a reproducible URL/path error during page-data collection. The first WOFF require.resolve approach also hit an unknown-module-type build failure; direct server filesystem assets resolve it. Npm reports four moderate dependency advisories inherited in the dependency tree; no breaking audit fix was applied. PDFKit handles the application's Node runtime; Python/Poppler/PDFium were used only for local synthetic visual QA, not required in production.
