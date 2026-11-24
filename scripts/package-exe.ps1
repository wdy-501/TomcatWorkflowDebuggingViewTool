param(
  [string]$Java21 = $env:JAVA21,
  [string]$Java8 = $env:JAVA8,
  [string]$BundleJre8 = "",
  [string]$BundleJre21 = "",
  [string]$OutDir = "dist\exe"
)
$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($Java21)) { $Java21 = "C:\Program Files\Java\jdk-21" }
if ([string]::IsNullOrWhiteSpace($Java8)) { $Java8 = "C:\Program Files\Java\jdk1.8.0_221" }
$Jpackage = Join-Path $Java21 "bin\jpackage.exe"
$Javac = Join-Path $Java21 "bin\javac.exe"
$Jar = Join-Path $Java21 "bin\jar.exe"
foreach ($tool in @($Jpackage, $Javac, $Jar)) {
  if (-not (Test-Path -LiteralPath $tool)) { throw "JDK tool missing: $tool" }
}
foreach ($file in @(
  "agent\target\traceboard-agent-0.1.0-SNAPSHOT.jar",
  "server\collector\target\traceboard-collector-0.1.0-SNAPSHOT.jar",
  "server\launcher\target\traceboard-launcher-0.1.0-SNAPSHOT.jar",
  "demo\buggy-shop-boot-vue\backend\target\demo-shop-backend-0.1.0-SNAPSHOT.jar",
  "workbench\dist\index.html"
)) {
  if (-not (Test-Path -LiteralPath (Join-Path $Repo $file))) { throw "Build artifact missing: $file" }
}

$Build = Join-Path $Repo "build\release-exe"
$Classes = Join-Path $Build "classes"
$Input = Join-Path $Build "input"
if (Test-Path -LiteralPath $Build) { Remove-Item -LiteralPath $Build -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Classes, $Input | Out-Null
& $Javac -d $Classes (Join-Path $Repo "packaging\ReleaseLauncher.java")
if ($LASTEXITCODE -ne 0) { throw "javac failed" }
& $Jar cfe (Join-Path $Input "traceboard-release.jar") "io.traceboard.release.ReleaseLauncher" -C $Classes .
if ($LASTEXITCODE -ne 0) { throw "jar failed" }

$Out = Join-Path $Repo $OutDir
if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
& $Jpackage --type app-image --name TraceBoard --dest $Out --input $Input `
  --main-jar traceboard-release.jar --main-class io.traceboard.release.ReleaseLauncher `
  --app-version 0.1.0 --vendor TraceBoard --win-console
if ($LASTEXITCODE -ne 0) { throw "jpackage failed" }

$App = Join-Path $Out "TraceBoard"
New-Item -ItemType Directory -Force -Path (Join-Path $App "app"), (Join-Path $App "workbench") | Out-Null
Copy-Item -LiteralPath (Join-Path $Repo "agent\target\traceboard-agent-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $App "app\agent.jar")
Copy-Item -LiteralPath (Join-Path $Repo "server\collector\target\traceboard-collector-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $App "app\collector.jar")
Copy-Item -LiteralPath (Join-Path $Repo "server\launcher\target\traceboard-launcher-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $App "app\launcher.jar")
Copy-Item -LiteralPath (Join-Path $Repo "demo\buggy-shop-boot-vue\backend\target\demo-shop-backend-0.1.0-SNAPSHOT.jar") -Destination (Join-Path $App "app\demo.jar")
Copy-Item -Path (Join-Path $Repo "workbench\dist\*") -Destination (Join-Path $App "workbench") -Recurse -Force

if (-not [string]::IsNullOrWhiteSpace($BundleJre8)) {
  if (-not (Test-Path -LiteralPath (Join-Path $BundleJre8 "bin\java.exe"))) { throw "BundleJre8 is not a JRE/JDK: $BundleJre8" }
  New-Item -ItemType Directory -Force -Path (Join-Path $App "runtime\jre8") | Out-Null
  Copy-Item -Path (Join-Path $BundleJre8 "*") -Destination (Join-Path $App "runtime\jre8") -Recurse -Force
}
if (-not [string]::IsNullOrWhiteSpace($BundleJre21)) {
  if (-not (Test-Path -LiteralPath (Join-Path $BundleJre21 "bin\java.exe"))) { throw "BundleJre21 is not a JRE/JDK: $BundleJre21" }
  New-Item -ItemType Directory -Force -Path (Join-Path $App "runtime\jre21") | Out-Null
  Copy-Item -Path (Join-Path $BundleJre21 "*") -Destination (Join-Path $App "runtime\jre21") -Recurse -Force
}

@"
TraceBoard 0.1.0 — Windows app-image (test build)
Run TraceBoard.exe. It starts collector :8601, demo :8080, workbench :5173.
Workbench session: s_demo_package.
This build requires a JDK8 unless runtime\jre8 is bundled.
This is NOT a Qoder Site and does not accept uploads.
"@ | Set-Content -LiteralPath (Join-Path $App "README-PORTABLE.txt") -Encoding UTF8

Write-Host "APP_IMAGE=$App"
Write-Host "EXE=$(Join-Path $App 'TraceBoard.exe')"
if (-not [string]::IsNullOrWhiteSpace($BundleJre8)) { Write-Host "BUNDLED_JRE8=$BundleJre8" }