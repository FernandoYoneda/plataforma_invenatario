[CmdletBinding()]
param(
  [string]$ContainerName = "inventario_db",
  [string]$EnvFile,
  [string]$DbUser,
  [string]$DbName
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

function Assert-LastExitCode {
  param(
    [string]$Step,
    [int]$Code = $LASTEXITCODE
  )

  if ($Code -ne 0) {
    throw "$Step falhou com exit code $Code."
  }
}

if (!$EnvFile) {
  $EnvFile = Join-Path $PSScriptRoot "..\.env"
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker nao encontrado no PATH."
}

if (!(Test-Path -LiteralPath $EnvFile)) {
  throw "Arquivo de ambiente nao encontrado: $EnvFile"
}

$envValues = Read-EnvFile -Path $EnvFile

if (!$DbUser) {
  $DbUser = $envValues["POSTGRES_USER"]
}

if (!$DbName) {
  $DbName = $envValues["POSTGRES_DB"]
}

Assert-RequiredValue -Name "POSTGRES_USER" -Value $DbUser -Source $EnvFile
Assert-RequiredValue -Name "POSTGRES_DB" -Value $DbName -Source $EnvFile

Write-Host "Validando conexao PostgreSQL no container '$ContainerName'..."
& docker exec $ContainerName pg_isready -U $DbUser -d $DbName
Assert-LastExitCode -Step "pg_isready"

& docker exec $ContainerName psql -U $DbUser -d $DbName -c "select 1;" | Out-Null
Assert-LastExitCode -Step "teste de consulta PostgreSQL"

Write-Host "Conexao PostgreSQL validada com sucesso."
