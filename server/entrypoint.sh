#!/bin/sh
set -e

echo "==> Running Alembic database migrations..."
alembic upgrade head

echo "==> Starting FastAPI server..."

if [ "$ENVIRONMENT" = "production" ]; then
    # Production: gunicorn with uvicorn workers
    exec gunicorn app.main:app \
        --bind 0.0.0.0:8000 \
        --workers "${GUNICORN_WORKERS:-4}" \
        --worker-class uvicorn.workers.UvicornWorker \
        --timeout 120 \
        --access-logfile - \
        --error-logfile -
else
    # Development: uvicorn with hot-reload
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload
fi
