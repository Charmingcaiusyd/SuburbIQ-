#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

POD_NAME="${SUBURBIQ_POD_NAME:-suburbiq}"
APP_IMAGE="${SUBURBIQ_APP_IMAGE:-localhost/suburbiq-app:local}"
TOOLS_IMAGE="${SUBURBIQ_TOOLS_IMAGE:-localhost/suburbiq-tools:local}"
ENV_FILE="${SUBURBIQ_ENV_FILE:-containers/podman/suburbiq.env}"
IGNORE_FILE="${SUBURBIQ_IGNORE_FILE:-.containerignore}"
POSTGRES_IMAGE="${SUBURBIQ_POSTGRES_IMAGE:-postgres:16-alpine}"
REDIS_IMAGE="${SUBURBIQ_REDIS_IMAGE:-redis:7-alpine}"
MINIO_IMAGE="${SUBURBIQ_MINIO_IMAGE:-quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z}"

if ! command -v podman >/dev/null 2>&1; then
  echo "Podman is required." >&2
  exit 1
fi

if ! podman info >/dev/null 2>&1; then
  echo "Podman is installed but not running. On Windows run: podman machine init && podman machine start" >&2
  exit 1
fi

podman build --ignorefile "$IGNORE_FILE" -f Containerfile --target builder -t "$TOOLS_IMAGE" .
podman build --ignorefile "$IGNORE_FILE" -f Containerfile --target runtime -t "$APP_IMAGE" .

podman volume create suburbiq-postgres-data >/dev/null
podman volume create suburbiq-minio-data >/dev/null

podman pod rm -f "$POD_NAME" >/dev/null 2>&1 || true
podman pod create \
  --name "$POD_NAME" \
  -p 3000:3000 \
  -p 5432:5432 \
  -p 6379:6379 \
  -p 9000:9000 \
  -p 9001:9001

podman run -d \
  --name suburbiq-postgres \
  --pod "$POD_NAME" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=suburbiq \
  -v suburbiq-postgres-data:/var/lib/postgresql/data \
  "$POSTGRES_IMAGE"

podman run -d \
  --name suburbiq-redis \
  --pod "$POD_NAME" \
  "$REDIS_IMAGE"

podman run -d \
  --name suburbiq-minio \
  --pod "$POD_NAME" \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v suburbiq-minio-data:/data \
  "$MINIO_IMAGE" server /data --console-address ":9001"

ready=0
for _ in $(seq 1 45); do
  if podman exec suburbiq-postgres pg_isready -U postgres -d suburbiq >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "PostgreSQL did not become ready within 90 seconds." >&2
  exit 1
fi

podman run --rm \
  --name suburbiq-migrate \
  --pod "$POD_NAME" \
  --env-file "$ENV_FILE" \
  "$TOOLS_IMAGE" sh -c "npm run db:deploy && npm run db:seed"

podman run -d \
  --name suburbiq-app \
  --pod "$POD_NAME" \
  --env-file "$ENV_FILE" \
  "$APP_IMAGE"

cat <<'MSG'
SuburbIQ is running:
  App:    http://localhost:3000
  Health: http://localhost:3000/api/health
  MinIO:  http://localhost:9001  minioadmin / minioadmin
MSG
