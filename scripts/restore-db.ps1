[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$ContainerName = "inventario_db",
  [string]$EnvFile,
  [string]$DbUser,
  [string]$DbName,
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (!$EnvFile) {
  $EnvFile = Join-Path $PSScriptRoot "..\.env"
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

if (!(Test-Path -LiteralPath $BackupFile)) {
  throw "Arquivo de backup nao encontrado: $BackupFile"
}

$backupPath = (Resolve-Path -LiteralPath $BackupFile).Path
$fileName = Split-Path -Leaf $backupPath
$containerPath = "/tmp/restore-$fileName"

if ($DryRun) {
  Write-Host "Dry run: nenhuma alteracao sera feita."
  Write-Host "Container: $ContainerName"
  Write-Host "Banco: $DbName"
  Write-Host "Arquivo: $backupPath"
  & docker exec $ContainerName pg_restore --version
  Assert-LastExitCode -Step "pg_restore --version"
  & docker exec $ContainerName psql -U $DbUser -d $DbName -c "select 1;" | Out-Null
  Assert-LastExitCode -Step "teste de conexao com psql"
  Write-Host "Dry run concluido com sucesso."
  exit 0
}

if (!$Force) {
  throw "Restore sobrescreve dados do banco '$DbName'. Reexecute com -Force para confirmar ou use -DryRun para validar."
}

Write-Host "Copiando backup para o container '$ContainerName'..."
& docker cp $backupPath "${ContainerName}:$containerPath"
Assert-LastExitCode -Step "docker cp"

try {
  Write-Host "Restaurando backup em '$DbName'. Esta operacao pode sobrescrever dados..."
  & docker exec $ContainerName pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner $containerPath
  Assert-LastExitCode -Step "pg_restore"
} finally {
  & docker exec $ContainerName rm -f $containerPath | Out-Null
}

Write-Host "Restore concluido."
