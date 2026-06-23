# Phase 10 Polish, Deployment and Design Audit

## Implemented Phase 10 Artifacts

- Added `/api/health` with lightweight health and optional `?deep=true` database readiness check.
- Added deployment environment status helper for required production variables and integration stubs.
- Enabled Next.js standalone output and disabled the `X-Powered-By` header.
- Added Podman-compatible `Containerfile`, Podman startup scripts, `.containerignore`, GitHub Actions CI and deployment guide.
- Added `npm run ci` to run Prisma validation, client generation, typecheck, lint and tests.
- Updated README/homepage status to Phase 10.

## Design Alignment Summary

Implemented areas align with V1.3 for:

- PostgreSQL/Prisma schema, enums and core state machines.
- Auth/session, user profile, profile snapshot and entitlement read models.
- Database-confirmed suburb/postcode selection and map layer metadata API.
- Products, orders, payments, subscriptions, report credits and GST invoice creation.
- Report job lifecycle with LLM retry states, deterministic fallback and immutable report lineage references.
- Admin/Super Admin roles, admin API guards and audit logging for sensitive actions.
- Data upload validation, change report generation, publish, rollback and quality dashboard.
- Acceptance matrix and unit/server tests for core contracts and state boundaries.

## Implementation Gaps vs Design

These are planned production gaps, not necessarily design faults:

1. Real provider integrations are still mocked.
   Stripe/PayPal signature verification, OpenAI API calls, Mapbox/deck.gl UI, BullMQ/Redis workers and S3-compatible file writes are interface-first stubs.

2. Public/customer UI is incomplete.
   The design includes Map Explore, Suburb Detail Preview, Checkout, My Reports, Profile, Inbox, Support and Subscription pages. Current implementation is API-heavy plus Admin portal.

3. Report rendering is a stub.
   HTML/PDF files are represented by deterministic strings and checksums. Real PDF generation, multi-page watermarking and storage are still required.

4. Report generation is manually processable.
   `/api/report-jobs/[id]/process` simulates worker execution, but there is no BullMQ worker process yet.

5. Payment idempotency and webhook verification are incomplete.
   The API contract requires idempotency keys and provider signature verification. Current implementation validates local payload shape and mock states.

6. Subscription quota has no explicit hold ledger.
   Design says quota is held during generation and captured only on success. Current code increments on success and restores on failure paths, but it does not model a separate quota hold record.

7. Data upload parsers are not implemented.
   Phase 8 accepts JSON rows through Admin API/UI. CSV, Excel, Parquet, GeoJSON, Shapefile and object storage ingestion are still pending.

8. E2E/UI/PDF acceptance coverage remains partial.
   Phase 9 added a matrix and server/unit tests. Browser and PDF artifact tests remain manual/planned.

## Document-by-Document Audit

| Doc | Alignment | Remaining implementation gaps | Design issues |
| --- | --- | --- | --- |
| 00 Master | Core modules, version locking, admin audit, suburb-first search and staged implementation are represented. | Real integrations and customer UI are still stubs/incomplete. | Says actual production code is out of scope while later phases require deployment readiness; production expectations should be separated from MVP scaffolding. |
| 01 Architecture | Next.js API, Admin portal, Prisma database, report/data service boundaries and provider interfaces exist. | No separate BullMQ report worker, data worker process, notification service abstraction or real provider adapters yet. | Observability mentions user-facing error IDs, but no error ID schema/log correlation format is defined. |
| 02 Database | Prisma schema covers users, profiles, geography, scoring, commerce, reports, admin, support, inbox and audit. | Active profile uniqueness, active release uniqueness and quota holds are not DB-enforced. | Admin roles, active release pointer, data-upload lineage and quota-hold models need explicit constraints/tables. |
| 03 API Contract | Most public/auth/profile/report/commerce/admin endpoints exist under `/api`. | Report feedback remains stubbed; idempotency keys and provider signature verification are not implemented. | Contract omits the `/api` prefix and does not define webhook signature/header payloads. |
| 04 State Machines | Domain transition guards and tests exist for reports, credits, payments, orders and data releases. | Subscription quota hold is not a first-class state; manual-review approval flow is incomplete. | `manual_review_required` is a state but not an approval outcome; subscription quota hold needs schema support. |
| 05 UI/Admin Pages | Admin portal covers dashboard, users, orders, credits, subscriptions, reports, jobs, support, coupons, data releases, templates, settings and audit. | Public map, customer dashboard, profile UI, checkout UI, inbox, support upload and report pages are not built. | UI catalogue is broad but lacks priority, responsive acceptance details and exact component states for several customer pages. |
| 06 Report LLM Context | Report worker locks profile/scoring/data/template refs and validates minimum output structure with fallback. | Real OpenAI calls, prompt templates, schema validation and numeric exact-match validation remain pending. | Validation rules require machine-readable schemas and numeric provenance rules that the design does not fully specify. |
| 07 Commerce/Credit | Products, orders, payments, invoices, credits, subscriptions, discounts and refund state changes exist locally. | Real Stripe/PayPal, webhook signatures, partial refunds, subscription renewal and quota reset jobs are pending. | Refund side effects and manual-review approval semantics need sharper product/accounting rules. |
| 08 Data Operations | JSON upload validation, change report, publish, rollback, quality dashboard and template rollback are implemented. | CSV/Excel/Parquet/GeoJSON/Shapefile parsing, S3 raw file storage and model-service recompute are pending. | `data_uploads` lacks direct candidate release foreign keys; stale/severe-stale blocking policy is not formalized. |
| 09 UML/ERD | Components and ERD broadly match implementation modules and schema. | Diagrams still show queue/data worker as separate runtime components that are currently local service calls. | Diagrams omit audit/logging and idempotency paths that are critical operational concerns. |
| 10 Acceptance | 22 AC items are captured in a machine-readable matrix with automated/partial/manual status. | Full DB integration, browser E2E and PDF artifact tests remain planned. | UI/PDF acceptance criteria need fixtures and expected artifact examples to be fully automatable. |

## Design Issues Found

These are places where the V1.3 design itself needs clarification or hardening:

1. Active data release uniqueness is specified but not enforceable as written.
   The DB spec says one active published release per city, but the schema only has `status`. PostgreSQL needs a partial unique index or an explicit active pointer table.

2. Active buyer profile uniqueness is also not enforceable as written.
   The DB spec says one active profile per user, but it needs a partial unique index on active non-deleted profiles or a dedicated active profile pointer.

3. Admin role source of truth is duplicated.
   `users.role` and `admin_users.admin_role` both represent admin authority. The docs do not define which wins if they disagree.

4. Payment manual review approval is underspecified.
   The docs say access is not granted until `payment_confirmed` or manual review approval, but the enum only has `manual_review_required`; there is no approved manual-review state.

5. Subscription quota hold is underspecified in schema.
   The workflow requires holds, but there is no subscription quota hold table or field equivalent to `report_credits.held_by_report_job_id`.

6. Data upload to release lineage is too indirect.
   `data_uploads` has validation/change JSON but no direct `data_release_id` or `scoring_release_id` foreign key. Current implementation stores those IDs in JSON.

7. Report file watermark requirements exceed schema metadata.
   Acceptance criteria require PDF pages to include user email, report ID, order ID and watermark. The schema can derive this, but `report_files` itself does not record watermark metadata/version.

8. LLM validation rules need machine-readable schemas.
   The design requires exact numeric matching, no invented sources and no contradiction between scores and narrative, but the validation schema fields/rules are not fully specified.

9. Refund side effects are incomplete in design.
   Admin refund is required, but the docs do not fully specify whether generated report access, captured credits, subscriptions or invoices should be reversed or retained.

10. Super Admin override for blocked reports is mentioned but not modeled.
   The master warning allows purchase only with Super Admin override, but no override table/state/audit target is specified.

11. Public API path convention is inconsistent.
    The contract lists paths like `/auth/login`, while the Next implementation correctly exposes `/api/auth/login`. The docs should either specify a gateway prefix or canonical `/api` routes.

12. Customer support attachments lack storage governance.
    UI mentions screenshot upload, but storage limits, allowed MIME types, retention and antivirus scanning are not specified.

13. Legal/product boundary needs a stronger disclaimer model.
    The product is a buyer decision platform, but the master doc says legal advice is out of scope. Report template and UI specs should define mandatory disclaimers and suitability limits more formally.

## Recommended Next Fixes

1. Add production provider adapters in this order: Stripe webhook signatures, S3 storage, BullMQ worker, OpenAI generation, Mapbox/deck.gl UI.
2. Add database migration for:
   - active release uniqueness or active release pointer,
   - admin role consistency,
   - subscription quota holds,
   - data upload release foreign keys,
   - blocked-report override records.
3. Add Playwright E2E for public search, free preview, paid report by credit, Admin refund and data publish.
4. Add real PDF rendering and watermark verification tests.
5. Decide whether Admin refund revokes access, issues financial-only refund, or creates a separate adjustment state.
