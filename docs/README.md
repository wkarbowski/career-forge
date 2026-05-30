# Career Forge — CV Builder Application

> A full-stack, self-hostable web application for creating, editing, and managing professional resumes and cover letters.

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
- **Multi-page A4 pagination** — Page count derived from content height; zoom and view-mode controls
- **Cover letter editor** — Dedicated DIN 5008-style cover letter editor with its own toolbar
- **Template system** — Start from professional, modern, or cover-letter templates
- **Account persistence** — Register to save, manage, and version documents; guest mode requires no account
- **PDF / Print export** — Browser `window.print()` with print-optimised CSS that hides all UI chrome
- **JSON import / export** — Full backup and portability
- **Version history** — Create named snapshots and restore previous versions
- **Keyword matcher** — Paste a job description and see matching keywords
- **Dark / Light themes** — Full theme system with CSS custom properties
- **Internationalization** — English and German UI translations
- **Security hardened** — JWT auth with token rotation, rate limiting, CSRF protection, audit logging

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Client (React 19)              │
│ App bootstrap · Router v7 · 6 providers     │
│ Editor feature hooks · API service layer     │
└─────────────────┬───────────────────────────┘
                  │ HTTP (JSON + HttpOnly cookies)
┌─────────────────┴───────────────────────────┐
│           Server (FastAPI + Python)         │
│ App factory · Routes · Services · Repos      │
│ Security middleware · SQLAlchemy · Alembic   │
└─────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer            | Technology                     | Version |
| ---------------- | ------------------------------ | ------- |
| **Frontend**     | React                          | 19      |
| **Routing**      | React Router DOM               | 7.15    |
| **Build**        | Vite                           | 8.x     |
| **Sanitization** | DOMPurify                      | 3.4     |
| **Backend**      | FastAPI                        | 0.136+  |
| **ASGI Server**  | Uvicorn                        | 0.48+   |
| **ORM**          | SQLAlchemy                     | 2.0+    |
| **DB (Dev)**     | PostgreSQL                     | 16      |
| **DB (Prod)**    | PostgreSQL                     | 16      |
| **Migrations**   | Alembic                        | 1.14+   |
| **Auth**         | JWT (python-jose) + bcrypt     | —       |
| **Rate Limit**   | In-memory (dev) / Redis (prod) | —       |

---

## Project Structure

```
career-forge/
├── client/                  # React frontend
│   ├── public/              # Static assets (index.html, favicon)
│   ├── src/
│   │   ├── app/             # App bootstrap, providers, routes, guards
│   │   ├── components/      # Reusable React components
│   │   ├── contexts/        # React Context providers (6)
│   │   ├── data/            # Initial data & template definitions
│   │   ├── features/        # Feature-level orchestration (editor)
│   │   ├── locales/         # i18n translation files (en, de)
│   │   ├── pages/           # Route-level page wrappers
│   │   ├── services/        # API client layer
│   │   ├── types/           # Shared TypeScript types
│   │   └── utils/           # Shared frontend utilities
│   ├── __tests__/           # Test files
│   └── package.json
│
├── server/                  # FastAPI backend
│   ├── app/
│   │   ├── main.py          # Thin app.main:app compatibility entrypoint
│   │   ├── bootstrap.py     # create_app(), middleware, routers, CORS
│   │   ├── lifecycle.py     # Startup/shutdown lifecycle tasks
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic validation schemas
│   │   ├── auth.py          # JWT + password auth logic
│   │   ├── security.py      # Compatibility facade for security exports
│   │   ├── security_layers/ # Rate limiting, lockout, CSRF, middleware
│   │   ├── services/        # Business workflows
│   │   ├── repositories/    # Database query/update helpers
│   │   ├── audit.py         # Audit logging system
│   │   ├── config.py        # Settings (env-based)
│   │   ├── database.py      # DB engine & session
│   │   └── routes/          # Thin HTTP route adapters
│   │       ├── auth.py      # Auth endpoints
│   │       ├── documents.py # Document endpoints
│   │       └── public.py    # Root, health, shared document endpoints
│   ├── alembic/             # Database migrations
│   ├── scripts/             # Utility scripts
│   └── requirements.txt
│
└── docs/                    # Documentation (this folder)
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x and npm
- **Python** ≥ 3.12 with pip
- PostgreSQL
- Redis (optional for development; recommended for production rate limiting)

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/wkarbowski/career-forge.git && cd career-forge

# 2. Start the backend
cd server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Start the frontend (new terminal)
cd client
npm install
npm run dev
# → Opens http://localhost:3000
```

See the detailed guides:

- [Server Setup Guide](server-setup.md)
- [Client Setup Guide](client-setup.md)
- [Deployment Guide](deployment.md)

---

## Documentation Index

| Document                                        | Description                                       |
| ----------------------------------------------- | ------------------------------------------------- |
| [Architecture Overview](architecture.md)        | System architecture, data flow, context hierarchy |
| [API Reference](api-reference.md)               | Complete REST API documentation                   |
| [Frontend Guide](frontend.md)                   | Component tree, contexts, state management        |
| [Security & Auth](security.md)                  | Authentication, middleware, audit logging         |
| [Server Setup Guide](server-setup.md)           | Backend installation and configuration            |
| [Client Setup Guide](client-setup.md)           | Frontend installation and development             |
| [Deployment Guide](deployment.md)               | Production deployment checklist                   |
| [Database Schema](database.md)                  | Models, migrations, ERD                           |
| [Templates & Theming](templates-and-theming.md) | Template system, themes, i18n                     |

---

## License

[MIT](../LICENSE) © 2026 Wiktor Karbowski
