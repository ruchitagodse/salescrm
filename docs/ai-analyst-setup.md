# Phase 9 analyst setup and acceptance

Implementation: 2026-11-26. `/analyst` previews aggregate analytics and generates advisory observations/suggested actions only after an authenticated user submits Generate with Gemini. No model call runs on page load. No business records, activities or messages are changed. No report/history tables or migrations are needed; OS keeps a generated report only in the current page state.

## Private configuration

1. Privately set `GEMINI_API_KEY` and `GEMINI_MODEL` in ignored `.env.local` or the intended server deployment environment. Never paste values into chat, source, command output or `NEXT_PUBLIC_` variables. Restart the local server after configuration changes.
2. Choose a currently available Gemini model supporting `generateContent` with structured JSON output via `generationConfig.responseFormat.text` (`mimeType: APPLICATION_JSON`, `schema`). There is no model default or automatic fallback. The accepted identifier begins `gemini-` and cannot contain a slash/query/URL. OS uses the fixed `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` endpoint, not a configurable proxy. The current API discovery document deprecates older schema-format fields in favor of responseFormat; compatibility with the selected real model remains a manual acceptance check.
3. Verify the key's intended project, API access, model availability, billing and provider quotas. Choose appropriate quota/budget controls in Google; OS does not change project billing or enforce distributed spending quotas. Do not use Google's unpaid services for confidential business aggregates: Google's current terms prohibit submitting sensitive/confidential/personal information to unpaid services. Use an appropriately configured project with active billing for confidential business use and review the applicable paid-service data terms. OS does not verify project billing, promise zero retention or make a provider training/retention guarantee.
4. Run `node --experimental-strip-types scripts/verify-analyst.mjs`. Expected: presence booleans, then `passed:true` on both database connections; `liveGeminiRequest:false` and `businessWrites:false`. This is a read-only payload check, not a paid model smoke test. Missing key/model should be reported as missing without printing their contents.

## What leaves OS

The server rebuilds the snapshot from authoritative analytics; it never trusts browser-supplied figures or prompts. The payload includes selected India dates, database snapshot time, exact monetary paise/count strings and fixed source/status/stage/outcome categories. Selected-period metrics: receipts/expenses/net cash, orders/booked header value, lead creation/conversion cohort and deal creation-cohort breakdowns. Current all-time metrics: outstanding balance/orders, open pipeline known value/open count/unvalued count.

No order/customer/contact/lead UUID, order number/title, customer/business name, phone, email, Instagram handle, integration event, message, notes, raw document or editable category label is included. Raw analytics outstanding-order rows never pass the allowlist. Category values are fixed application constants. Month-by-month history, prior-period comparisons, activity deadlines and marketing spend are not sent, so trend/causal/ROI claims are unsupported. Net cash is not profit or accrual revenue, and deal outcomes do not establish when a deal won/lost.

Exact monetary calculations occur with bigint and are serialized as decimal strings. AI prose is not an accounting source. Every observation/recommendation must cite known fact IDs; schema/reference validation cannot prove that its interpretation is true. No tool/function execution, arbitrary SQL, external grounding, free-form prompt or autonomous action is provided. Model text is escaped, not rendered as HTML/Markdown links.

## Manual acceptance

- Run `npm run dev`, sign in and open `/analyst`. Default period is the current India month to date. Apply custom dates and check invalid/reversed ranges. Review the exact aggregate preview against `/analytics`. Merely visiting, changing dates or previewing must not call Gemini.
- With the intended key/model configured, select Overview, Sales or Cash and click Generate with Gemini. Expect bounded observations, suggested priorities/actions, limitations, evidence references and the exact refreshed snapshot with date/model/time labels. Review the output against the figures; absence of prior-period data must not be presented as growth/decline evidence. Check empty/no-activity periods and unknown pipeline values.
- Confirm names, phone/email, notes/messages, individual order rows and record identifiers are absent from the outgoing server payload. Do not print keys or real payloads in logs/screenshots. Offline tests and the read-only verifier already check the allowlist with synthetic PII and current aggregate structure.
- Exercise an unavailable model, invalid key, provider quota/error and timeout. Expect a generic failure with no partial report or provider error details. Wait 30 seconds before retrying; there is no automatic paid retry. A failed request still consumes the local cooldown window. Returned blocked, truncated, malformed, oversized, unknown-evidence or executable/tool output is rejected.
- Check pending states, keyboard/mobile layout, text wrapping, evidence tables and date changes clearing old report state. Reloading loses the report by design. Sign out and confirm `/analyst` redirects to `/login`; generation must require authentication independently of page/proxy protection.

The agent's offline provider/orchestration tests do not establish real Gemini connectivity or quality. The production HTTP checker tests logged-out route protection without invoking Gemini; authenticated UI/action execution remains manual.

## Operational limits

Thirty-second request timeout, 32 KiB outbound body cap, 64 KiB inbound envelope cap, 4,096 output-token cap, one candidate, no redirects/cache/automatic retries. A process-local per-user single-flight/cooldown guard holds only IDs/timestamps/activity flags, with at most 1,000 entries. It resets on restarts and is not shared across server instances; provider quota controls remain necessary for shared spending enforcement. No business snapshots/reports are cached globally.

All authenticated users have equal analyst access; roles, stored report history, record-level context, chat, scheduled reports and automatic follow-up creation are outside the approved scope. No Phase 10 deployment or integrated acceptance work is started here.

## Official references checked

- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Current v1beta API discovery: responseFormat/TextResponseFormat](https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta)
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Server-side API key handling](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini terms and paid/unpaid data use](https://ai.google.dev/gemini-api/terms)
