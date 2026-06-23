# SuburbIQ Startup Guide

SuburbIQ is the Sydney Property Data & Buyer Decision Platform. The local startup path uses Docker Compose because it brings up PostgreSQL, Redis and MinIO with the app and runs Prisma migrations plus seed data before the web service starts.

## Prerequisites

- Docker Desktop or Docker Engine with Docker Compose.
- Optional: Node.js 20+ if you want to run the app without containers.

## One-command Docker startup

From the repository root:

```bash
docker compose up --build -d
```

This command starts:

- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`
- `minio` on `localhost:9000` and the MinIO console on `localhost:9001`
- `migrate`, which runs `npm run db:deploy` and `npm run db:seed`
- `app` on `localhost:3000`

Open the app:

```text
http://localhost:3000
```

Health checks:

```bash
curl http://localhost:3000/api/health
curl "http://localhost:3000/api/health?deep=true"
```

The deep health check verifies the database connection. Stubbed integrations such as Stripe, PayPal, OpenAI and Mapbox are expected during local scaffold development.

## Seeded local data

The seed task creates:

- Product catalog rows for single reports, credit packs and subscriptions.
- A `DEVFREE` coupon.
- Sydney / postcode `2000` sample geography.
- Published seed data and scoring releases.
- Sample map layers and report templates.

The seed does not create an admin user. The admin portal exists at `http://localhost:3000/admin`, but admin access requires a user with the `admin` or `super_admin` role.

MinIO console:

```text
http://localhost:9001
username: minioadmin
password: minioadmin
```

## Useful Docker commands

Check service status:

```bash
docker compose ps
```

Follow app logs:

```bash
docker compose logs -f app
```

Check migration and seed logs:

```bash
docker compose logs migrate
```

Stop services:

```bash
docker compose down
```

Reset all local container data:

```bash
docker compose down -v
docker compose up --build -d
```

Re-run migrations and seed without recreating all services:

```bash
docker compose run --rm migrate
```

## Docker Desktop / WSL troubleshooting

If `docker compose up --build -d` fails with an error similar to:

```text
Docker Desktop is unable to start
There was a problem with WSL
```

Verify Docker and WSL first:

```bash
docker desktop status
docker info
wsl --status
wsl --version
```

Docker Desktop for Linux containers requires a working WSL 2 backend on Windows. If `wsl --version` prints help text or fails, update or install the current WSL package, then restart Docker Desktop:

```bash
wsl --update --web-download
wsl --shutdown
```

If the update command hangs or asks for a reboot, complete the WSL repair manually from Windows Settings or Microsoft Store, restart the machine if requested, open Docker Desktop, then run:

```bash
docker compose up --build -d
```

If Docker Desktop still returns to `stopped` and its backend log contains `hasNoVirtualization=true`, check the Windows hardware virtualization status:

```bash
systeminfo | findstr /i "Virtualization Firmware Hyper-V"
```

Docker Desktop cannot start the Linux engine while this value is `Virtualization Enabled In Firmware: No`. Enable Intel VT-x / Intel Virtualization Technology in BIOS or UEFI, save the change, reboot Windows, then start Docker Desktop again.

## Optional Node startup

If Node.js 20+ is installed locally, copy the example environment and run:

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The app will be available at:

```text
http://localhost:3000
```
