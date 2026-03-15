# Career Forge — CV Builder Application

> A full-stack web application for creating, editing, and managing professional resumes and cover letters with a real-time WYSIWYG editor, multi-page pagination, template system, and server-side persistence.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Documentation Index](#documentation-index)
- [License](#license)

---

## Overview

**Career Forge** is a feature-rich resume and cover letter builder that allows users to create, customize, and export professional documents directly in the browser. Key capabilities include:

- **WYSIWYG inline editing** — Click any text to edit it in place with rich formatting
- **Multi-page A4 pagination** — Automatic page flow with zoom and view mode controls
- **Template system** — Start from professional, modern, or cover-letter templates
- **Account persistence** — Register to save, manage, and access your documents from any device with the server running
- **Guest mode** — Try the editor without registering
- **PDF/Print export** — Print-optimized A4 output with proper page breaks
- **JSON import/export** — Full backup and portability
- **Dark/Light themes** — Full theme system with CSS custom properties
- **Internationalization** — English and German UI translations
- **Security hardened** — JWT auth with token rotation, rate limiting, CSRF protection, audit logging

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (React 18)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐             │
│  │  Router   │  │ Contexts │  │ Components│             │
│  │ (v7)     │  │ (6 total)│  │ (25+)     │             │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘             │
│       └──────────────┼──────────────┘                   │
│                      │                                  │
│              ┌───────┴───────┐                          │
│              │  API Service  │                          │
│              │ (fetch + JWT) │                          │
│              └───────┬───────┘                          │
└──────────────────────┼──────────────────────────────────┘
                       │ HTTP (JSON + HttpOnly cookies)
┌──────────────────────┼──────────────────────────────────┐
│                      │       Server (FastAPI)           │
│              ┌───────┴───────┐                          │
│              │   Middleware   │  Rate Limit, CSRF,      │
│              │   Stack (7)   │  Security Headers, etc.  │
│              └───────┬───────┘                          │
│       ┌──────────────┼──────────────┐                   │
│  ┌────┴────┐   ┌─────┴────┐  ┌─────┴─────┐             │
│  │  Auth   │   │   CVs    │  │   Admin   │             │
│  │ Routes  │   │  Routes  │  │  Routes   │             │
│  └────┬────┘   └────┬─────┘  └─────┬─────┘             │
│       └──────────────┼──────────────┘                   │
│              ┌───────┴───────┐                          │
│              │  SQLAlchemy   │                          │
│              │  ORM + Models │                          │
│              └───────┬───────┘                          │
│              ┌───────┴───────┐                          │
│              │   Database    │                          │
│              │ SQLite / PG   │                          │
│              └───────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 18.2 |
| **Routing** | React Router DOM | 7.13 |
| **Build** | Create React App | 5.0.1 |
| **Sanitization** | DOMPurify | 3.0 |
| **Backend** | FastAPI | 0.115+ |
| **ASGI Server** | Uvicorn | 0.32+ |
| **ORM** | SQLAlchemy | 2.0+ |
| **DB (Dev)** | SQLite | — |
| **DB (Prod)** | PostgreSQL | — |
| **Migrations** | Alembic | 1.14+ |
| **Auth** | JWT (python-jose) + bcrypt | — |
| **Rate Limit** | In-memory / Redis | — |

---

## Project Structure

```
career-forge/
├── client/                  # React frontend
│   ├── public/              # Static assets (index.html, favicon)
│   ├── src/
│   │   ├── components/      # React components (25+)
│   │   ├── contexts/        # React Context providers (6)
│   │   ├── data/            # Initial data & template definitions
│   │   ├── hooks/           # Custom React hooks
│   │   ├── locales/         # i18n translation files (en, de)
│   │   ├── services/        # API client layer
│   │   └── templates/       # Template configuration files
│   ├── __tests__/           # Test files
│   └── package.json
│
├── server/                  # FastAPI backend
│   ├── app/
│   │   ├── main.py          # App entry point, middleware, CORS
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic validation schemas
│   │   ├── auth.py          # JWT + password auth logic
│   │   ├── security.py      # Middleware stack (7 layers)
│   │   ├── audit.py         # Audit logging system
│   │   ├── config.py        # Settings (env-based)
│   │   ├── database.py      # DB engine & session
│   │   └── routes/          # API route handlers
│   │       ├── auth.py      # Auth endpoints
│   │       ├── cvs.py       # CV CRUD endpoints
│   │       └── admin.py     # Admin/audit endpoints
│   ├── alembic/             # Database migrations
│   ├── scripts/             # Utility scripts
│   └── requirements.txt
│
└── docs/                    # Documentation (this folder)
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 16.x and npm
- **Python** ≥ 3.10 with pip
- (Optional) PostgreSQL for production
- (Optional) Redis for distributed rate limiting

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/Wiktor-Karbowski/career-forge.git && cd career-forge

# 2. Start the backend
cd server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Start the frontend (new terminal)
cd client
npm install
npm start
# → Opens http://localhost:3000
```

See the detailed guides:
- [Server Setup Guide](server-setup.md)
- [Client Setup Guide](client-setup.md)
- [Deployment Guide](deployment.md)

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture Overview](architecture.md) | System architecture, data flow, context hierarchy |
| [API Reference](api-reference.md) | Complete REST API documentation |
| [Frontend Guide](frontend.md) | Component tree, contexts, state management |
| [Security & Auth](security.md) | Authentication, middleware, audit logging |
| [Server Setup Guide](server-setup.md) | Backend installation and configuration |
| [Client Setup Guide](client-setup.md) | Frontend installation and development |
| [Deployment Guide](deployment.md) | Production deployment checklist |
| [Database Schema](database.md) | Models, migrations, ERD |
| [Templates & Theming](templates-and-theming.md) | Template system, themes, i18n |

---

## License

MIT
