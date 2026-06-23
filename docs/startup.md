# SuburbIQ Startup Guide

SuburbIQ is the Sydney Property Data & Buyer Decision Platform. The recommended container startup path uses Podman and OCI images.

Podman is native on Linux and CentOS. On Windows 10 Enterprise, Podman runs Linux containers through a Podman machine backed by WSL2 or Hyper-V, so Windows virtualization still needs to be available.

## Prerequisites

- Podman 4+.
- Windows only: initialize and start a Podman machine.
- Optional: Node.js 20+ if you want to run the app without containers.

References:

- Podman install docs: https://podman.io/docs/installation
- Podman for Windows guide: https://github.com/containers/podman/blob/main/docs/tutorials/podman-for-windows.md

## Windows 10 Enterprise Setup

Install Podman CLI:

```powershell
winget install -e --id RedHat.Podman
```

Optional desktop UI:

```powershell
winget install -e --id RedHat.Podman-Desktop
```

Create and start the Podman machine:

```powershell
podman machine init
podman machine start
podman info
```

If WSL2 remains broken on this machine, use Podman Desktop to create a Hyper-V backed machine if your installed version exposes that option. Windows 10 Enterprise supports Hyper-V, but BIOS/UEFI virtualization must be enabled.

If `podman machine init --now` fails with `HCS_E_HYPERV_NOT_INSTALLED` or says virtualization is not enabled, check:

```powershell
systeminfo | findstr /i "Virtualization Firmware Hyper-V"
```

This machine must report:

```text
Virtualization Enabled In Firmware: Yes
```

If it reports `No`, enable Intel VT-x / Intel Virtualization Technology / AMD-V in BIOS or UEFI, reboot Windows, then run:

```powershell
podman machine init --now
podman info
```

## Linux / CentOS Setup

RHEL-compatible Linux or CentOS Stream 8/9:

```bash
sudo dnf install -y podman
podman info
```

Older CentOS 7 hosts often ship old container tooling and kernels. Prefer CentOS Stream 9, RHEL-compatible 8/9 hosts, or run SuburbIQ natively with Node.js/systemd on CentOS 7.

## One-command Podman Startup

Windows PowerShell:

```powershell
.\scripts\podman-start.ps1
```

Linux shell:

```bash
bash scripts/podman-start.sh
```

This command starts:

- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`
- `minio` on `localhost:9000` and the MinIO console on `localhost:9001`
- a one-off migration container, which runs `npm run db:deploy` and `npm run db:seed`
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

## Seeded Local Data

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

## Useful Podman Commands

Check service status:

```bash
podman pod ps
podman ps --pod
```

Follow app logs:

```bash
podman logs -f suburbiq-app
```

Open a shell in the app container:

```bash
podman exec -it suburbiq-app sh
```

Stop services on Windows:

```powershell
.\scripts\podman-stop.ps1
```

Stop services on Linux:

```bash
bash scripts/podman-stop.sh
```

Reset all local container data on Windows:

```powershell
.\scripts\podman-stop.ps1 -ResetData
.\scripts\podman-start.ps1
```

Reset all local container data on Linux:

```bash
bash scripts/podman-stop.sh --reset-data
bash scripts/podman-start.sh
```

Use a private environment file for server deployments:

```bash
cp containers/podman/suburbiq.env .env.podman.local
SUBURBIQ_ENV_FILE=.env.podman.local bash scripts/podman-start.sh
```

On Windows PowerShell:

```powershell
Copy-Item containers\podman\suburbiq.env .env.podman.local
$env:SUBURBIQ_ENV_FILE = ".env.podman.local"
.\scripts\podman-start.ps1
```

## Optional Node Startup

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
