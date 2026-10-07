#!/usr/bin/env bash
set -e

echo "==================================================="
echo "  DLSU PLO Survey System - Debian / Linux Launcher"
echo "==================================================="

# Navigate to script directory
cd "$(dirname "$0")"

# 1. Check and install python3 / venv if missing on Debian/Ubuntu
if ! command -v python3 &> /dev/null || ! python3 -m venv --help &> /dev/null; then
    echo "[Setup] Installing python3 and python3-venv via apt..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-venv python3-pip
fi

# 2. Create virtual environment if it does not exist
if [ ! -d ".venv" ]; then
    echo "[1/4] Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

# 3. Install dependencies
echo "[2/4] Installing Python dependencies..."
./.venv/bin/pip install --upgrade pip -q
./.venv/bin/pip install -r requirements.txt -q

# 4. Run MySQL migrations, sync PLO questions, and collect static files
echo "[3/4] Preparing MySQL database and static assets..."
./.venv/bin/python manage.py migrate --noinput
./.venv/bin/python manage.py sync_plo_questions
./.venv/bin/python manage.py collectstatic --noinput

# 5. Launch server
PORT="${PORT:-8000}"
echo "[4/4] Starting Gunicorn WSGI server on http://0.0.0.0:${PORT}/ ..."
echo "Press Ctrl+C to stop the server."
echo ""

if [ "$1" = "--dev" ]; then
    exec ./.venv/bin/python manage.py runserver "0.0.0.0:${PORT}"
else
    exec ./.venv/bin/gunicorn config.wsgi:application \
        --bind "0.0.0.0:${PORT}" \
        --workers "${WEB_CONCURRENCY:-3}" \
        --threads 2 \
        --access-logfile -
fi

