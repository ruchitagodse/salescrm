# OS agent instructions

`docs/ssot/` is the authority for product and engineering decisions. Code must match it; update the SSOT in the same commit when decisions change. Preserve open questions rather than inventing requirements.

Never open, print, log, echo or commit .env.local, connection strings or passwords. Check file existence only and verify `git check-ignore .env.local`; fix ignores if needed. Secrets stay in ignored .env.local or Vercel environment variables, never browser code or NEXT_PUBLIC_ variables. Use server-side Drizzle only, enforce authorization on the server, enable RLS on every table with no public policies, return generic API errors and verify webhook signatures/tokens before processing.

Work one phase at a time in small increments. Before coding, state objective, files and dependencies. Run `npx tsc --noEmit`, `npm run lint`, `npm run build` and phase runtime checks. Report real results, untested behavior, limitations and next step; update SSOT. Stop and wait for Ruchita's confirmation before starting the next phase. Do not create business tables in Phase 1.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
