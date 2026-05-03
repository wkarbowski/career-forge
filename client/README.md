# Career Forge — Frontend

The React-based frontend for **Career Forge**, a full-featured resume and cover letter editor. Built with React 18, it communicates with a FastAPI backend and is served in production via Nginx inside Docker.

---

## Features

- **Inline rich-text editing** — click any field to edit it directly; a floating toolbar provides bold, italic, underline, lists, alignment, and colour controls
- **Multi-page document editor** — compose resumes or cover letters across multiple pages
- **Template gallery** — pick from a curated set of professionally designed resume and cover letter templates with live colour previews
- **Document dashboard** — authenticated users can create, rename, search, sort, filter, and delete all their saved documents
- **Authentication** — full register / login flow with JWT access tokens and HttpOnly-cookie refresh tokens; guest mode available without an account
- **Profile image upload** — upload a photo directly from the editor (requires authentication)
- **Export to PDF** — browser print with print-optimised CSS that hides all UI chrome
- **Import / Export JSON** — save and restore complete document data
- **Theme toggle** — light and dark mode, persisted per user
- **Multi-language UI** — English and German locales (persisted per user)
- **Auto-save** — changes are debounced and synced to the backend when authenticated
- **XSS sanitisation** — all HTML content is sanitised with DOMPurify before rendering

---

## Tech Stack

| Dependency       | Version       | Purpose                                   |
| ---------------- | ------------- | ----------------------------------------- |
| React            | 18.2          | UI framework                              |
| react-router-dom | 7             | Client-side routing                       |
| Vite             | 6             | Build tooling                             |
| DOMPurify        | 3             | HTML sanitisation                         |
| Nginx            | 1.27 (Alpine) | Production static file server + API proxy |

---

## Project Structure

```
client/
├── public/
│   └── index.html                  # HTML shell (Font Awesome CDN included)
├── src/
│   ├── App.tsx                     # Root component: routing, auth guards, auto-save
│   ├── App.css                     # Global CV and layout styles
│   ├── i18n.tsx                    # Lightweight i18n context (en / de)
│   ├── components/
│   │   ├── GlobalHeader.tsx        # Persistent top navigation bar
│   │   ├── HomePage.tsx            # Landing page with login / guest entry points
│   │   ├── CVPagesEditor.tsx       # Multi-page document editor
│   │   ├── CoverLetterEditor.tsx   # Cover letter editor
│   │   ├── DocumentDashboard.tsx   # Saved document management dashboard
│   │   ├── TemplatesGallery.jsx    # Browsable template picker
│   │   ├── AuthModal.tsx           # Login / register modal
│   │   ├── EditableText.tsx        # contentEditable wrapper component
│   │   ├── LanguageLevel.tsx       # Interactive 5-dot language proficiency widget
│   │   ├── CentralToolbar.tsx      # Toolbar for resume editor
│   │   ├── CLToolbar.tsx           # Toolbar for cover letter editor
│   │   ├── TextToolbar.tsx         # Floating rich-text formatting toolbar
│   │   ├── TextToolbarFixed.tsx    # Fixed-position formatting toolbar variant
│   │   ├── LanguageSwitcher.tsx    # UI language selector (en / de)
│   │   ├── ThemeToggle.tsx         # Light / dark theme switch
│   │   ├── UserMenu.tsx            # User account dropdown
│   │   ├── VerticalMenu.tsx        # Editor side toolbar (print, export, settings…)
│   │   ├── PageControls.tsx        # Per-page add / remove / reorder controls
│   │   ├── AccountSettings.tsx     # Account settings page
│   │   ├── VersionHistory.tsx      # Document version history panel
│   │   ├── KeywordMatcher.tsx      # Job description keyword matcher
│   │   ├── Sidebar/                # CV sidebar section components
│   │   └── MainContent/            # CV main content section components
│   ├── contexts/
│   │   ├── AppStateContext.tsx     # Global CV data and settings state
│   │   ├── AuthContext.tsx         # Auth state, document list, save helpers
│   │   ├── PageContext.tsx         # Multi-page state management
│   │   ├── UndoContext.tsx         # Undo / redo state management
│   │   └── ThemeContext.tsx        # Theme state
│   ├── data/
│   │   ├── initialData.ts          # Default CV data structure
│   │   └── templates.ts            # Template definitions (colours, sections, layout)
│   ├── locales/
│   │   ├── en.json                 # English translations
│   │   └── de.json                 # German translations
│   ├── services/
│   │   └── api.ts                  # Fetch wrappers (auth, document CRUD, uploads)
│   └── types/                      # Shared TypeScript type definitions
├── Dockerfile                      # Multi-stage build → Nginx production image
├── nginx.conf                      # Nginx config: SPA routing + /api proxy to backend
├── package.json
└── tsconfig.json                   # TypeScript compiler config (type-checking only)
```

---

## Routing

| Path                  | Component              | Access                 |
| --------------------- | ---------------------- | ---------------------- |
| `/`                   | `HomePage`             | Public                 |
| `/templates`          | `TemplatesGallery`     | Public                 |
| `/privacy`            | `PrivacyPolicyPage`    | Public                 |
| `/shared/:shareToken` | `SharedDocumentViewer` | Public                 |
| `/editor`             | `CVPagesEditor`        | Guest or authenticated |
| `/editor/:cvId`       | `CVPagesEditor`        | Guest or authenticated |
| `/dashboard`          | `DocumentDashboard`    | Authenticated only     |
| `/account`            | `AccountSettings`      | Authenticated only     |

---

## Environment Variables

| Variable            | Default                     | Description                                               |
| ------------------- | --------------------------- | --------------------------------------------------------- |
| `REACT_APP_API_URL` | `http://localhost:8000/api` | Backend API base URL, baked into the bundle at build time |

Create a `.env` file in the `client/` directory for local overrides:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

In Docker the value is injected as a build argument (`ARG REACT_APP_API_URL=/api`).

---

## Available Scripts

```bash
npm start          # Start the Vite development server on http://localhost:3000
npm run build      # Create an optimised production build in build/
npm run preview    # Serve the production build locally for inspection
npm run lint       # Type-check all TypeScript files (tsc --noEmit)
```

---

## Deployment

### Docker (recommended)

The recommended way to run Career Forge is via Docker Compose from the repository root. The client image performs a multi-stage build:

1. **Stage 1** — Node 20 Alpine builds the React bundle, injecting `REACT_APP_API_URL` as a build arg.
2. **Stage 2** — Nginx 1.27 Alpine serves the static bundle on port 80, proxies `/api/*` to the backend container, and sets security headers.

See the root `docker-compose.yml` for the full service definition.

### Manual / static hosting

```bash
REACT_APP_API_URL=https://api.example.com/api npm run build
```

The `REACT_APP_API_URL` variable is resolved at build time by Vite via the `define` config.

Deploy the generated `build/` directory to any static hosting provider (Netlify, Vercel, GitHub Pages, S3, etc.). Ensure the host is configured to serve `index.html` for all routes to support client-side routing.

---

## License

MIT
