# API Route Map

The route skeleton follows `03_API_Contract_Specification_V1_3`.

## Public and Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/suburbs/search`
- `GET /api/suburbs/[suburbId]/preview`
- `GET /api/map/layers`
- `GET /api/pricing`

## Profile

- `GET /api/profile/me`
- `PUT /api/profile/me`
- `POST /api/profile/snapshot`
- `GET /api/profile/questionnaire`

## Reports

- `POST /api/reports/free-preview`
- `POST /api/reports/generate`
- `GET /api/report-jobs/[id]`
- `POST /api/report-jobs/[id]/process`
- `GET /api/reports`
- `GET /api/reports/[id]`
- `GET /api/reports/[id]/download`
- `POST /api/reports/[id]/feedback`

## Commerce

- `POST /api/checkout/create-session`
- `POST /api/webhooks/stripe`
- `POST /api/webhooks/paypal`
- `GET /api/orders`
- `GET /api/subscriptions/me`
- `GET /api/credits/me`
- `GET /api/entitlements/me`
- `POST /api/coupons/validate`

## Admin and Super Admin

- `GET /api/admin/users`
- `GET /api/admin/users/[id]/profile`
- `POST /api/admin/orders/[id]/refund`
- `POST /api/admin/users/[id]/credits`
- `POST /api/admin/subscriptions/[id]/extend`
- `GET /api/admin/report-jobs`
- `POST /api/admin/reports/[id]/resend`
- `GET /api/admin/support-tickets`
- `POST /api/admin/support-tickets/[id]/reply`
- `POST /api/admin/coupons`
- `PUT /api/admin/report-templates/[id]`
- `POST /api/admin/report-templates/[id]/rollback`
- `POST /api/admin/data/uploads`
- `POST /api/admin/data/uploads/[id]/validate`
- `GET /api/admin/data/quality`
- `GET /api/admin/data-releases`
- `POST /api/admin/data/releases/[id]/publish`
- `POST /api/admin/data/releases/[id]/rollback`
- `PUT /api/admin/settings/prediction-display`
- `GET /api/admin/audit-logs`
