# Phase 9 Testing and Acceptance Criteria

Implemented scope:

- Added `docs/v1.3-engineering-spec/acceptance-matrix.json` as the machine-readable source of truth for all V1.3 acceptance criteria.
- Added an acceptance matrix test that ensures every documented AC ID is tracked exactly once and has Given/When/Then, layer, automation status, verification command and implementation references.
- Expanded domain tests for profile score boundaries and data release publish/rollback transitions.
- Added server contract tests for checkout/webhook schemas.
- Added report generation validation tests for LLM output/fallback gating.
- Added data release workflow tests for upload schemas, quality dashboard, publish activation, rollback and generated-report retention.
- Added npm scripts:
  - `npm run test:unit`
  - `npm run test:acceptance`

Coverage status:

- Automated now: profile scoring boundaries, state transition guards, commerce API schemas, report output validation, data quality dashboard, data publish and rollback service behavior, acceptance matrix completeness.
- Partial coverage: credit/report success and fallback compensation are represented through state machines and report validation tests, but need full database-backed integration tests once a test database is available.
- Manual/planned: browser UI and PDF artifact checks remain planned for E2E automation in Phase 10/polish.

Verification commands:

```bash
npm run typecheck
npm run lint
npm test
npm run test:unit
npm run test:acceptance
```

Environment note:

The current Codex execution environment does not expose `node` or `npm`, so commands must be run in a Node.js 20+ environment.
