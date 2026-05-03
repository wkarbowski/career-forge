# Deployment Guide

> Production deployment checklist, configuration, and infrastructure recommendations.

---

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Reverse Proxy (Nginx)](#reverse-proxy-nginx)
- [SSL/TLS Setup](#ssltls-setup)
- [Production Environment Variables](#production-environment-variables)
- [Monitoring](#monitoring)
- [Backup Strategy](#backup-strategy)
- [Production Readiness Check](#production-readiness-check)

---

## Pre-Deployment Checklist

- [ ] `DEBUG=false`
- [ ] `ENVIRONMENT=production`
- [ ] `SECRET_KEY` set to a strong random value (64+ characters)
- [ ] `ENFORCE_HTTPS=true`
- [ ] `COOKIE_SECURE=true`
- [ ] `COOKIE_SAMESITE=lax` or `strict`
- [ ] No `localhost` in `CORS_ORIGINS`
- [ ] PostgreSQL configured
- [ ] Redis configured for rate limiting (recommended)
- [ ] `TRUSTED_HOSTS` configured
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Backup system in place
- [ ] SSL certificate installed

---

## Backend Deployment

### 1. Set Up PostgreSQL

```bash
# Use the setup script
./scripts/setup_postgres.sh

# Or manually
sudo -u postgres psql -c "CREATE USER careerforge WITH PASSWORD 'strong-password';"
sudo -u postgres psql -c "CREATE DATABASE careerforge OWNER careerforge;"
```

### 2. Configure Environment

Create `/opt/career-forge/server/.env`:

```env
APP_NAME=Career Forge API
DEBUG=false
ENVIRONMENT=production
DATABASE_URL=postgresql://careerforge:strong-password@localhost/careerforge
SECRET_KEY=your-64-char-random-string-generated-with-openssl-rand-hex-32
CORS_ORIGINS=https://yourdomain.com
RATE_LIMIT_BACKEND=redis
REDIS_URL=redis://localhost:6379
ENFORCE_HTTPS=true
TRUSTED_HOSTS=yourdomain.com,api.yourdomain.com
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=yourdomain.com
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ACCOUNT_LOCKOUT_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=30
```

Generate a secure secret key:

```bash
openssl rand -hex 32
```

### 3. Apply Migrations

```bash
cd /opt/career-forge/server
source venv/bin/activate
alembic upgrade head
```

### 4. Run with Gunicorn

```bash
gunicorn app.main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:8000 \
  --access-logfile /var/log/career-forge/access.log \
  --error-logfile /var/log/career-forge/error.log
```

### 5. Systemd Service (Optional)

Create `/etc/systemd/system/career-forge-api.service`:

```ini
[Unit]
Description=Career Forge API
After=network.target postgresql.service redis.service

[Service]
Type=exec
User=cvapp
Group=cvapp
WorkingDirectory=/opt/career-forge/server
Environment=PATH=/opt/career-forge/server/venv/bin
ExecStart=/opt/career-forge/server/venv/bin/gunicorn app.main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable career-forge-api
sudo systemctl start career-forge-api
```

---

## Frontend Deployment

### 1. Build for Production

```bash
cd client

# Set the API URL for production
REACT_APP_API_URL=https://yourdomain.com/api npm run build
```

### 2. Deploy Static Files

The `build/` directory contains static files that can be served by any web server.

**Option A: Nginx (recommended)**
Copy `build/` to your web root:

```bash
sudo cp -r build/* /var/www/career-forge/
```

**Option B: Netlify**
Drag the `build/` folder to Netlify's deploy page.

**Option C: GitHub Pages**

```bash
npm install -g gh-pages
gh-pages -d build
```

---

## Reverse Proxy (Nginx)

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers (additional to what the app adds)
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    # Frontend (React SPA)
    root /var/www/career-forge;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Uploaded files
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;
}
```

---

## SSL/TLS Setup

### Let's Encrypt (Certbot)

```bash
sudo apt install certbot python3-certbot-nginx   # Ubuntu/Debian
sudo dnf install certbot python3-certbot-nginx    # Fedora

sudo certbot --nginx -d yourdomain.com
```

Auto-renewal is configured by default. Verify:

```bash
sudo certbot renew --dry-run
```

---

## Production Environment Variables

| Variable          | Required Value           | Why                                              |
| ----------------- | ------------------------ | ------------------------------------------------ |
| `DEBUG`           | `false`                  | Disables Swagger docs, prevents debug info leaks |
| `ENVIRONMENT`     | `production`             | Enables security hardening                       |
| `SECRET_KEY`      | 64+ random chars         | JWT security                                     |
| `ENFORCE_HTTPS`   | `true`                   | Force HTTPS redirect                             |
| `COOKIE_SECURE`   | `true`                   | Cookies only sent over HTTPS                     |
| `COOKIE_SAMESITE` | `lax` or `strict`        | CSRF protection                                  |
| `DATABASE_URL`    | PostgreSQL URL           | Production-grade database                        |
| `CORS_ORIGINS`    | `https://yourdomain.com` | No localhost                                     |
| `TRUSTED_HOSTS`   | `yourdomain.com`         | Host header validation                           |

---

## Monitoring

### Audit Logs

The built-in audit system logs to both the database and stdout. Audit logs can be:

- Piped to log aggregation (ELK, Loki, etc.) via stdout

### Health Check

```bash
curl https://yourdomain.com/api/health
# Expected: {"status": "healthy", "environment": "production"}
```

### Security Stats



---

## Backup Strategy

### Automated Backups

Set up a cron job using the provided backup script:

```bash
# Daily backup at 2 AM
0 2 * * * /opt/career-forge/server/scripts/backup_database.sh

# Weekly cleanup of old backups
0 3 * * 0 /opt/career-forge/server/scripts/backup_database.sh --cleanup
```

The backup script:

- Backs up PostgreSQL via `pg_dump`
- Compresses with gzip
- Supports `--restore`, `--list`, `--cleanup`
- Retains 7 days of backups by default

### Manual Backup

```bash
# PostgreSQL
pg_dump careerforge | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

## Production Readiness Check

Use the built-in checker:

```bash
cd server
./scripts/check_production.sh
```

This validates:

- `DEBUG=false`
- `ENVIRONMENT=production`
- `SECRET_KEY` length ≥ 64
- `ENFORCE_HTTPS=true`
- `COOKIE_SECURE=true`
- SameSite policy
- No localhost in CORS origins
- PostgreSQL usage
- Redis rate limiting configured
- Trusted hosts configured
- Account lockout threshold

Outputs a pass/fail summary with recommendations for each item.
