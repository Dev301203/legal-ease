#!/usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations
alembic upgrade head

# Create initial data in DB
python app/initial_data.py

# Note: Dummy data generation is skipped for hosted/production deployments

# Start the application with multiple workers
# Render sets PORT env var, default to 8000 for local dev
exec fastapi run --workers 4 --port ${PORT:-8000} app/main.py
