param(
  [string]$OutDir = "dist\release"
)
$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Version = "1.0.0"
$Name = "TraceBoard-$Version-win-x64-portable"
$Out = Join-Path $Repo $OutDir
$Stage = Join-Path $Out $Name
$Zip = Join-Path $Out "$Name.zip"

$artifacts = @(
  "agent\target\traceboard-agent-$Version.jar",
  "server\collector\target\traceboard-collector-$Version.jar",
  "server\launcher\target\traceboard-launcher-$Version.jar",
  "workbench\dist-packaged\index.html"
)
foreach ($file in $artifacts) {
  if (-not (Test-Path -LiteralPath (Join-Path $Repo $file))) { throw "Build artifact missing: $file" }
}

if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "app"), (Join-Path $Stage "workbench") | Out-Null

Copy-Item -LiteralPath (Join-Path $Repo "agent\target\traceboard-agent-$Version.jar") -Destination (Join-Path $Stage "app\agent.jar")
Copy-Item -LiteralPath (Join-Path $Repo "server\collector\target\traceboard-collector-$Version.jar") -Destination (Join-Path $Stage "app\collector.jar")
Copy-Item -LiteralPath (Join-Path $Repo "server\launcher\target\traceboard-launcher-$Version.jar") -Destination (Join-Path $Stage "app\launcher.jar")
Copy-Item -Path (Join-Path $Repo "workbench\dist-packaged\*") -Destination (Join-Path $Stage "workbench") -Recurse -Force
$demoDir = Join-Path $Stage "workbench\demo"
if (Test-Path -LiteralPath $demoDir) { Remove-Item -LiteralPath $demoDir -Recurse -Force }
$fixturesDir = Join-Path $Stage "workbench\fixtures"
if (Test-Path -LiteralPath $fixturesDir) { Remove-Item -LiteralPath $fixturesDir -Recurse -Force }
Copy-Item -LiteralPath (Join-Path $Repo "scripts\TraceBoard.cmd") -Destination $Stage
Copy-Item -LiteralPath (Join-Path $Repo "LICENSE") -Destination $Stage
Copy-Item -LiteralPath (Join-Path $Repo "docs\important-notes.md") -Destination (Join-Path $Stage "IMPORTANT-NOTES.md")

@"
TraceBoard $Version - Windows x64 portable package

REQUIREMENTS
- JDK 21 for TraceBoard launcher/collector.
- JDK 8, 17, or 21 for the application you debug.
- Windows 10/11; only loopback ports are used.

QUICK START
1. Open a terminal in this folder.
2. Run:
   TraceBoard.cmd run --jar "C:\path\to\your-app.jar" --java "C:\path\to\jdk\bin\java.exe"
3. TraceBoard starts the collector (default :8601), the workbench (default :5173),
   and your JAR (default :8080), then opens the "My App" tab.

OPTIONS
  --port <port>            application port (default 8080); also sets -Dserver.port
  --collector-port <port>  collector port (default 8601)
  --ui-port <port>         workbench port (default 5173)
  --app-url <url>          URL embedded in the My App tab (default http://127.0.0.1:8080/)
  --include <package>      override auto-detected application package
  --exclude <package>      exclude noisy getters/DTO packages
  --include-method <class#method>
  --health <url>           wait for this application health URL
  --no-open                do not open a browser
  --java <path>            java.exe used for the application

STOP
Copy and run the STOP command printed by TraceBoard, or use:
  java -jar app\launcher.jar stop --session <session-id>

LOGS
  work\logs\

BOUNDARIES
Local use only. No cloud upload, no telemetry, no dynamic attach, no line-level
locals. See README.md and docs\important-notes.md in the source repository.
"@ | Set-Content -LiteralPath (Join-Path $Stage "README-PORTABLE.txt") -Encoding UTF8

if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Zip -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $([IO.Path]::GetFileName($Zip))" | Set-Content -LiteralPath (Join-Path $Out "$Name.zip.sha256") -Encoding ASCII
Write-Host "PACKAGE=$Zip"
Write-Host "SHA256=$hash"