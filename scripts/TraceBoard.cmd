@echo off
setlocal

rem TraceBoard generic runner.
rem Package layout:  TraceBoard.cmd + app\launcher.jar + app\agent.jar + app\collector.jar + workbench\
rem Source layout:   scripts\TraceBoard.cmd + server\launcher\target\...jar

set "JAVA_BIN=java"
if defined JAVA21 set "JAVA_BIN=%JAVA21%\bin\java.exe"

if exist "%~dp0app\launcher.jar" (
  set "LAUNCHER=%~dp0app\launcher.jar"
) else (
  set "LAUNCHER=%~dp0..\server\launcher\target\traceboard-launcher-1.0.0.jar"
)

if not exist "%LAUNCHER%" (
  echo TraceBoard launcher not found.
  echo Build it with: mvn -B -q -DskipTests package -pl agent,server/collector,server/launcher -am
  pause
  exit /b 1
)

"%JAVA_BIN%" -jar "%LAUNCHER%" run %*
if errorlevel 1 pause
endlocal