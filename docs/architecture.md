# Architecture Overview

> System architecture, data flow, provider hierarchy, and design decisions for the Career Forge application.

---

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data Flow](#data-flow)
- [Authentication Flow](#authentication-flow)
- [Request Lifecycle](#request-lifecycle)

---

## High-Level Architecture

Career Forge follows a **client-server architecture** with a clear separation between the React single-page application (SPA) and the FastAPI backend.

```
┌─────────────┐        HTTPS / JSON         ┌──────────────┐
│   Browser    │ ◄─────────────────────────► │   FastAPI    │
│  (React SPA) │   + HttpOnly cookies        │   Server     │
└──────┬───────┘                             └──────┬───────┘
       │                                            │
  localStorage                                SQLAlchemy
  sessionStorage                                    │
                                            ┌───────┴───────┐
                                            │   Database    │
                                            │  PostgreSQL   │
                                            └───────────────┘
```

**Communication**: REST API over HTTP(S) with JSON payloads. Authentication tokens are split between `localStorage` (access token, theme preference, language preference) and HttpOnly cookies (refresh token) for XSS mitigation.

---

## Frontend Architecture

### Context Provider Hierarchy

The app uses 6 React Context providers nested in this order:

```
<BrowserRouter>
  └─ <ThemeProvider>           — dark/light theme state
      └─ <I18nProvider>        — language & translations
          └─ <AppStateProvider>  — CV data, settings, document type, cover letter data
              └─ <PageProvider>  — multi-page pagination & zoom
                  └─ <AuthProvider>  — user auth, document list, auto-save
                      └─ <UndoProvider>  — undo/redo history
                          └─ <AppContentInner>  — routes & layout
```

### Component Tree (Simplified)

```
App
├─ GlobalHeader
│  ├─ Logo + Navigation Links
│  ├─ SaveStatus Indicator
│  ├─ LanguageSwitcher
│  ├─ ThemeToggle
│  └─ UserMenu
│
├─ HomePage (route: /)
│  └─ AuthModal (login/register dialog)
│
├─ TemplatesGallery (route: /templates)
│  ├─ Filter Controls (type, category)
│  └─ TemplateCard[] (with CSS previews)
│
├─ DocumentDashboard (route: /dashboard)
│  ├─ Search + Sort Controls
│  ├─ Bulk Actions (multi-select, delete)
│  └─ DocumentRow[] (rename, edit, duplicate, delete, share)
│
├─ AccountSettings (route: /account)
│
├─ PrivacyPolicyPage (route: /privacy)
│
├─ SharedDocumentViewer (route: /shared/:shareToken)
│
└─ CVEditor (route: /editor, /editor/:cvId)
   ├─ Editor Toolbar (title, export JSON/PDF, import, versions, keywords)
   ├─ CentralToolbar (resume: colors, font controls)
   ├─ CLToolbar       (cover letter: layout, font controls)
   ├─ VerticalMenu (section toggles, color settings)
   ├─ CVPagesEditor (resume mode)
   │  ├─ PageControls (navigation, zoom, view mode)
   │  └─ Page[] (A4 clipped views)
   │     ├─ Sidebar
   │     └─ MainContent
   ├─ CoverLetterEditor (cover letter mode)
   ├─ VersionHistory side panel
   └─ KeywordMatcher side panel
```

### Routing

| Route                 | Component                 | Guard            | Description                    |
| --------------------- | ------------------------- | ---------------- | ------------------------------ |
| `/`                   | `HomePageWrapper`         | None             | Landing page                   |
| `/templates`          | `TemplatesGalleryWrapper` | None             | Browse templates               |
| `/privacy`            | `PrivacyPolicyPage`       | None             | Privacy policy                 |
| `/shared/:shareToken` | `SharedDocumentViewer`    | None             | Public read-only document view |
| `/account`            | `AccountSettings`         | `ProtectedRoute` | Account management             |
| `/dashboard`          | `DocumentDashboard`       | `ProtectedRoute` | Document management            |
| `/editor`             | `CVEditor`                | `EditorRoute`    | New/template document          |
| `/editor/:cvId`       | `CVEditor`                | `ProtectedRoute` | Edit saved document            |
| `*`                   | Redirect → `/`            | —                | Catch-all                      |

**Route Guards:**

- `ProtectedRoute` — Redirects unauthenticated users to `/`
- `EditorRoute` — Allows both authenticated and guest users; redirects others to `/`

---

## Backend Architecture

### Layer Diagram

```
Incoming Request
     │
     ▼
┌─────────────────────────┐
│   Middleware Stack       │
│  1. TrustedHost         │
│  2. HTTPSRedirect       │
│  3. RequestSizeLimit    │
│  4. RateLimit           │
│  5. ContentTypeValidate │
│  6. CSRF                │
│  7. SecurityHeaders     │
│  8. CORS                │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│   Route Handlers        │
│  /api/auth/*            │
│  /api/documents/*       │
└────────┬────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│  Auth  │ │  Audit   │
│ Module │ │  Logger  │
│(JWT/PW)│ │ (DB+File)│
└───┬────┘ └────┬─────┘
    │           │
    ▼           ▼
┌─────────────────────────┐
│   SQLAlchemy ORM        │
│   Models & Session      │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│   Database              │
│  PostgreSQL             │
└─────────────────────────┘
```

### Module Responsibilities

| Module              | File                  | Responsibility                                                                  |
| ------------------- | --------------------- | ------------------------------------------------------------------------------- |
| **Entry Point**     | `main.py`             | App factory, middleware registration, CORS, health check                        |
| **Models**          | `models.py`           | SQLAlchemy ORM models (User, Document, DocumentVersion, RefreshToken, AuditLog) |
| **Schemas**         | `schemas.py`          | Pydantic request/response validation                                            |
| **Auth**            | `auth.py`             | Password hashing, JWT creation/validation, token rotation                       |
| **Security**        | `security.py`         | 7 middleware classes, rate limiting, input sanitization                         |
| **Audit**           | `audit.py`            | Event logging (25 event types), DB + file dual output                           |
| **Config**          | `config.py`           | Environment-based settings via pydantic-settings                                |
| **Database**        | `database.py`         | Engine, session factory, connection pooling                                     |
| **Auth Routes**     | `routes/auth.py`      | Register, login, refresh, logout, preferences                                   |
| **Document Routes** | `routes/documents.py` | CRUD, export, import, duplicate, image upload                                   |

---

## Data Flow

### Document Editing & Auto-Save

```
User types in EditableText
       │
       ▼
EditableText.onInput(innerHTML)
       │
       ▼
DOMPurify.sanitize(html)
       │
       ▼
AppStateContext.updateField(path, value)
       │
       ▼
State update triggers useEffect in CVEditor
       │
       ▼
Debounce 2 seconds
       │
       ▼
AuthContext.saveDocument(docId, { data, settings, ... })
       │
       ▼
documentApi.update(docId, payload) → PUT /api/documents/:id
       │
       ▼
Server sanitizes (bleach) → SQLAlchemy save
       │
       ▼
SaveStatus: "Saving..." → "Saved" / "Save failed"
```

### Template Application

```
User selects template in TemplatesGallery
       │
       ▼
getTemplateById(id) → { settings, visibleSections, sidebarOrder }
       │
       ▼
AppStateContext: updateSettings(), setVisibleSections(), setSidebarOrder()
       │
       ▼
sessionStorage.setItem('selected-template', id)
       │
       ▼
navigate('/editor')
       │
       ▼
CVEditor renders with new settings applied
```

---

## Authentication Flow

### Registration & Login

```
┌──────────┐                          ┌──────────┐
│  Client  │                          │  Server  │
└────┬─────┘                          └────┬─────┘
     │  POST /api/auth/register            │
     │  { email, username, password }      │
     ├───────────────────────────────────► │
     │                                     │ Validate, hash password
     │                                     │ Create User + default CV
     │                                     │ Audit log: account_created
     │  ◄─ 201 { user }                   │
     │                                     │
     │  POST /api/auth/login/json          │
     │  { email, password }                │
     ├───────────────────────────────────► │
     │                                     │ Verify password
     │                                     │ Check account lockout
     │                                     │ Create access token (JWT)
     │                                     │ Create refresh token (random)
     │                                     │ Store token hash in DB
     │  ◄─ 200 { access_token }            │
     │  ◄─ Set-Cookie: refresh_token       │
     │     (HttpOnly, Secure, SameSite)    │
     │                                     │
     │  Store access_token in localStorage │
     │                                     │
```

### Token Refresh (Rotation)

```
     │  Access token expired               │
     │                                     │
     │  POST /api/auth/refresh             │
     │  Cookie: refresh_token=ABC          │
     ├───────────────────────────────────► │
     │                                     │ Hash(ABC) → find in DB
     │                                     │ Verify not expired/revoked
     │                                     │ Mark ABC as used_at=now
     │                                     │ Create new refresh token DEF
     │                                     │ Create new access token
     │  ◄─ 200 { access_token }            │
     │  ◄─ Set-Cookie: refresh_token=DEF   │
     │                                     │
```

### Token Reuse Detection

```
     │  Attacker replays old token ABC     │
     │  POST /api/auth/refresh             │
     │  Cookie: refresh_token=ABC          │
     ├───────────────────────────────────► │
     │                                     │ Hash(ABC) → found in DB
     │                                     │ BUT used_at is NOT null
     │                                     │ ⚠ TOKEN REUSE DETECTED
     │                                     │ Revoke ALL user tokens
     │                                     │ Audit: CRITICAL event
     │  ◄─ 401 Unauthorized               │
     │                                     │
```

---

## Request Lifecycle

Every incoming request passes through the middleware stack in order:

1. **TrustedHostMiddleware** — Reject requests with invalid `Host` headers
2. **HTTPSRedirectMiddleware** — Redirect HTTP → HTTPS (production)
3. **RequestSizeLimitMiddleware** — Reject bodies > 10 MB
4. **RateLimitMiddleware** — Check per-IP rate limits (60/min general, 10/min auth)
5. **ContentTypeValidationMiddleware** — Enforce `Content-Type: application/json` on mutations
6. **CSRFMiddleware** — Validate `Origin` header on state-changing requests
7. **SecurityHeadersMiddleware** — Add OWASP security headers to response
8. **CORSMiddleware** — Handle preflight and cross-origin headers

After middleware, the request reaches the appropriate route handler which may:

- Authenticate via `get_current_user` (JWT Bearer dependency)
- Validate request body via Pydantic schema
- Perform database operations via SQLAlchemy session
- Log events via the audit system
- Return a Pydantic response model
