[CmdletBinding()]
param(
  [string]$ApiUrl,
  [string]$EnvFile
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

if (!$EnvFile) {
  $EnvFile = Join-Path $PSScriptRoot "..\.env"
}

if (!(Test-Path -LiteralPath $EnvFile)) {
  throw "Arquivo de ambiente nao encontrado: $EnvFile"
}

$envValues = Read-EnvFile -Path $EnvFile

if (!$ApiUrl) {
  $ApiUrl = $envValues["NEXT_PUBLIC_API_URL"]
}

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
  $ApiUrl = "http://localhost:3000"
}

$rootUrl = ($ApiUrl.TrimEnd("/")) + "/"

Write-Host "Validando API em $rootUrl ..."

try {
  $response = Invoke-WebRequest -Uri $rootUrl -Method Get -TimeoutSec 15
} catch {
  throw "Nao foi possivel acessar a API em $rootUrl. Verifique se o servico esta no ar."
}

if ($response.StatusCode -ne 200) {
  throw "API respondeu com status $($response.StatusCode) em $rootUrl."
}

$body = ($response.Content | Out-String).Trim()

if ($body -ne "Hello World!") {
  throw "API respondeu, mas o conteudo esperado nao foi encontrado."
}

Write-Host "API validada com sucesso."
