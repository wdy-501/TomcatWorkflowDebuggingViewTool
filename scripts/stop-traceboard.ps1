param()
$ErrorActionPreference = "Stop"
$Root = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "app\collector.jar")) { $PSScriptRoot } else { Split-Path -Parent $PSScriptRoot }
$PidFile = Join-Path $Root "work\pids.json"
if (-not (Test-Path -LiteralPath $PidFile)) {
  Write-Host "No pid file: $PidFile"
  exit 0
}
$pids = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
foreach ($name in @("ui", "demo", "collector")) {
  $id = $pids.$name
  if ($null -ne $id) {
    try {
      Stop-Process -Id ([int]$id) -Force -ErrorAction Stop
      Write-Host "stopped $name pid=$id"
    } catch {
      Write-Host "not running: $name pid=$id"
    }
  }
}
Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
Write-Host "TraceBoard stopped"