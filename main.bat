@echo off
set DENO=%USERPROFILE%\.deno\bin\deno.exe
if not exist "%DENO%" set DENO=deno
"%DENO%" run --allow-net --allow-run "%~dp0main.ts" %*
