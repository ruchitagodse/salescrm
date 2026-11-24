# Proposed data model
Status: Approved (Phase 3A entities only; later entities remain proposed) | Last updated: 2026-11-24

High-level proposals only. No column-level design or tables are implemented in Phase 1. Relationship cardinality and required/optional links remain to be decided in each phase.

Phase 2 adds the approved profiles foundation only: a profile belongs to one Supabase Auth user and is created on their first authenticated OS request. Auth-user deletion cascades to its profile. See 04-data-conventions.md for the Phase 2 definition; companies/contacts/leads are approved for Phase 3A, while later entities remain proposed.

- **Contacts — Approved, Phase 3A.** People with required full_name and at least one of phone/email/instagram_handle; optional company, city and plain-text notes. Stored normalized phone/email support live-contact uniqueness and enquiry matching. One contact may have many leads.
- **Companies — Approved, Phase 3A.** Required name, optional website, industry, city and notes. One company may have many contacts; duplicate names warn without blocking.
- **Leads — Approved, Phase 3A.** Require a contact and source; status defaults new. Include entry_method (manual/integration, default manual), nullable source_detail, service_needs, requirement, optional date-only deadline, bigint INR budget_paise, lost_reason, converted_at and notes. Sources include meta_ads. Phase 3 entry is manual; Meta ads, Instagram and WhatsApp intake belongs to Phase 8. Status/source/entry-method sets and lost checks follow 04-data-conventions.md. Converted does not create/link a deal in Phase 3.
- **Pipeline stages — Proposed, finalized in its phase.** Sales progress definitions; relate to deals.
- **Deals — Proposed, finalized in its phase.** Sales opportunities; relate to leads, contacts/companies, stages, activities and quotations.
- **Activities — Proposed, finalized in its phase.** Sales actions and follow-ups; relate to relevant leads, contacts or deals.
- **Quotations — Proposed, finalized in its phase.** Commercial proposals; relate to deals/clients and resulting orders.
- **Orders — Proposed, finalized in its phase.** Accepted business commitments; relate to quotations/clients and payments.
- **Payments — Proposed, finalized in its phase.** Business receipts; relate to orders/clients for financial reporting.
- **Expenses — Proposed, finalized in its phase.** Business costs supporting financial analytics; any client/order allocation remains open.
- **Integration messages — Proposed, finalized in its phase.** Instagram/WhatsApp interactions relevant to lead intake; may relate to leads, contacts and follow-up activities.

## Open questions
- Later entity boundaries/lifecycles/cardinalities. Phase 3A has no ownership/assignment fields; later assignment requirements remain undecided.
- Whether quotation/order line items or additional integration entities are required; profiles are decided in Phase 2.
- Payment allocation and expense attribution rules.
- Integration-created lead attribution: provider identifiers, campaign/ad/form mapping, and how source_detail is populated (Phase 8).
