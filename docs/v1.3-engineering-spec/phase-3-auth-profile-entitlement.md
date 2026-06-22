# Phase 3 Auth, Profile and Entitlement

Implemented in this phase:

- Custom HMAC JWT session token stored in an HTTP-only `spd_session` cookie.
- `POST /api/auth/register` creates customer users with bcrypt password hashes.
- `POST /api/auth/login` verifies password and returns `access_token` plus user.
- `POST /api/auth/logout` clears the session cookie.
- `GET /api/auth/session` restores the current authenticated user.
- `GET /api/profile/me` returns the active buyer profile, completeness score and missing mandatory fields.
- `PUT /api/profile/me` creates or updates the user's single active buyer profile.
- `POST /api/profile/snapshot` creates an immutable profile snapshot for report generation.
- `GET /api/profile/questionnaire` reads the active questionnaire version, falling back to V1.3 defaults.
- `GET /api/orders`, `/api/credits/me`, `/api/subscriptions/me` and `/api/entitlements/me` provide authenticated entitlement read models.

Still deferred:

- Email verification delivery.
- Password reset.
- OAuth/SAML/social auth.
- Admin impersonation and granular RBAC.
- Payment-confirmed entitlement granting and credit/subscription state changes.
- Subscription quota holds and credit capture/release mutations.

Local smoke flow after installing dependencies:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Then call:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"buyer@example.com\",\"password\":\"password123\"}"

curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"buyer@example.com\",\"password\":\"password123\"}"
```
