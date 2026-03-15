# Career Forge — Client Setup Guide

This guide covers everything needed to run the Career Forge frontend locally, in Docker, or in production.

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 LTS | Required for local development |
| npm | 9+ | Bundled with Node.js |
| Docker | 24+ | Required for containerised setup |
| Docker Compose | 2.20+ | Used in the repository root |

### Installing Node.js

**Fedora / RHEL:**
```bash
sudo dnf install nodejs npm -y
node --version   # should print v20.x.x
npm --version    # should print 10.x.x
```

**Ubuntu / Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS (via Homebrew):**
```bash
brew install node
```

**Windows (via winget):**
```bash
winget install OpenJS.NodeJS.LTS
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
npm install
```

This installs:
- `react` 18.2
- `react-dom` 18.2
- `react-router-dom` 7
- `react-scripts` 5
- `dompurify` 3

### 3. Configure environment variables

The only build-time variable is the backend API URL. Create a `.env` file in the `client/` directory:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

If this variable is not set, the application falls back to `http://localhost:8000/api` at runtime.

> **Note:** This value is baked into the JavaScript bundle at build time by Create React App. Changing it after `npm run build` requires a rebuild.

### 4. Ensure the backend is running

The client expects the FastAPI backend to be available at the URL defined in `REACT_APP_API_URL`. Start it separately or use Docker Compose (see below).

### 5. Start the development server

```bash
npm start
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
1. **Build stage** — Node 20 Alpine compiles the React bundle. `REACT_APP_API_URL` defaults to `/api` (relative path, resolved by Nginx).
2. **Production stage** — Nginx 1.27 Alpine serves the static bundle on port 80, proxies `/api/*` and `/uploads/*` to the backend container, and applies security headers.

To override the API URL at Docker build time:

```bash
docker compose build --build-arg REACT_APP_API_URL=https://api.example.com/api client
```

---

## Project Structure

```
client/
├── public/
│   └── index.html                  # HTML shell — loads Font Awesome from CDN
├── src/
│   ├── App.js                      # Root component: routing, auth guards, auto-save
│   ├── App.css                     # Global layout and CV styles
│   ├── i18n.js                     # Lightweight i18n context (en / de)
│   ├── components/
│   │   ├── GlobalHeader.js         # Persistent navigation bar
│   │   ├── HomePage.js             # Landing page / entry point
│   │   ├── CVPagesEditor.js        # Multi-page document editor
│   │   ├── CVDashboard.js          # Saved-document management dashboard
│   │   ├── TemplatesGallery.js     # Template picker with live previews
│   │   ├── AuthModal.js            # Authentication modal (login / register)
│   │   ├── EditableText.js         # contentEditable text wrapper
│   │   ├── LanguageLevel.js        # 5-dot language proficiency widget
│   │   ├── TextToolbar.js          # Floating inline formatting toolbar
│   │   ├── VerticalMenu.js         # Editor side toolbar (print, export…)
│   │   ├── ThemeToggle.js          # Light / dark theme switch
│   │   ├── LanguageSwitcher.js     # UI language selector
│   │   ├── UserMenu.js             # Account dropdown menu
│   │   ├── Sidebar/                # CV sidebar section components
│   │   └── MainContent/            # CV main content section components
│   ├── contexts/
│   │   ├── AppStateContext.js      # Global CV data and layout settings
│   │   ├── AuthContext.js          # Authentication state, CV list, save helpers
│   │   ├── PageContext.js          # Multi-page document state
│   │   ├── TemplateContext.js      # Active template state
│   │   └── ThemeContext.js         # Theme (light / dark) state
│   ├── data/
│   │   ├── initialData.js          # Default CV data structure
│   │   └── templates.js            # Template definitions (colours, sections, layout)
│   ├── hooks/
│   │   └── useLocalStorage.js      # Typed localStorage hook
│   ├── locales/
│   │   ├── en.json                 # English UI strings
│   │   └── de.json                 # German UI strings
│   ├── services/
│   │   └── api.js                  # Fetch wrappers for auth, CV CRUD, and uploads
│   └── templates/
│       ├── resume-default.js       # Default resume page template
│       ├── resume-modern.js        # Modern resume page template
│       └── cover-letter-default.js # Default cover letter page template
├── Dockerfile                      # Multi-stage Docker build
├── nginx.conf                      # Nginx: SPA routing + /api reverse proxy
├── package.json
└── tsconfig.json                   # TypeScript compiler config (type-check only)
```

---

## Available Scripts

```bash
# Start development server with hot reload
npm start

# Create an optimised production build in build/
npm run build

# Run tests in interactive watch mode
npm test

# Eject from Create React App (irreversible — only if you need full config control)
npm run eject
```

---

## Application Routing

| Path | Component | Access |
|---|---|---|
| `/` | `HomePage` | Public |
| `/templates` | `TemplatesGallery` | Guest or authenticated |
| `/editor` | `CVEditor` | Guest or authenticated |
| `/editor/:cvId` | `CVEditor` (loads saved CV) | Guest or authenticated |
| `/dashboard` | `CVDashboard` | Authenticated only |

Unauthenticated users accessing `/dashboard` are redirected to `/`.

---

## Authentication

The client uses JWT-based authentication:

- **Access token** — stored in `localStorage` under the key `cv_auth_token`. Expires in a short window (configured on the backend).
- **Refresh token** — stored as an `HttpOnly` cookie set by the server. The client never reads it directly; it is sent automatically on token-refresh requests.
- **Guest mode** — any visitor can try the editor without registering. Guest sessions are ephemeral; data is not persisted to the backend and is lost on browser close.

---

## Customisation

### Changing template colours

Template colour schemes are defined in `src/data/templates.js`. Each template object contains a `settings` property:

```javascript
settings: {
  sidebarColor1: '#312e81',
  sidebarColor2: '#4f46e5',
  accentColor: '#6366f1',
}
```

Modify these values to adjust the sidebar gradient and accent colour for any template.

### Adding a new template

1. Add a new entry to the `cvTemplates` array in `src/data/templates.js` following the existing structure.
2. Optionally create a matching page layout in `src/templates/`.
3. The template will appear automatically in `TemplatesGallery`.

### Adding a new UI language

1. Create a new locale file in `src/locales/` (e.g., `fr.json`) with all keys from `en.json`.
2. Import and register it in `src/i18n.js`:
   ```javascript
   import fr from './locales/fr.json';
   const locales = { en, de, fr };
   ```
3. The new language will appear in `LanguageSwitcher` automatically.

### Changing default CV data

Edit `src/data/initialData.js` to change the placeholder text shown when a new document is created.

---

## Troubleshooting

### Port 3000 is already in use

```bash
PORT=3001 npm start
```

### `npm install` fails or produces errors

```bash
# Remove existing node_modules and lock file, then reinstall
rm -rf node_modules package-lock.json
npm install
```

If the error is a Node.js version mismatch, ensure you are running Node.js 20:

```bash
node --version
```

### API requests fail (CORS or network errors)

- Ensure the backend is running and accessible at the URL in `REACT_APP_API_URL`.
- In development, the backend must allow `http://localhost:3000` as a CORS origin. See the server setup guide for backend CORS configuration.

### Changes to `.env` are not reflected

Environment variables are resolved at build time by `react-scripts`. After changing `.env`, stop the development server and restart it:

```bash
# Stop with Ctrl+C, then:
npm start
```

### Production build shows a blank page

Ensure the server is configured to serve `index.html` for all non-asset routes (required for client-side routing). The included `nginx.conf` handles this automatically.

---

## Production Deployment

### Static hosting (Netlify, Vercel, GitHub Pages, S3)

```bash
REACT_APP_API_URL=https://api.example.com/api npm run build
```

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
- [Create React App documentation](https://create-react-app.dev)
- [react-router-dom documentation](https://reactrouter.com)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [Font Awesome icons](https://fontawesome.com/icons)
- [Nginx documentation](https://nginx.org/en/docs/)
