param(
  [string]$Java8 = $env:JAVA8,
  [string]$Java21 = $env:JAVA21,
  [string]$Session = "s_demo_package"
)

$ErrorActionPreference = "Stop"
$Root = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "app\collector.jar")) { $PSScriptRoot } else { Split-Path -Parent $PSScriptRoot }
if ([string]::IsNullOrWhiteSpace($Java8)) { $Java8 = "C:\Program Files\Java\jdk1.8.0_221" }
if ([string]::IsNullOrWhiteSpace($Java21)) { $Java21 = "C:\Program Files\Java\jdk-21" }
$Java8Exe = Join-Path $Java8 "bin\java.exe"
$Java21Exe = Join-Path $Java21 "bin\java.exe"
foreach ($path in @($Java8Exe, $Java21Exe)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Java executable missing: $path" }
}
foreach ($file in @("app\collector.jar", "app\agent.jar", "app\launcher.jar", "app\demo.jar", "workbench\index.html")) {
  if (-not (Test-Path -LiteralPath (Join-Path $Root $file))) { throw "Package file missing: $file" }
}

$Work = Join-Path $Root "work"
$Logs = Join-Path $Work "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$PidFile = Join-Path $Work "pids.json"

function Wait-Http([string]$Url, [int]$Seconds = 90) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  throw "Timed out waiting for $Url"
}

$collector = Start-Process -FilePath $Java21Exe -ArgumentList @("-jar", "app\collector.jar") `
  -WorkingDirectory $Root -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $Logs "collector.out.log") `
  -RedirectStandardError (Join-Path $Logs "collector.err.log")
Wait-Http "http://127.0.0.1:8601/actuator/health"

$demo = Start-Process -FilePath $Java8Exe -ArgumentList @(
  "-javaagent:app\agent.jar",
  "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
  "-Dtraceboard.sessionId=$Session",
  "-Dserver.port=8080",
  "-jar", "app\demo.jar"
) -WorkingDirectory $Root -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $Logs "demo.out.log") `
  -RedirectStandardError (Join-Path $Logs "demo.err.log")
Wait-Http "http://127.0.0.1:8080/api/orders"

$ui = Start-Process -FilePath $Java21Exe -ArgumentList @(
  "-jar", "app\launcher.jar", "ui", "--dir", "workbench",
  "--port", "5173", "--collector", "http://127.0.0.1:8601"
) -WorkingDirectory $Root -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $Logs "ui.out.log") `
  -RedirectStandardError (Join-Path $Logs "ui.err.log")
Wait-Http "http://127.0.0.1:5173/"

@{
  collector = $collector.Id
  demo = $demo.Id
  ui = $ui.Id
  session = $Session
  startedAt = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -LiteralPath $PidFile -Encoding UTF8

Start-Process "http://127.0.0.1:5173"
Write-Host "READY workbench=http://127.0.0.1:5173 session=$Session"
Write-Host "logs=$Logs pids=$PidFile"