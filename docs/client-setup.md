# Client Setup Guide

> Frontend installation, development, build, and testing.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Build](#build)
- [Testing](#testing)
- [Configuration](#configuration)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 8.x

### Install on Fedora

```bash
sudo dnf install nodejs npm
```

### Install on Ubuntu/Debian

```bash
sudo apt install nodejs npm
```

### Install via nvm (recommended)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

---

## Installation

```bash
cd client
npm install
```

### Dependencies

| Package                         | Version | Purpose                              |
| ------------------------------- | ------- | ------------------------------------ |
| `react`                         | ^18.2.0 | UI library                           |
| `react-dom`                     | ^18.2.0 | DOM rendering                        |
| `react-router-dom`              | ^7.13.0 | Client-side routing                  |
| `dompurify`                     | ^3.0.0  | HTML sanitization for inline editing |
| `react-easy-crop`               | ^5.5.7  | Profile image cropper                |
| `html2canvas`                   | ^1.4.1  | Canvas rendering utility             |
| `@fontsource/*`                 | 5.2.x   | 16 self-hosted font families         |
| `@fortawesome/fontawesome-free` | ^7.2.0  | Self-hosted icon library             |

**Dev dependencies (build & test):**

| Package                | Version | Purpose                            |
| ---------------------- | ------- | ---------------------------------- |
| `vite`                 | ^6.3.3  | Build tool and dev server          |
| `@vitejs/plugin-react` | ^4.5.0  | React fast-refresh plugin for Vite |
| `typescript`           | ^6.0.2  | TypeScript compiler                |
| `vitest`               | ^3.1.2  | Unit test runner                   |

---

## Development

```bash
npm run dev
```

Opens `http://localhost:3000` with hot module replacement (HMR). The dev server proxies `/api` requests to `http://localhost:8000` automatically (configured in `vite.config.ts`).

### Environment Variables

Create a `.env` file in the `client/` directory (optional):

```env
# API server URL (defaults to http://localhost:8000/api)
REACT_APP_API_URL=http://localhost:8000/api
```

> The `REACT_APP_*` prefix is bridged into Vite builds via `vite.config.ts`'s `define` block. You do not need to rename variables to `VITE_*`.

### Proxy Setup

The client communicates with the backend at `http://localhost:8000`. Start both servers:

**Terminal 1 (Backend):**

```bash
cd server && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 (Frontend):**

```bash
cd client && npm run dev
```

---

## Build

```bash
npm run build
```

Creates an optimized production build in `client/build/`.

The build folder contains:

- Minified and bundled JavaScript
- Optimized CSS
- Static assets
- `index.html` with injected script/style references

### Serve Build Locally

```bash
npx serve -s build -l 3000
```

---

## Testing

```bash
npm test
```

Runs Vitest in watch mode.

```bash
# Run tests once (CI mode)
npm run test -- --run

# Run with coverage report
npm run test -- --run --coverage
```

---

## Configuration

### API URL

The API service layer (`src/services/api.ts`) uses:

```typescript
const API_BASE: string =
  process.env.REACT_APP_API_URL || "http://localhost:8000/api";
```

Set `REACT_APP_API_URL` in `client/.env` or at build time for production.

### Bundled Resources

All fonts and icons are **self-hosted** via npm packages — no external CDN requests are made.

| Resource         | Package                         | Purpose                           |
| ---------------- | ------------------------------- | --------------------------------- |
| 16 font families | `@fontsource/*`                 | Body text, headings, CV templates |
| Font Awesome 7   | `@fortawesome/fontawesome-free` | UI icons                          |

---

## Customization

### Theme Colors

Edit CSS custom properties in `src/App.css`:

```css
[data-theme="dark"] {
  --bg-primary: #0a0a0b;
  --accent-color: #6366f1;
  /* ... */
}

[data-theme="light"] {
  --bg-primary: #fafafa;
  --accent-color: #4f46e5;
  /* ... */
}
```

### Default Document Data

Edit `src/data/initialData.ts` to change the default document content shown to new users.

### Templates

Add new templates in `src/data/templates.ts`:

```javascript
{
  id: 'my-template',
  name: 'My Template',
  description: 'Custom template description',
  type: 'resume',        // 'resume' or 'cover-letter'
  category: 'creative',  // 'professional', 'modern', 'creative', 'technical'
  preview: { colors: { primary: '#color1', secondary: '#color2', accent: '#color3' } },
  settings: { sidebarColor1: '#...', sidebarColor2: '#...', accentColor: '#...' },
  visibleSections: { summary: true, skills: true, /* ... */ },
  sidebarOrder: ['summary', 'skills', 'languages', 'courses', 'strengths', 'achievements']
}
```

### Adding a New Language

1. Create `src/locales/<code>.json` with all translation keys (copy `en.json` as a starting point)
2. Add the language to `availableLanguages` in `src/i18n.tsx`:
   ```typescript
   const availableLanguages = [
     { code: "en", label: "English" },
     { code: "de", label: "Deutsch" },
     { code: "fr", label: "Français" }, // new
   ];
   ```

### Adding a New CV Section

1. Add default data in `src/data/initialData.ts`
2. Add the section to `visibleSections` in `src/contexts/AppStateContext.tsx`
3. Add rendering logic in the relevant component inside `src/components/`
4. Add the section key to `sidebarOrder` if it belongs in the sidebar
5. Add translation keys in both `src/locales/en.json` and `src/locales/de.json`
6. Add a toggle in `src/components/VerticalMenu.tsx`

---

## Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Vite reads server.port from vite.config.ts (default 3000).
# Override at runtime:
npx vite --port 3001
```

**Blank page after build:**

- Check that `homepage` in `package.json` matches your deployment path
- If deploying to a subdirectory, set `"homepage": "/subdirectory/"`

**CORS errors with backend:**

- Ensure the backend `CORS_ORIGINS` includes `http://localhost:3000`
- Check that the API URL is correct in `.env`

**npm install failures:**

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**Hot reload not working:**

```bash
# Stop the dev server (Ctrl+C) and restart
npm run dev
```

**Print layout issues:**

- Reset browser zoom to 100% before printing
- Enable "Background graphics" in the print dialog
