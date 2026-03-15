# Career Forge — Resume & Cover Letter Builder

> A full-stack, self-hostable resume and cover letter builder with a real-time WYSIWYG editor, multi-page A4 pagination, template system, and server-side persistence.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](server/)
[![Frontend: React 18](https://img.shields.io/badge/Frontend-React%2018-61dafb)](client/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed)](docker-compose.yml)

---

## Features

- **WYSIWYG inline editing** — click any field to edit; floating toolbar for bold, italic, lists, colour, alignment
- **Multi-page A4 pagination** — automatic page flow, zoom, and view-mode controls
- **Template gallery** — professional, modern, and cover-letter templates with live colour previews
- **Document dashboard** — create, rename, search, sort, filter, and delete saved documents
- **Auth system** — register / login with JWT access tokens + HttpOnly-cookie refresh tokens; guest mode with no account required
- **PDF / Print export** — browser-print with print-optimised CSS that hides all UI chrome
- **JSON import / export** — full document backup and portability
- **Profile image upload** — upload a photo directly from the editor
- **Dark / Light theme** — persisted per user
- **Multi-language UI** — English and German locales (persisted per user)
- **Auto-save** — debounced background sync when authenticated
- **Security hardened** — rate limiting, CSRF protection, audit logging, account lockout, security headers

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Client (React 18)              │
│  Router v7 · 25+ Components · 6 Contexts   │
│          API Service (fetch + JWT)          │
└─────────────────┬───────────────────────────┘
                  │ HTTP (JSON + HttpOnly cookies)
┌─────────────────┴───────────────────────────┐
│           Server (FastAPI + Python)         │
│  SQLAlchemy ORM · Alembic migrations        │
│  SQLite (dev) · PostgreSQL (production)     │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v7, CRA 5 |
| Sanitization | DOMPurify 3 |
| Backend | FastAPI 0.115+, Python 3.10+ |
| ORM / Migrations | SQLAlchemy 2, Alembic |
| DB (dev) | SQLite |
| DB (prod) | PostgreSQL |
| Rate Limiting | In-memory / Redis |
| Containerization | Docker + Docker Compose |

---

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/Wiktor-Karbowski/career-forge.git career-forge
cd career-forge
# Create a .env file with required secrets — see docs/deployment.md for the full variable reference
docker compose up --build
# → http://localhost
```

### Local development

```bash
# Backend
cd server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Create .env in the project root — see docs/deployment.md for all variables
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd client
npm install
npm start
# → http://localhost:3000
```

See the full guides in [`docs/`](docs/):

| Guide | Description |
|-------|-------------|
| [Server Setup](docs/server-setup.md) | Backend installation & configuration |
| [Client Setup](docs/client-setup.md) | Frontend installation & development |
| [Deployment](docs/deployment.md) | Production deployment checklist |
| [API Reference](docs/api-reference.md) | Complete REST API documentation |
| [Architecture](docs/architecture.md) | System design & data flow |
| [Security](docs/security.md) | Auth, middleware, audit logging |

---

## Architecture

Career Forge architecture:

- **Core application** — the complete self-hostable application.


---

## Environment Variables

Create a `.env` file in the project root and set at minimum:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | **Yes** | JWT signing key — `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Prod | PostgreSQL password |
| `REDIS_PASSWORD` | Prod | Redis password (if using Redis rate limiting) |

See [docs/deployment.md](docs/deployment.md) for the full list of variables.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

- Fork → branch → PR
- Keep changes focused; one logical change per PR
- Follow existing code style (Prettier / ESLint for JS, PEP 8 for Python)

---

## Security

Found a vulnerability? Please **do not open a public issue**.
Report it via [GitHub private security advisory](https://github.com/Wiktor-Karbowski/career-forge/security/advisories/new).

See [SECURITY.md](SECURITY.md) for the full policy.

---

## License

[MIT](LICENSE) © 2026 Wiktor Karbowski
