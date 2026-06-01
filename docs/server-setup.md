# Server Setup Guide

> Installation, configuration, and running the FastAPI backend.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [Database Setup](#database-setup)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Python** ≥ 3.11 (Docker and CI use Python 3.12)
- **pip** (Python package manager)
- **PostgreSQL** (required — the app uses PostgreSQL-specific features like JSONB)
- **Redis** (optional, for distributed rate limiting)

---

## Installation

```bash
cd server

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate    # Linux/macOS
# venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

### Dependencies

| Package                     | Purpose                             |
| --------------------------- | ----------------------------------- |
| `fastapi`                   | Web framework                       |
| `uvicorn[standard]`         | ASGI server                         |
| `sqlalchemy`                | ORM                                 |
| `psycopg2-binary`           | PostgreSQL driver                   |
| `python-jose[cryptography]` | JWT tokens                          |
| `bcrypt`                    | Password hashing                    |
| `python-multipart`          | Form data / file uploads            |
| `pydantic`                  | Data validation                     |
| `pydantic-settings`         | Environment-based settings          |
| `email-validator`           | Email validation                    |
| `alembic`                   | Database migrations                 |
| `redis`                     | Redis client (optional)             |
| `bleach`                    | HTML sanitization                   |
| `tinycss2`                  | CSS sanitization (defense-in-depth) |
| `gunicorn`                  | Production process manager for Uvicorn workers |

---

## Application Structure

The backend keeps `app.main:app` as the stable ASGI entrypoint, but the
implementation is bootstrapped through `create_app()` in `app/bootstrap.py`.

| Layer              | Location                | Purpose                                      |
| ------------------ | ----------------------- | -------------------------------------------- |
| Entry point        | `app/main.py`           | Compatibility export for Uvicorn/Gunicorn    |
| Bootstrap          | `app/bootstrap.py`      | FastAPI app construction, middleware, routers |
| Lifecycle          | `app/lifecycle.py`      | Startup/shutdown tasks                       |
| Routes             | `app/routes/`           | Thin HTTP adapters                           |
| Services           | `app/services/`         | Auth, account, document, image workflows     |
| Repositories       | `app/repositories/`     | SQLAlchemy query/update helpers              |
| Security facade    | `app/security.py`       | Stable public security imports               |
| Security internals | `app/security_layers/`  | Rate limits, lockout, CSRF, middleware       |

---

## Configuration

Create a `.env` file in the `server/` directory:

```env
# Application
APP_NAME=Career Forge API
DEBUG=true
ENVIRONMENT=development

# Database — PostgreSQL required (JSONB columns)
# WARNING: replace <your-strong-password> with a real password — do not use verbatim
DATABASE_URL=postgresql://careerforge:<your-strong-password>@localhost:5432/careerforge

# Security
SECRET_KEY=your-secret-key-at-least-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_TOKEN_ROTATE=true

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_AUTH_PER_MINUTE=10
RATE_LIMIT_BACKEND=memory

# Account Lockout
ACCOUNT_LOCKOUT_ATTEMPTS=10
ACCOUNT_LOCKOUT_DURATION=15

# Cookies
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=

# HTTPS (production only)
ENFORCE_HTTPS=false
TRUSTED_HOSTS=

# Password reset email (optional)
APP_BASE_URL=http://localhost:3000
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true
SMTP_TIMEOUT_SECONDS=10

# File uploads
UPLOAD_DIR=uploads/profile_images
```

### Environment Variables Reference

| Variable                      | Default                                                                      | Description                                     |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| `APP_NAME`                    | `Career Forge API`                                                           | Application name                                |
| `DEBUG`                       | `false`                                                                      | Enable debug mode (Swagger docs)                |
| `ENVIRONMENT`                 | `development`                                                                | `development`, `staging`, `production`, or `test` |
| `DATABASE_URL`                | `postgresql://careerforge:password@localhost:5432/careerforge`               | PostgreSQL connection string                    |
| `SECRET_KEY`                  | Auto-generated when unset                                                    | JWT signing key (min 32 chars, recommended 64+) |
| `ALGORITHM`                   | `HS256`                                                                      | JWT signing algorithm                           |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15`                                                                         | Access token lifetime                           |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | `7`                                                                          | Refresh token lifetime                          |
| `REFRESH_TOKEN_ROTATE`        | `true`                                                                       | Enable token rotation                           |
| `CORS_ORIGINS`                | `http://localhost:3000,http://127.0.0.1:3000`                                | Allowed CORS origins                            |
| `RATE_LIMIT_PER_MINUTE`       | `60`                                                                         | General rate limit                              |
| `RATE_LIMIT_AUTH_PER_MINUTE`  | `10`                                                                         | Auth rate limit                                 |
| `RATE_LIMIT_BACKEND`          | `memory`                                                                     | `memory` or `redis`                             |
| `REDIS_URL`                   | —                                                                            | Redis connection URL                            |
| `REDIS_PASSWORD`              | —                                                                            | Redis password                                  |
| `ACCOUNT_LOCKOUT_ATTEMPTS`    | `10`                                                                         | Failed login threshold                          |
| `ACCOUNT_LOCKOUT_DURATION`    | `15`                                                                         | Lockout duration (minutes)                      |
| `COOKIE_SECURE`               | `false`                                                                      | HTTPS-only cookies                              |
| `COOKIE_SAMESITE`             | `lax`                                                                        | Cookie SameSite policy                          |
| `COOKIE_DOMAIN`               | —                                                                            | Cookie domain scope                             |
| `ENFORCE_HTTPS`               | `false`                                                                      | Force HTTPS redirect                            |
| `TRUSTED_HOSTS`               | Empty; TrustedHost middleware disabled                                       | Allowed host headers                            |
| `APP_BASE_URL`                | `http://localhost:3000`                                                       | Public frontend URL for password reset links    |
| `SMTP_HOST`                   | —                                                                            | Optional SMTP host for password reset emails    |
| `SMTP_PORT`                   | `587`                                                                        | SMTP port                                       |
| `SMTP_USERNAME`               | —                                                                            | Optional SMTP username                          |
| `SMTP_PASSWORD`               | —                                                                            | Optional SMTP password                          |
| `SMTP_FROM_EMAIL`             | —                                                                            | Sender address; enables reset email with host   |
| `SMTP_USE_TLS`                | `true`                                                                       | Use STARTTLS for SMTP                           |
| `SMTP_TIMEOUT_SECONDS`        | `10`                                                                         | SMTP connection timeout                         |
| `UPLOAD_DIR`                  | `uploads/profile_images`                                                     | Profile image storage path                      |

> **Important:** If `SECRET_KEY` is not set, the app auto-generates one at startup with a warning. That is only suitable for temporary local development because tokens become invalid after restart. In production, always set a stable strong `SECRET_KEY` (64+ chars). `DEBUG=true` is **fatal** in production environment.

Password reset email is disabled until `SMTP_HOST` and `SMTP_FROM_EMAIL` are set.
When disabled, the API keeps the same generic response and records the request
for operator follow-up.

---

## Running the Server

### Development

```bash
cd server
source venv/bin/activate

# With auto-reload
uvicorn app.main:app --reload --port 8000

# Server runs at http://localhost:8000
```

### Production

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Or with Gunicorn:

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## Database Setup

### PostgreSQL

**Option 1: Use the setup script**

```bash
chmod +x scripts/setup_postgres.sh
./scripts/setup_postgres.sh
```

This creates:

- Database: `careerforge`
- User: `careerforge`
- Outputs the `DATABASE_URL` for your `.env`

**Option 2: Manual setup**

```bash
sudo -u postgres psql
```

```sql
CREATE USER careerforge WITH PASSWORD 'your-secure-password';
CREATE DATABASE careerforge OWNER careerforge;
GRANT ALL PRIVILEGES ON DATABASE careerforge TO careerforge;
\q
```

Update `.env`:

```env
DATABASE_URL=postgresql://careerforge:<your-strong-password>@localhost/careerforge
```

### Running Migrations

```bash
cd server

# Apply all migrations
alembic upgrade head

# Check current migration
alembic current

# Create new migration from model changes
alembic revision --autogenerate -m "description of changes"
```

### Database Backup

```bash
# Backup
./scripts/backup_database.sh

# List backups
./scripts/backup_database.sh --list

# Restore from backup
./scripts/backup_database.sh --restore backups/careerforge_20260213_120000.sql.gz

# Clean old backups (>7 days)
./scripts/backup_database.sh --cleanup
```

Supports PostgreSQL (`pg_dump`/`psql`).

---

## API Documentation

When `DEBUG=true`, interactive API documentation is available:

| URL                                      | Format       |
| ---------------------------------------- | ------------ |
| `http://localhost:8000/api/docs`         | Swagger UI   |
| `http://localhost:8000/api/redoc`        | ReDoc        |
| `http://localhost:8000/api/openapi.json` | OpenAPI JSON |

> These are automatically disabled in production (`DEBUG=false`).

---

## Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Find the process
lsof -i :8000
# Kill it
kill -9 <PID>
# Or use a different port
uvicorn app.main:app --reload --port 8001
```

**CORS errors:**

- Verify `CORS_ORIGINS` includes your frontend URL (e.g., `http://localhost:3000`)
- Include both `localhost` and `127.0.0.1` variants

**JWT errors:**

- Ensure `SECRET_KEY` is consistent between restarts
- Check token expiry (`ACCESS_TOKEN_EXPIRE_MINUTES`)

**Migration errors:**

```bash
# Reset to a specific revision
alembic downgrade <revision>

# Stamp current state (skip applying migration)
alembic stamp head
```

**Redis connection failed:**

- Rate limiting automatically falls back to in-memory
- Check `REDIS_URL` and `REDIS_PASSWORD` settings
