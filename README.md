# SuburbIQ

Sydney Property Data & Buyer Decision Platform.

GitHub: [Charmingcaiusyd/SuburbIQ-](https://github.com/Charmingcaiusyd/SuburbIQ-)

Next.js + TypeScript + PostgreSQL/Prisma scaffold for the Sydney suburb-first property data report and buyer decision support platform.

## Current Phase

This repository is implementing the V1.3 engineering package in phases:

1. Project scaffold and architecture
2. Database schema and migrations
3. Auth, buyer profile and entitlement
4. Suburb/postcode search and map data API
5. Report credit, subscription, order and payment state machines
6. Report job queue, LLM generation and fallback
7. Admin portal
8. Data upload, release and rollback
9. Testing and acceptance criteria
10. Polish and deployment

The current implementation includes the architecture boundaries, Prisma schema, initial SQL migration, domain enums/state machines, auth/profile/entitlement, database-backed suburb/postcode search and map layer APIs, commerce/payment state-machine services, and Phase 6 report job generation with mock LLM/fallback processing. Real LLM, map rendering, BullMQ/Redis workers and storage integrations remain deliberately stubbed for later phases.

## Documentation

- V1.2 use cases: `docs/v1.2-use-case`
- V1.3 engineering specification: `docs/v1.3-engineering-spec`
- Extracted text for search/reference: `docs/_extracted`
- Implementation plan: `docs/v1.3-engineering-spec/implementation-plan.md`

## Local Setup

Install Node.js 20+ and PostgreSQL, then:

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate
npm run dev
```

## Verification Commands

```bash
npm run typecheck
npm run lint
npm test
```

The current execution environment did not expose `node`/`npm`, so dependency installation and runtime checks must be run after Node.js is available.
