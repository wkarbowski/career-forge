# Career Forge Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [1.1.0] — 2026-03-08

### Added

- Cover letter editor with full DIN 5008 Anschreiben layout (sender, recipient, date/place, subject, salutation, body, closing, signature)
- Signature support in cover letters: draw on canvas or upload an image
- Inline error banners in the account dropdown menu (no more browser `alert()` dialogs)

### Fixed

- `setCurrentCvId('new')` corrected to `'template'` in GlobalHeader, fixing the new-document flow
- All remaining `alert()` / `window.alert()` calls (6 sites) replaced with in-app status feedback or inline error banners
- Unused Python imports removed from `security.py` and `routes/documents.py`

### Changed

- Dead code removed: `TemplateSelector`, `TemplateContext`, and `useLocalStorage` (none had any live callers)
- All stale `cv-app` repository slug references replaced with `career-forge` throughout docs, package files, and Docker configs
- `.env.example` removed from version control (variables are documented in `docs/deployment.md`)

---

## [1.0.0] — 2026-02-19

### Initial public open-source release

#### Added

- Full-stack WYSIWYG resume builder: React 18 frontend + FastAPI backend
- Multi-page A4 pagination with automatic page flow and zoom controls
- Rich text toolbar: bold, italic, underline, font size, colour, text alignment, ordered and unordered lists
- Template gallery with professional, modern, and cover letter templates; live colour previews
- Document dashboard: create, rename, search, sort, filter, and delete saved documents
- JWT authentication with short-lived access tokens and HttpOnly-cookie refresh tokens; guest mode available without an account
- Browser print / PDF export with print-optimised CSS that hides all editor UI chrome
- JSON import / export for complete document portability and backup
- Profile image upload directly from the editor (authenticated users)
- Dark / Light theme toggle, persisted per user
- English and German locale support (221 i18n keys, full parity across both languages)
- Rate limiting (in-memory and Redis backends), CSRF protection, audit logging, and account lockout
- Security headers middleware (HSTS, CSP, X-Frame-Options, etc.)
- Docker Compose stack: PostgreSQL 16, Redis 7, Nginx, FastAPI served via Gunicorn
- Feature flag system for optional extended modules (billing, OAuth, server-side PDF, shareable links, admin panel)
- MIT licensed
