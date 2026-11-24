param(
  [string]$OutDir = "dist\release"
)
$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Version = "0.1.0"
$Name = "TraceBoard-$Version-win-x64-portable"
$Out = Join-Path $Repo $OutDir
$Stage = Join-Path $Out $Name
$Zip = Join-Path $Out "$Name.zip"

foreach ($file in @(
  "agent\target\traceboard-agent-0.1.0-SNAPSHOT.jar",
  "server\collector\target\traceboard-collector-0.1.0-SNAPSHOT.jar",
  "server\launcher\target\traceboard-launcher-0.1.0-SNAPSHOT.jar",
  "demo\buggy-shop-boot-vue\backend\target\demo-shop-backend-0.1.0-SNAPSHOT.jar",
  "workbench\dist\index.html"
)) {
  if (-not (Test-Path -LiteralPath (Join-Path $Repo $file))) { throw "Build artifact missing: $file" }
}

if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "app"), (Join-Path $Stage "workbench"), (Join-Path $Stage "site") | Out-Null

Copy-Item -LiteralPath (Join-Path $Repo "agent\target\traceboard-agent-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $Stage "app\agent.jar")
Copy-Item -LiteralPath (Join-Path $Repo "server\collector\target\traceboard-collector-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $Stage "app\collector.jar")
Copy-Item -LiteralPath (Join-Path $Repo "server\launcher\target\traceboard-launcher-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $Stage "app\launcher.jar")
Copy-Item -LiteralPath (Join-Path $Repo "demo\buggy-shop-boot-vue\backend\target\demo-shop-backend-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $Stage "app\demo.jar")
Copy-Item -Path (Join-Path $Repo "workbench\dist\*") -Destination (Join-Path $Stage "workbench") -Recurse -Force
if (Test-Path -LiteralPath (Join-Path $Repo "site\traceboard\dist")) {
  Copy-Item -Path (Join-Path $Repo "site\traceboard\dist\*") -Destination (Join-Path $Stage "site") -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $Repo "scripts\run-traceboard.ps1") -Destination $Stage
Copy-Item -LiteralPath (Join-Path $Repo "scripts\stop-traceboard.ps1") -Destination $Stage
Copy-Item -LiteralPath (Join-Path $Repo "scripts\Run-TraceBoard.cmd") -Destination $Stage
Copy-Item -LiteralPath (Join-Path $Repo "scripts\Stop-TraceBoard.cmd") -Destination $Stage
@"
TraceBoard $Version — Windows portable package (requires JDK 8 and JDK 21)

1. Install Eclipse Temurin JDK 8 and JDK 21 (do not redistribute Oracle JDK).
2. Set JAVA8 and JAVA21 to the JDK homes, or edit run-traceboard.ps1 defaults.
3. Run Run-TraceBoard.cmd. It starts collector :8601, demo :8080, workbench :5173.
4. Workbench session: s_demo_package.
5. Stop-TraceBoard.cmd stops the three processes.
6. Logs/PIDs: work\.
7. This is a local portable package; no cloud, no upload, no Qoder Site.
"@ | Set-Content -LiteralPath (Join-Path $Stage "README-PORTABLE.txt") -Encoding UTF8

if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Zip -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $([IO.Path]::GetFileName($Zip))" | Set-Content -LiteralPath (Join-Path $Out "$Name.zip.sha256") -Encoding ASCII
Write-Host "PACKAGE=$Zip"
Write-Host "SHA256=$hash"