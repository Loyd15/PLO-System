@echo off
title PLO Survey System - Production Server
echo ===================================================
echo Starting PLO Survey System in Production (Waitress)
echo ===================================================

cd /d "%~dp0"

echo [1/2] Pre-compiling static assets...
.\.venv\Scripts\python.exe manage.py collectstatic --noinput

echo [2/2] Launching multi-threaded production WSGI server (Waitress)...
echo Listening on http://0.0.0.0:8000/
echo Press Ctrl+C to stop the server.
echo.

.\.venv\Scripts\waitress-serve.exe --listen=0.0.0.0:8000 --threads=8 config.wsgi:application
pause
