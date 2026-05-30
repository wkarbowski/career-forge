# Career Forge Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Changed

- Refactored the client bootstrap into dedicated app, provider, route, page-wrapper, and editor feature modules without changing routes or user-facing behavior.
- Refactored the FastAPI backend into app bootstrap, lifecycle, route adapter, service, repository, and focused security modules while preserving public API contracts.
- Updated developer documentation to describe the current frontend and backend architecture.

---

## [1.0.0] — 2026-05-13

### Initial public open-source release

#### Added

- Full-stack WYSIWYG resume builder: React 19 frontend + FastAPI backend
- Multi-page A4 pagination with automatic page flow and zoom controls
- Rich text toolbar: bold, italic, underline, font size, colour, text alignment, ordered and unordered lists
- Cover letter editor with full DIN 5008 Anschreiben layout (sender, recipient, date/place, subject, salutation, body, closing, signature)
- Signature support in cover letters: draw on canvas or upload an image
- Template gallery with professional, modern, and cover letter templates; live colour previews; compact / standard / spacious font size presets
- Document dashboard: create, rename, search, sort, filter, and delete saved documents; Application Packages grouping; grid and list views
- Document linking — attach a cover letter to its corresponding resume and navigate between them
- JWT authentication with short-lived access tokens and HttpOnly-cookie refresh tokens; guest mode available without an account
- Account security page: change password, delete account
- Browser print / PDF export with print-optimised CSS that hides all editor UI chrome
- JSON import / export for complete document portability and backup
- Profile image upload and in-editor crop directly from the editor (authenticated users)
- Version history: create named snapshots and restore previous versions
- Keyword matcher: paste a job description and see matching keywords highlighted in the editor
- Dark / Light theme toggle, persisted per user
- English and German locale support (i18n, full parity across both languages)
- Rate limiting (in-memory and Redis backends), CSRF protection, audit logging, and account lockout
- Security headers middleware (HSTS, CSP, X-Frame-Options, etc.)
- Docker Compose stack: PostgreSQL 16, Redis 7, Nginx, FastAPI served via Gunicorn
- Dev Container configuration for VS Code
- CI pipeline (GitHub Actions): ruff lint, pyright type-check, pytest with coverage, TypeScript build and Vitest test suite
- Dependabot configured for automated dependency updates
- Configurable privacy banner toggle for deployments that need explicit consent UI
- MIT licensed

---

[Unreleased]: https://github.com/wkarbowski/career-forge/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/wkarbowski/career-forge/releases/tag/v1.0.0
