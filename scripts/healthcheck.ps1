[CmdletBinding()]
param(
  [string]$EnvFile,
  [string]$BackupDir,
  [string]$UploadDir
)

$ErrorActionPreference = "Stop"

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

function Assert-RequiredValue {
  param(
    [string]$Name,
    [string]$Value,
    [string]$Source
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Informe $Name ou defina a variavel correspondente no arquivo .env ($Source)."
  }
}

if (!$EnvFile) {
  $EnvFile = Join-Path $PSScriptRoot "..\.env"
}

if (!$BackupDir) {
  $BackupDir = Join-Path $PSScriptRoot "..\backups"
}

if (!$UploadDir) {
  $UploadDir = Join-Path $PSScriptRoot "..\uploads\assets"
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker nao encontrado no PATH."
}

if (!(Test-Path -LiteralPath $EnvFile)) {
  throw "Arquivo de ambiente nao encontrado: $EnvFile"
}

$envValues = Read-EnvFile -Path $EnvFile

Assert-RequiredValue -Name "POSTGRES_USER" -Value $envValues["POSTGRES_USER"] -Source $EnvFile
Assert-RequiredValue -Name "POSTGRES_PASSWORD" -Value $envValues["POSTGRES_PASSWORD"] -Source $EnvFile
Assert-RequiredValue -Name "POSTGRES_DB" -Value $envValues["POSTGRES_DB"] -Source $EnvFile
Assert-RequiredValue -Name "JWT_SECRET" -Value $envValues["JWT_SECRET"] -Source $EnvFile
Assert-RequiredValue -Name "NEXT_PUBLIC_API_URL" -Value $envValues["NEXT_PUBLIC_API_URL"] -Source $EnvFile

$backupDirPath = [System.IO.Path]::GetFullPath($BackupDir)
$uploadDirPath = [System.IO.Path]::GetFullPath($UploadDir)

New-Item -ItemType Directory -Path $backupDirPath -Force | Out-Null
New-Item -ItemType Directory -Path $uploadDirPath -Force | Out-Null

Write-Host "Healthcheck operacional concluido."
Write-Host "Backup: $backupDirPath"
Write-Host "Uploads: $uploadDirPath"
Write-Host "Variaveis de ambiente: OK"
