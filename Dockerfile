FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for MySQL / WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app/

# Pre-compile static assets for WhiteNoise
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Run migrations, sync PLOs, and start multi-worker Gunicorn server
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py sync_plo_questions && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --threads 2"]
