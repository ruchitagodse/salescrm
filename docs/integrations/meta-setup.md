# Phase 8 provider setup and acceptance

Implementation date: 2026-11-26. This guide records prerequisites and manual checks; it does not claim that any Meta account, token, app review or live callback is configured. No Phase 9 work is included.

## Scope

Inbound only. One configured Facebook Page, one Instagram professional account using Instagram Login, and one WhatsApp Cloud API phone number. Separate app secrets/verification tokens are supported per channel. No send/reply API, OAuth onboarding UI, campaign management, history import or attachment retrieval. Existing business data is never sent to Meta; the only outbound calls retrieve a lead form or Instagram sender profile.

First successfully processed Instagram/WhatsApp message creates a lead for that channel/account/sender. Later messages are stored as events and linked to that lead, including when the lead is closed. Archived identities/leads/contacts require review rather than recreation. Meta submissions use leadgen_id independently, so two different form submissions can create two leads sharing a matched phone/email contact. Existing contacts are filled only where empty; conflicting phone/email owners never merge.

## Configure privately

1. Add only the server variable names documented in SSOT 07 to ignored .env.local or the appropriate deployment environment. Do not paste their values in chat, source or terminal output. Each secret/token/account must belong to the intended app/business asset. Select a currently supported Graph version and set META_GRAPH_API_VERSION and matching webhook subscription version; no provider-version default is baked into OS.
2. Deploy to a public HTTPS origin. Register the exact callback paths /api/webhooks/meta-ads, /api/webhooks/instagram and /api/webhooks/whatsapp, using each route's verification token. Localhost alone cannot receive Meta deliveries. Never add verification-token queries to a shared screenshot or access log.
3. Meta ads: subscribe the Page object to leadgen and install/subscribe the app on the configured Page. Use a Page access token with leads_retrieval and the permissions/business access required by Meta for the selected app/product. Check Page lead access, development/live mode and app review requirements; an app-role test success does not establish public production access. The webhook's page_id must match META_ADS_PAGE_ID. Lead form fields map full_name (or first_name/last_name), email, phone_number, city and requirement. Custom field mapping is not guessed; service/budget/deadline are not inferred. Form/ad identifiers remain in attribution, not editable identity keys.
4. Instagram: this implementation uses Instagram Login and graph.instagram.com, with instagram_business_basic and instagram_business_manage_messages permissions appropriate to the selected account/access level. Subscribe messages and enable account notifications. INSTAGRAM_ACCOUNT_ID must equal the actual webhook entry.id/recipient.id for the configured account. Obtain a corresponding Instagram user access token; Facebook/Unified Login tokens are not silently substituted. The sender must have consented through supported messaging interaction before profile lookup. A valid returned username is required for a new contact; a scoped numeric ID is never stored as a username.
5. WhatsApp: configure the Cloud API messages subscription for the intended business account/phone; set WHATSAPP_PHONE_NUMBER_ID to metadata.phone_number_id. Register/verify the business number and complete any required business/account setup. OS does not need an outbound messaging token because it sends no messages. Supported phone-based sender IDs are normalized to E.164; opaque-only sender identities are preserved for review without guessing a phone number.
6. Open /integrations while signed in. It shows variable names/presence only. Presence does not verify validity, expiry, account ownership, permission grants or subscriptions.

## Manual acceptance

Run npm run dev for local authenticated UI review, or use the HTTPS deployment for real callbacks. The Phase 8 migration is already applied when the implementation report says db:migrate passed; do not re-create it manually.

- In each provider's app dashboard, verify the callback challenge succeeds. Wrong verification tokens must be rejected. Send a real test lead or inbound message from an allowed test identity and confirm it appears in /integrations and /leads with entry_method=integration and the correct source/attribution.
- For Meta ads, use Meta's Lead Ads Testing Tool. Check standard form name/phone/email mapping and existing-contact reuse. Repeat the same provider delivery: no second lead. Submit a different lead form entry: a separate lead is expected.
- For Instagram and WhatsApp, send two different messages from the same sender. Expect two event rows, one identity mapping and one lead. Resend a message ID: no extra row/lead. Send from a second sender: a new identity and lead. Verify text, provider time and lead links. Outgoing echoes, delivery/read/status notifications must not create leads. Media messages retain their type only, with no download/preview.
- Exercise profile/Graph permission failure, missing contact method and conflicting phone/email owners. Events must stay reviewable with safe codes, without partial contacts/leads/mappings. Correct configuration or the existing data and select Retry intake. Retry after success must not duplicate anything.
- Sign out: /integrations must redirect to /login. Signed webhook endpoints must remain reachable without browser cookies; unrelated APIs remain protected. Invalid/missing signatures must return 401 before business operations. Disabled channels return 503. Review mobile/keyboard/table usability and generic errors.

## Delivery and recovery limits

The handler bounds raw bodies to 256 KiB and normalized batches to 1,000 events; larger/malformed bodies are rejected, not truncated. Each delivery stores its whole supported batch before processing at most 10 events; new events are prioritized over retryable failures. Remaining pending events or transient failures return 503 for provider retry. Already processed events are skipped. Permanent input/conflict failures remain needs_review and are acknowledged to prevent endless poison-event retries. The authenticated Retry intake control recovers pending/review items after provider retries expire. There is no dedicated queue worker/scheduler or unattended recovery beyond provider redelivery in this phase. Monitor the review page; this is a known throughput/operations limit.

No raw payload JSON, access tokens, URLs for attachments, or arbitrary custom form answers are persisted. Normalized message text, sender names/IDs and attribution are personal data visible equally to all authenticated OS users. Retention/erasure/consent policy remains open; no automatic purge job was invented. A replay guard is not a timestamp freshness check; Meta signatures do not establish a safe historical timestamp cutoff.

## Primary references checked

- [Meta webhook verification and SHA256 notifications](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
- [Leadgen subscription requirements](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/)
- [Lead field retrieval](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/v2.8/)
- [Instagram webhook setup and redelivery](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup)
- [Instagram Login sender profile requirements](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile)
- [WhatsApp messages vs outgoing status notifications](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages)

Provider documentation and permission requirements can change; verify the selected version/product in the app dashboard before live acceptance. No provider account settings were changed by the agent.
