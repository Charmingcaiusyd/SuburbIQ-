# Implementation Plan

This plan follows the V1.3 Engineering Implementation Specification and keeps complex integrations stubbed until their phase begins.

## Phase 1: Project Scaffold and Architecture

- Create a Next.js App Router + TypeScript project scaffold.
- Establish module boundaries for public web, customer dashboard, admin portal, backend API, workers and external adapters.
- Add stable API response and error helpers.
- Add interface-based stubs for payment, LLM, map, queue and storage services.

## Phase 2: Database Schema and Migrations

- Implement the V1.3 schema in Prisma with PostgreSQL-compatible enums and relations.
- Add the first SQL migration for users, profiles, geography, scoring releases, products, commerce, reports, admin, support, inbox and audit logs.
- Add immutable snapshot/version fields for report generation.

## Phase 3: Auth, Profile and Entitlement

- Implement registration/login/session handling.
- Add one active buyer profile per customer and weighted completeness scoring.
- Add entitlement read models for orders, credits and subscriptions.

## Phase 4: Suburb/Postcode Search and Map Data API

- Implement database-backed `/suburbs/search` and preview reads.
- Ensure arbitrary free text never becomes a report target.
- Return layer metadata by entitlement from `/map/layers`.

## Phase 5: Commerce and Entitlement State Machines

- Implement products, orders, payments, invoices, subscriptions and report credit hold/capture/release.
- Integrate Stripe first and keep PayPal behind the same provider boundary.

## Phase 6: Report Queue, LLM and Fallback

- Add BullMQ/Redis worker.
- Build context from locked data, scoring, profile and template versions.
- Implement LLM validation, three retries and deterministic fallback rendering.

## Phase 7: Admin Portal

- Add admin pages for users, orders, refunds, credits, subscriptions, report jobs, support and audit logs.
- Add Super Admin pages for coupons, templates, data releases, scoring releases and prediction display settings.

## Phase 8: Data Upload, Release and Rollback

- Add upload validation, change reports, publish and rollback workflows.
- Keep previous approved scoring table active if refresh fails.

## Phase 9: Testing and Acceptance Criteria

- Convert V1.3 acceptance criteria into unit, integration and E2E tests.
- Prioritize profile scoring, state transitions, entitlement compensation and report generation fallback.

## Phase 10: Polish and Deployment

- Add production deployment configuration, observability, security hardening and UI polish.
