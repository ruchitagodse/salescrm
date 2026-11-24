# Data conventions
Status: Approved | Last updated: 2026-11-24

- UUID primary keys on every table.
- `created_at` and `updated_at` on every table.
- All timestamps use PostgreSQL `timestamptz`.
- Money is INR only, stored as integer paise in PostgreSQL bigint. Use Drizzle bigint mode `bigint` and JavaScript bigint for exact arithmetic; never floats. Number.MAX_SAFE_INTEGER is 9,007,199,254,740,991 paise, but this implementation never converts money to number. PostgreSQL signed bigint range is -9,223,372,036,854,775,808 through 9,223,372,036,854,775,807 paise. Serialize bigint as decimal strings at JSON boundaries.
- Table and column names use snake_case; table names are plural.
- Enable RLS on every application table with no public policies. All business access runs through authorized server code and Drizzle.
- Do not introduce tenant or organization IDs.
- Business tables get nullable `deleted_at timestamptz`; default queries must exclude deleted rows. Retention/restore semantics remain open. Profiles are an identity foundation table, not a business table, and follow auth.users deletion by cascade.
- Shared PostgreSQL `set_updated_at()` trigger function maintains updated_at; attach a trigger to each table in its migration.
- Phase 2 implements only profiles. Its UUID id references auth.users(id) with ON DELETE CASCADE; full_name is nullable, with created_at/updated_at. auth.users is referenced via pgSchema("auth") but excluded from managed migration exports.
- Profile creation uses an on-first-authenticated-request upsert, `ON CONFLICT DO NOTHING`: handles existing dashboard-created accounts without installing a trigger on Supabase-managed auth.users. It never overwrites an existing profile. Until a user accesses OS, their profile need not exist.

## Open questions
- Soft-delete retention, restore semantics and deleted-row uniqueness rules.
- Required uniqueness, indexes, referential actions and business constraints in each phase.

## Approved Phase 3A decisions (2026-11-24)
- Value sets use text columns with CHECK constraints generated from single exported TypeScript const arrays in src/lib/lead-values.ts; the same arrays drive Zod and future UI. No native PostgreSQL enums.
- Business UUIDs default to PostgreSQL gen_random_uuid() via the shared id helper's .defaultRandom(); explicit app-generated UUIDs remain supported, while profiles.id has no default and must match auth.users.id. Shared timestamp/soft-delete helpers, per-table set_updated_at() triggers and RLS without policies still apply.
- Company has many contacts; company_id is optional. Contact has many leads; contact_id is required. Foreign keys use ON DELETE RESTRICT: hard deletes must not orphan children. Soft deletion does not cascade; reads exclude the queried entity's deleted rows. Existing child records retain their FK when a parent is soft-deleted. New/changed parent links require a non-deleted parent. Broader parent deletion/restore UX remains open.
- Sources: instagram, whatsapp, meta_ads, website, referral, cold_outreach, other. Statuses: new, contacted, qualified, converted, lost; default new. Lost requires nonblank lost_reason in validation and a DB CHECK. converted_at is server-maintained when entering converted (retained on other transitions, refreshed when entering converted again). Converted is status-only until Phase 4.
- Approved Phase 3A revision: entry_method uses the shared const values manual/integration with a text CHECK and default manual; source_detail is nullable plain text for campaign/ad/form details. Source describes origin independently of entry method. Phase 3 supports manual entry; Phase 8 adds Meta ads, Instagram and WhatsApp intake. Provider attribution mapping remains open.
- Contact phone/email normalized values are stored. E.164 normalization uses libphonenumber-js with default IN; email trims and lowercases. Blank optional strings become null. A contact needs phone, email or instagram_handle. Partial unique phone/email normalized indexes apply only to live rows and non-null values.
- New enquiries match live contacts by normalized phone OR email; reuse the contact and fill only empty fields, never overwrite existing values. Two different contacts matching the two keys is an unresolved identity conflict: fail atomically rather than choose or merge them. Transactions and sorted transaction-scoped advisory locks coordinate identity writes; partial unique indexes are the final race guard.
- Company case-insensitive name duplicates produce a warning, not a block. No ownership/assignment fields, activities or note entities; notes remain plain text.
- budget_paise uses bigint internally, accepts bigint or decimal integer strings (never numbers), and is returned as a decimal string in lead DTOs. Validate signed PostgreSQL bigint bounds; no float conversion.
- Node's built-in test runner tests pure normalizers and merge decisions using Node 24 TypeScript stripping. Zod schemas are shared with future server actions. No Phase 3A UI/routes or migration generation/application.

### Remaining open questions
- Merging two existing contacts and resolving split phone/email matches.
- Soft-deleted parent/child restore workflows; deleted-row uniqueness collisions on restore.
- Negative-budget business rules and transition restrictions beyond the supplied status rules.
