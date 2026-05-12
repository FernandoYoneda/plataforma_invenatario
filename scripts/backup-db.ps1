[CmdletBinding()]
param(
  [string]$ContainerName = "inventario_db",
  [string]$EnvFile,
  [string]$BackupDir,
  [string]$DbUser,
  [string]$DbName
)

$ErrorActionPreference = "Stop"

if (!$EnvFile) {
  $EnvFile = Join-Path $PSScriptRoot "..\.env"
}

if (!$BackupDir) {
  $BackupDir = Join-Path $PSScriptRoot "..\backups"
}

function Read-EnvFile {
  param([string]$Path)

  $values = @{}

  if (!(Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') {
      continue
    }

    if ($line -match '^\s*([^=]+?)\s*=\s*(.*)\s*$') {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim()

      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        $value = $value.Substring(1, $value.Length - 2)
      }

      $values[$key] = $value
    }
  }

  return $values
}

function Assert-LastExitCode {
  param(
    [string]$Step,
    [int]$Code = $LASTEXITCODE
  )

  if ($Code -ne 0) {
    throw "$Step falhou com exit code $Code."
  }
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker nao encontrado no PATH."
}

$envValues = Read-EnvFile -Path $EnvFile

if (!$DbUser) {
  $DbUser = $envValues["POSTGRES_USER"]
}

if (!$DbName) {
  $DbName = $envValues["POSTGRES_DB"]
}

if (!$DbUser) {
  throw "Informe -DbUser ou defina POSTGRES_USER no arquivo .env."
}

if (!$DbName) {
  throw "Informe -DbName ou defina POSTGRES_DB no arquivo .env."
}

$backupDirPath = [System.IO.Path]::GetFullPath($BackupDir)
New-Item -ItemType Directory -Path $backupDirPath -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeDbName = $DbName -replace '[^a-zA-Z0-9_.-]', '_'
$fileName = "$safeDbName-$timestamp.dump"
$backupPath = Join-Path $backupDirPath $fileName
$containerPath = "/tmp/$fileName"

Write-Host "Gerando backup do banco '$DbName' no container '$ContainerName'..."
& docker exec $ContainerName pg_dump -U $DbUser -d $DbName -F c -f $containerPath
Assert-LastExitCode -Step "pg_dump"

try {
  & docker cp "${ContainerName}:$containerPath" $backupPath
  Assert-LastExitCode -Step "docker cp"
} finally {
  & docker exec $ContainerName rm -f $containerPath | Out-Null
}

Write-Host "Backup salvo em: $backupPath"
