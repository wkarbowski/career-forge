# Career Forge — Client Setup Guide

This guide covers everything needed to run the Career Forge frontend locally, in Docker, or in production.

---

## Prerequisites

| Tool           | Minimum version | Notes                            |
| -------------- | --------------- | -------------------------------- |
| Node.js        | 20.19+ or 22.12+ | Required for local development   |
| pnpm           | 11.5.0          | Managed by Corepack              |
| Docker         | 24+             | Required for containerised setup |
| Docker Compose | 2.20+           | Used in the repository root      |

### Installing Node.js

**Fedora / RHEL:**

```bash
sudo dnf install nodejs -y
corepack enable
node --version   # should print v20.19+ or v22.12+
pnpm --version   # should print 11.5.0
```

**Ubuntu / Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable
```

**macOS (via Homebrew):**

```bash
brew install node
corepack enable
```

**Windows (via winget):**

```bash
winget install OpenJS.NodeJS.LTS
corepack enable
```

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd career-forge
```

### 2. Install client dependencies

```bash
cd client
pnpm install --frozen-lockfile
```

This installs:

- `react` 19
- `react-dom` 19
- `react-router-dom` 7
- `vite` 8 (dev dependency)
- `dompurify` 3

### 3. Configure environment variables

Create a `.env` file in the `client/` directory for build-time settings:

```env
VITE_API_URL=http://localhost:8000/api
VITE_GDPR=false
```

If this variable is not set, the application falls back to `http://localhost:8000/api` at runtime.

> **Note:** These values are exposed to the browser bundle through Vite's `import.meta.env`. Changing them after `pnpm run build` requires a rebuild.

### 4. Ensure the backend is running

The client expects the FastAPI backend to be available at the URL defined in `VITE_API_URL`. Start it separately or use Docker Compose (see below).

### 5. Start the development server

```bash
pnpm start
```

The app opens automatically at `http://localhost:3000`. Hot reloading is enabled — changes to source files refresh the browser instantly.

---

## Docker Setup (Recommended)

The easiest way to run the entire stack (frontend + backend + database) is Docker Compose from the repository root.

```bash
# From the repository root
docker compose up --build
```

The client container performs a multi-stage build:

1. **Build stage** — Node 20 Alpine compiles the React bundle. `VITE_API_URL` defaults to `/api` (relative path, resolved by Nginx).
2. **Production stage** — Nginx 1.27 Alpine serves the static bundle on port 80, proxies `/api/*` and `/uploads/*` to the backend container, and applies security headers.

To override the API URL at Docker build time:

```bash
docker compose build --build-arg VITE_API_URL=https://api.example.com/api client
```

---

## Project Structure

```
client/
├── public/
│   └── index.html                  # HTML shell
├── src/
│   ├── App.tsx                     # Root component: routing, auth guards, auto-save
│   ├── App.css                     # Global layout and CV styles
│   ├── i18n.tsx                    # Lightweight i18n context (en / de)
│   ├── components/
│   │   ├── GlobalHeader.tsx        # Persistent navigation bar
│   │   ├── HomePage.tsx            # Landing page / entry point
│   │   ├── CVPagesEditor.tsx       # Multi-page document editor
│   │   ├── CoverLetterEditor.tsx   # Cover letter editor
│   │   ├── DocumentDashboard.tsx   # Saved-document management dashboard
│   │   ├── TemplatesGallery.jsx    # Template picker with live previews
│   │   ├── AuthModal.tsx           # Authentication modal (login / register)
│   │   ├── EditableText.tsx        # contentEditable text wrapper
│   │   ├── LanguageLevel.tsx       # 5-dot language proficiency widget
│   │   ├── CentralToolbar.tsx      # Toolbar for resume editor
│   │   ├── CLToolbar.tsx           # Toolbar for cover letter editor
│   │   ├── TextToolbar.tsx         # Floating inline formatting toolbar
│   │   ├── VerticalMenu.tsx        # Editor side toolbar (print, export…)
│   │   ├── ThemeToggle.tsx         # Light / dark theme switch
│   │   ├── LanguageSwitcher.tsx    # UI language selector
│   │   ├── UserMenu.tsx            # Account dropdown menu
│   │   ├── AccountSettings.tsx     # Account settings page
│   │   ├── VersionHistory.tsx      # Document version history panel
│   │   ├── KeywordMatcher.tsx      # Job description keyword matcher
│   │   ├── Sidebar/                # CV sidebar section components
│   │   └── MainContent/            # CV main content section components
│   ├── contexts/
│   │   ├── AppStateContext.tsx     # Global CV data and layout settings
│   │   ├── AuthContext.tsx         # Authentication state, document list, save helpers
│   │   ├── PageContext.tsx         # Multi-page document state
│   │   ├── UndoContext.tsx         # Undo / redo state management
│   │   └── ThemeContext.tsx        # Theme (light / dark) state
│   ├── data/
│   │   ├── initialData.ts          # Default CV data structure
│   │   └── templates.ts            # Template definitions (colours, sections, layout)
│   ├── locales/
│   │   ├── en.json                 # English UI strings
│   │   └── de.json                 # German UI strings
│   ├── services/
│   │   └── api.ts                  # Fetch wrappers for auth, document CRUD, and uploads
│   └── types/                      # Shared TypeScript type definitions
├── Dockerfile                      # Multi-stage Docker build
├── nginx.conf                      # Nginx: SPA routing + /api reverse proxy
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json                   # TypeScript compiler config (type-check only)
```

---

## Available Scripts

```bash
# Start Vite development server with HMR on http://localhost:3000
pnpm start

# Create an optimised production build in build/
pnpm run build

# Serve the production build locally for inspection
pnpm run preview

# Type-check all TypeScript files without emitting output
pnpm run lint
```

---

## Application Routing

| Path                  | Component              | Access                 |
| --------------------- | ---------------------- | ---------------------- |
| `/`                   | `HomePage`             | Public                 |
| `/templates`          | `TemplatesGallery`     | Public                 |
| `/privacy`            | `PrivacyPolicyPage`    | Public                 |
| `/shared/:shareToken` | `SharedDocumentViewer` | Public                 |
| `/reset-password`     | `PasswordResetPage`    | Public                 |
| `/editor`             | `CVEditor`             | Guest or authenticated |
| `/editor/:cvId`       | `CVEditor`             | Authenticated only     |
| `/dashboard`          | `DocumentDashboard`    | Authenticated only     |
| `/account`            | `AccountSettings`      | Authenticated only     |

Unauthenticated users accessing protected routes are redirected to `/`.

---

## Authentication

The client uses JWT-based authentication:

- **Access token** — stored in `localStorage` under the key `cv_auth_token`. Expires in a short window (configured on the backend).
- **Refresh token** — stored as an `HttpOnly` cookie set by the server. The client never reads it directly; it is sent automatically on token-refresh requests.
- **Guest mode** — any visitor can try the editor without registering. Guest sessions are ephemeral; data is not persisted to the backend and is lost on browser close.

---

## Customisation

### Changing template colours

Template colour schemes are defined in `src/data/templates.ts`. Each template object contains a `settings` property:

```javascript
settings: {
  sidebarColor1: '#312e81',
  sidebarColor2: '#4f46e5',
  accentColor: '#6366f1',
}
```

Modify these values to adjust the sidebar gradient and accent colour for any template.

### Adding a new template

1. Add a new entry to the `cvTemplates` array in `src/data/templates.ts` following the existing structure.
2. The template will appear automatically in `TemplatesGallery`.

### Adding a new UI language

1. Create a new locale file in `src/locales/` (e.g., `fr.json`) with all keys from `en.json`.
2. Import and register it in `src/i18n.tsx`:
   ```typescript
   import fr from "./locales/fr.json";
   const locales = { en, de, fr };
   ```
3. The new language will appear in `LanguageSwitcher` automatically.

### Changing default CV data

Edit `src/data/initialData.ts` to change the placeholder text shown when a new document is created.

---

## Troubleshooting

### Port 3000 is already in use

```bash
pnpm start -- --port 3001
```

### `pnpm install` fails or produces errors

```bash
# Remove existing node_modules, then reinstall from the lockfile
rm -rf node_modules
pnpm install --frozen-lockfile
```

If the error is a Node.js version mismatch, ensure you are running Node.js 20.19+ or 22.12+:

```bash
node --version
```

### API requests fail (CORS or network errors)

- Ensure the backend is running and accessible at the URL in `VITE_API_URL`.
- In development, the backend must allow `http://localhost:3000` as a CORS origin. See the server setup guide for backend CORS configuration.

### Changes to `.env` are not reflected

Environment variables are resolved at build time by Vite. After changing `.env`, stop the development server and restart it:

```bash
# Stop with Ctrl+C, then:
pnpm start
```

### Production build shows a blank page

Ensure the server is configured to serve `index.html` for all non-asset routes (required for client-side routing). The included `nginx.conf` handles this automatically.

---

## Production Deployment

### Static hosting (Netlify, Vercel, GitHub Pages, S3)

```bash
VITE_API_URL=https://api.example.com/api pnpm run build
```

The `VITE_API_URL` variable is exposed to the app at build time through `import.meta.env`.

Deploy the contents of the `build/` directory to your hosting provider. Configure the host to return `index.html` for all 404 responses to support deep linking.

### Nginx (self-hosted)

The repository includes a production-ready `nginx.conf` that:

- Serves the React SPA and handles client-side routing (`try_files`)
- Proxies `/api/*` to the FastAPI backend
- Proxies `/uploads/*` to the backend for profile image delivery
- Sets security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`)
- Enables gzip compression for all text assets

---

## Resources

- [React documentation](https://react.dev)
- [Vite documentation](https://vite.dev)
- [react-router-dom documentation](https://reactrouter.com)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [Font Awesome icons](https://fontawesome.com/icons)
- [Nginx documentation](https://nginx.org/en/docs/)
