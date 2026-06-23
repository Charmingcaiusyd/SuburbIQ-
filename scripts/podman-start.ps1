$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$PodName = if ($env:SUBURBIQ_POD_NAME) { $env:SUBURBIQ_POD_NAME } else { "suburbiq" }
$AppImage = if ($env:SUBURBIQ_APP_IMAGE) { $env:SUBURBIQ_APP_IMAGE } else { "localhost/suburbiq-app:local" }
$ToolsImage = if ($env:SUBURBIQ_TOOLS_IMAGE) { $env:SUBURBIQ_TOOLS_IMAGE } else { "localhost/suburbiq-tools:local" }
$EnvFile = if ($env:SUBURBIQ_ENV_FILE) { $env:SUBURBIQ_ENV_FILE } else { "containers/podman/suburbiq.env" }
$IgnoreFile = if ($env:SUBURBIQ_IGNORE_FILE) { $env:SUBURBIQ_IGNORE_FILE } else { ".containerignore" }
$PostgresImage = if ($env:SUBURBIQ_POSTGRES_IMAGE) { $env:SUBURBIQ_POSTGRES_IMAGE } else { "postgres:16-alpine" }
$RedisImage = if ($env:SUBURBIQ_REDIS_IMAGE) { $env:SUBURBIQ_REDIS_IMAGE } else { "redis:7-alpine" }
$MinioImage = if ($env:SUBURBIQ_MINIO_IMAGE) { $env:SUBURBIQ_MINIO_IMAGE } else { "quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z" }
$PodmanCommand = (Get-Command podman -ErrorAction SilentlyContinue).Source
if (-not $PodmanCommand) {
  $DefaultPodmanPath = "C:\Program Files\RedHat\Podman\podman.exe"
  if (Test-Path $DefaultPodmanPath) {
    $PodmanCommand = $DefaultPodmanPath
  }
}

function Invoke-Podman {
  & $script:PodmanCommand @args
  if ($LASTEXITCODE -ne 0) {
    throw "podman $args failed with exit code $LASTEXITCODE"
  }
}

function Stop-WithMessage {
  param([string]$Message)
  [Console]::Error.WriteLine($Message)
  exit 1
}

if (-not $PodmanCommand) {
  Stop-WithMessage "Podman is required. Install Podman, then run 'podman machine init --now' on Windows."
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$podmanInfo = & $PodmanCommand info 2>&1
$podmanInfoExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($podmanInfoExitCode -ne 0) {
  Stop-WithMessage "Podman is installed but not running. On Windows run 'podman machine init --now'. If that fails, enable BIOS/UEFI virtualization and the Windows Virtual Machine Platform feature. Details: $podmanInfo"
}

Invoke-Podman build --ignorefile $IgnoreFile -f Containerfile --target builder -t $ToolsImage .
Invoke-Podman build --ignorefile $IgnoreFile -f Containerfile --target runtime -t $AppImage .

Invoke-Podman volume create suburbiq-postgres-data | Out-Null
Invoke-Podman volume create suburbiq-minio-data | Out-Null

& $PodmanCommand pod rm -f $PodName *> $null

Invoke-Podman pod create `
  --name $PodName `
  -p 3000:3000 `
  -p 5432:5432 `
  -p 6379:6379 `
  -p 9000:9000 `
  -p 9001:9001

Invoke-Podman run -d `
  --name suburbiq-postgres `
  --pod $PodName `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=suburbiq `
  -v suburbiq-postgres-data:/var/lib/postgresql/data `
  $PostgresImage

Invoke-Podman run -d `
  --name suburbiq-redis `
  --pod $PodName `
  $RedisImage

Invoke-Podman run -d `
  --name suburbiq-minio `
  --pod $PodName `
  -e MINIO_ROOT_USER=minioadmin `
  -e MINIO_ROOT_PASSWORD=minioadmin `
  -v suburbiq-minio-data:/data `
  $MinioImage server /data --console-address ":9001"

$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  & $PodmanCommand exec suburbiq-postgres pg_isready -U postgres -d suburbiq *> $null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  throw "PostgreSQL did not become ready within 90 seconds."
}

Invoke-Podman run --rm `
  --name suburbiq-migrate `
  --pod $PodName `
  --env-file $EnvFile `
  $ToolsImage sh -c "npm run db:deploy && npm run db:seed"

Invoke-Podman run -d `
  --name suburbiq-app `
  --pod $PodName `
  --env-file $EnvFile `
  $AppImage

Write-Host "SuburbIQ is running:"
Write-Host "  App:    http://localhost:3000"
Write-Host "  Health: http://localhost:3000/api/health"
Write-Host "  MinIO:  http://localhost:9001  minioadmin / minioadmin"
