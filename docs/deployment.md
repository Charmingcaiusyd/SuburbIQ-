# SuburbIQ Deployment Guide

SuburbIQ is a Next.js + TypeScript application backed by PostgreSQL and Prisma. Current integrations for payment, LLM, queue, storage and map rendering are interface-first stubs; production providers should be connected before public launch.

## Required Environment

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `APP_BASE_URL`

Integration variables can stay as `stub` during local development, but production readiness requires real values:

- `STRIPE_SECRET_KEY`
- `PAYPAL_CLIENT_ID`
- `OPENAI_API_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`

## Local Podman Container Run

Windows PowerShell:

```powershell
.\scripts\podman-start.ps1
```

Linux:

```bash
bash scripts/podman-start.sh
```

The Podman startup scripts build OCI images from `Containerfile`, start PostgreSQL, Redis and MinIO in a Podman pod, run Prisma migrations and seed data, then start the Next.js app. See `docs/startup.md` for local startup, logs and reset commands.

Health checks:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health?deep=true
```

## Node Runtime Run

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

## CI

GitHub Actions runs:

```bash
npm install
npx prisma validate
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run test:acceptance
```

## Production Checklist

- Use Podman on Linux/CentOS hosts, or run the Node runtime directly under systemd if the host is older CentOS 7.
- Configure a managed PostgreSQL database and run `npm run db:deploy`.
- Replace stub payment, LLM, Redis, Mapbox and S3-compatible values.
- Set `NEXTAUTH_SECRET` to a high-entropy secret.
- Configure HTTPS and secure cookie settings through `NODE_ENV=production`.
- Verify `/api/health?deep=true` returns `status: ok`.
- Seed or import products, geography, map layers, data release and scoring release records.
- Review `docs/v1.3-engineering-spec/phase-10-polish-deployment-design-audit.md` before launch.
