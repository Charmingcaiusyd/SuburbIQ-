#!/usr/bin/env bash
set -euo pipefail

POD_NAME="${SUBURBIQ_POD_NAME:-suburbiq}"
RESET_DATA="${1:-}"

if ! command -v podman >/dev/null 2>&1; then
  echo "Podman is required." >&2
  exit 1
fi

podman pod rm -f "$POD_NAME" >/dev/null 2>&1 || true

if [ "$RESET_DATA" = "--reset-data" ]; then
  podman volume rm -f suburbiq-postgres-data suburbiq-minio-data >/dev/null 2>&1 || true
  echo "SuburbIQ Podman pod stopped and local PostgreSQL/MinIO volumes were removed."
else
  echo "SuburbIQ Podman pod stopped."
fi
