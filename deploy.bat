@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Deploy the React dashboard to the production VPS.
REM
REM  Builds the Vite app to ./dist, clears old static files from
REM  /opt/dashboard/www/, scp's the build, deploys the updated nginx config,
REM  and restarts services.
REM
REM  Run from the dashboard-react/ folder:
REM     deploy.bat
REM
REM  The Python backend (api.py + notes_api.py) is NOT touched by this script.
REM  Use the legacy ../auto_update.bat for backend updates if needed.
REM ─────────────────────────────────────────────────────────────────────────────

setlocal
cd /d "%~dp0"

echo [1/5] Building React app...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed.
    exit /b 1
)

echo [2/5] Clearing old static files from server...
ssh root@37.27.210.14 "rm -rf /opt/dashboard/www/index.html /opt/dashboard/www/assets /opt/dashboard/www/*.html /opt/dashboard/www/*.svg"
if %errorlevel% neq 0 (
    echo WARNING: Could not clear server files. Continuing anyway...
)

echo [3/5] Uploading new build...
scp -r dist/* root@37.27.210.14:/opt/dashboard/www/
if %errorlevel% neq 0 (
    echo ERROR: scp failed. Files may not have been deployed.
    exit /b 1
)

echo [4/5] Deploying nginx config...
scp server\nginx.conf root@37.27.210.14:/etc/nginx/sites-enabled/default
if %errorlevel% neq 0 (
    echo WARNING: Could not deploy nginx.conf. SPA routing may not work.
)

echo [5/5] Reloading nginx...
ssh root@37.27.210.14 "nginx -t && nginx -s reload"
if %errorlevel% neq 0 (
    echo ERROR: nginx reload failed. Check the config.
    exit /b 1
)

echo.
echo Done. Visit http://37.27.210.14 to verify.
endlocal
