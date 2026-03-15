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

- **Node.js** ≥ 16.x
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
nvm install 18
nvm use 18
```

---

## Installation

```bash
cd client
npm install
```

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | UI library |
| `react-dom` | ^18.2.0 | DOM rendering |
| `react-router-dom` | ^7.13.0 | Client-side routing |
| `react-scripts` | 5.0.1 | CRA build toolchain (Webpack, Babel, ESLint) |
| `dompurify` | ^3.0.0 | HTML sanitization for inline editing |

---

## Development

```bash
npm start
```

Opens `http://localhost:3000` with hot module replacement (HMR).

### Environment Variables

Create a `.env` file in the `client/` directory (optional):

```env
# API server URL (defaults to http://localhost:8000/api)
REACT_APP_API_URL=http://localhost:8000/api

# Custom port
PORT=3000
```

> All custom environment variables must be prefixed with `REACT_APP_` to be available in the React app.

### Proxy Setup

The client communicates with the backend at `http://localhost:8000`. Start both servers:

**Terminal 1 (Backend):**
```bash
cd server && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd client && npm start
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

Runs the Jest test runner in watch mode.

```bash
# Run tests once (CI mode)
CI=true npm test

# Run with coverage report
CI=true npm test -- --coverage
```

---

## Configuration

### API URL

The API service layer (`src/services/api.js`) uses:

```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
```

Set `REACT_APP_API_URL` in `.env` or at build time for production.

### External Resources

Loaded via CDN in `public/index.html`:

| Resource | CDN | Purpose |
|----------|-----|---------|
| Inter font | Google Fonts | Body text |
| Rubik font | Google Fonts | Headings |
| Font Awesome 6.4 | cdnjs | Icons |

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

### Default CV Data

Edit `src/data/initialData.js` to change the default CV content shown to new users.

### Templates

Add new templates in `src/data/templates.js`:

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
2. Add the language to `availableLanguages` in `src/i18n.js`:
   ```javascript
   const availableLanguages = [
     { code: 'en', label: 'English' },
     { code: 'de', label: 'Deutsch' },
     { code: 'fr', label: 'Français' }  // new
   ];
   ```

### Adding a New CV Section

1. Add default data in `src/data/initialData.js`
2. Add the section to `visibleSections` in `src/contexts/AppStateContext.js`
3. Add rendering logic in `src/components/Sidebar/Sidebar.js` or `src/components/MainContent/MainContent.js`
4. Add the section key to `sidebarOrder` if it belongs in the sidebar
5. Add translation keys in both `src/locales/en.json` and `src/locales/de.json`
6. Add a toggle checkbox in `src/components/VerticalMenu.js`

---

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
PORT=3001 npm start
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
npm start
```

**Print layout issues:**
- Reset browser zoom to 100% before printing
- Enable "Background graphics" in print dialog
- See the [Print Guide](../client/PRINT-GUIDE.md) for browser-specific instructions
