# OS single source of truth
Status: Draft | Last updated: 2026-11-24

These documents record the supplied OS project brief and distinguish fixed decisions from open questions. Ruchita reviews each phase. Draft status does not override the brief's fixed decisions.

## Index
- [01 Product](01-product.md): purpose, scope and modules.
- [02 Architecture](02-architecture.md): boundaries and data flow.
- [03 Technology stack](03-tech-stack.md): declared and installed versions.
- [04 Data conventions](04-data-conventions.md): persistence rules.
- [05 Data model](05-data-model.md): proposed entities and relationships.
- [06 Security](06-security.md): secrets, access control and webhooks.
- [07 Environment](07-environment.md): variable names and setup.
- [08 Build plan](08-build-plan.md): phases and verification status.
- [09 Conventions](09-conventions.md): repository layout and implementation practices.

Code must match this SSOT. Any change to a decision must update the SSOT in the same commit. Never store secrets here. Update phase status and installed versions after each phase; report only checks actually run.

## Open questions
- When will Ruchita approve these draft documents?
