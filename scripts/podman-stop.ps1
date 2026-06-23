param(
  [switch]$ResetData
)

$ErrorActionPreference = "Stop"

$PodName = if ($env:SUBURBIQ_POD_NAME) { $env:SUBURBIQ_POD_NAME } else { "suburbiq" }
$PodmanCommand = (Get-Command podman -ErrorAction SilentlyContinue).Source
if (-not $PodmanCommand) {
  $DefaultPodmanPath = "C:\Program Files\RedHat\Podman\podman.exe"
  if (Test-Path $DefaultPodmanPath) {
    $PodmanCommand = $DefaultPodmanPath
  }
}

if (-not $PodmanCommand) {
  throw "Podman is required."
}

& $PodmanCommand pod rm -f $PodName *> $null

if ($ResetData) {
  & $PodmanCommand volume rm -f suburbiq-postgres-data suburbiq-minio-data *> $null
}

Write-Host "SuburbIQ Podman pod stopped."
if ($ResetData) {
  Write-Host "Local PostgreSQL and MinIO volumes were removed."
}
