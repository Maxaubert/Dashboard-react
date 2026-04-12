@echo off
REM ============================================================
REM  Dashboard YouTube Proxy launcher
REM
REM  What this does:
REM    1. Starts a tiny SOCKS5 proxy on this PC (port 1080)
REM    2. Opens an SSH reverse tunnel to the dashboard server,
REM       so the server can route YouTube requests through here
REM    3. Cleans up both when this window is closed
REM
REM  As long as this window stays open, video downloads from
REM  youtube.com will work in the dashboard from ANY device.
REM  Close it (or press Ctrl+C in the SSH prompt) to stop.
REM ============================================================

setlocal
title Dashboard YouTube Proxy

REM ── Edit these to match your dashboard server ──────────────
set SERVER_HOST=37.27.210.14
set SERVER_USER=root
set TUNNEL_PORT=1080
REM ────────────────────────────────────────────────────────────

set SCRIPT_DIR=%~dp0

echo +========================================================+
echo +              Dashboard YouTube Proxy                   +
echo +========================================================+
echo.
echo  Server : %SERVER_USER%@%SERVER_HOST%
echo  Tunnel : server:%TUNNEL_PORT%  -^>  this PC:%TUNNEL_PORT%
echo.

REM ── Make sure python is available ───────────────────────────
where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo  ERROR: Python is not installed or not on PATH.
        echo         Install Python from https://python.org and try again.
        echo.
        pause
        exit /b 1
    )
    set PYTHON=py -3
) else (
    set PYTHON=python
)

REM ── Make sure ssh is available ──────────────────────────────
where ssh >nul 2>nul
if errorlevel 1 (
    echo  ERROR: 'ssh' is not on PATH.
    echo         Enable Windows OpenSSH client:
    echo           Settings ^> Apps ^> Optional Features ^> OpenSSH Client
    echo.
    pause
    exit /b 1
)

echo  Starting SOCKS5 proxy on this PC (window minimised)...
start "Dashboard SOCKS5 Proxy" /MIN %PYTHON% "%SCRIPT_DIR%socks5_proxy.py" --port %TUNNEL_PORT%

REM Give the proxy a moment to bind before we connect
ping -n 2 127.0.0.1 >nul

echo  Proxy started. Opening SSH reverse tunnel...
echo.
echo  You may be prompted for the server password.
echo  Keep this window open. Close it when you're done downloading.
echo.

REM ── SSH reverse tunnel ──────────────────────────────────────
REM   -N    don't run a remote command (just port-forward)
REM   -R    server:1080 -> local 1080
REM   ServerAliveInterval keeps the connection alive through NAT
REM   ExitOnForwardFailure aborts if the port is already used remotely
ssh -N ^
    -o ServerAliveInterval=30 ^
    -o ServerAliveCountMax=3 ^
    -o ExitOnForwardFailure=yes ^
    -o StrictHostKeyChecking=accept-new ^
    -R %TUNNEL_PORT%:127.0.0.1:%TUNNEL_PORT% ^
    %SERVER_USER%@%SERVER_HOST%

echo.
echo  SSH tunnel closed. Stopping local SOCKS5 proxy...
taskkill /F /FI "WINDOWTITLE eq Dashboard SOCKS5 Proxy" >nul 2>nul
echo  Done.
echo.
pause
endlocal
