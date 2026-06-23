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

The current implementation includes the architecture boundaries, Prisma schema, initial SQL migration, domain enums/state machines, auth/profile/entitlement, database-backed suburb/postcode search and map layer APIs, commerce/payment state-machine services, Phase 6 report job generation with mock LLM/fallback processing, the Phase 7 admin portal with audited management actions, Phase 8 local-first data upload validation, change reports, release publishing and rollback, Phase 9 acceptance/test coverage, and Phase 10 deployment/CI/health-check polish plus a design audit. Real LLM, map rendering, BullMQ/Redis workers, storage integrations and binary data parsers remain deliberately stubbed for later phases.

## Documentation

- V1.2 use cases: `docs/v1.2-use-case`
- V1.3 engineering specification: `docs/v1.3-engineering-spec`
- Extracted text for search/reference: `docs/_extracted`
- Implementation plan: `docs/v1.3-engineering-spec/implementation-plan.md`
- Startup guide: `docs/startup.md`
- Deployment guide: `docs/deployment.md`
- Phase 10 design audit: `docs/v1.3-engineering-spec/phase-10-polish-deployment-design-audit.md`

## Local Setup

Recommended container startup uses Podman:

```powershell
.\scripts\podman-start.ps1
```

On Linux/macOS shells:

```bash
bash scripts/podman-start.sh
```

For a native Node runtime, install Node.js 20+ and PostgreSQL, then:

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
npm run test:unit
npm run test:acceptance
npm run ci
```

The current execution environment did not expose `node`/`npm`, so dependency installation and runtime checks must be run after Node.js is available.
