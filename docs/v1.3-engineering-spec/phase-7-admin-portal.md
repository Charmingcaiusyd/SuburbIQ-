# Phase 7 Admin Portal

Implemented scope:

- Admin and super-admin route guards for API and server-rendered admin pages.
- Database-backed admin dashboard KPIs for users, orders, pending payments, failed report jobs, open support tickets, reports and recent data releases.
- Admin pages under `/admin` for users, orders, report credits, subscriptions, report jobs, reports, support tickets, coupons, data releases, templates, settings and audit logs.
- Audited admin actions for profile access, credit grants, subscription extensions, refunds, report link resend, support replies, coupon creation, data upload registration, data release publish/rollback, report template updates and prediction-display setting changes.
- Stubbed external operations remain intentionally local: refunds update local order/payment state, report resend creates an inbox message, and data upload registration creates metadata pending Phase 8 validation workers.

Access model:

- `admin` can access dashboard, users, orders, credits, subscriptions, report jobs, reports and support tickets.
- `super_admin` is required for coupons, data uploads/releases, report templates, prediction display settings and audit logs.

Next phase handoff:

- Phase 8 should replace upload registration with file storage, validation, change report generation, release confirmation, rollback safety checks and scoring-release promotion.
