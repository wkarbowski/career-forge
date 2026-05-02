# Frontend Guide

> React component architecture, state management, contexts, and UI features.

---

## Table of Contents

- [Application Entry Point](#application-entry-point)
- [React Contexts](#react-contexts)
- [Components Reference](#components-reference)
- [CV Editor System](#cv-editor-system)
- [Template System](#template-system)
- [Internationalization (i18n)](#internationalization-i18n)
- [Theme System](#theme-system)
- [API Service Layer](#api-service-layer)
- [Styling Approach](#styling-approach)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Application Entry Point

### `index.tsx`

Renders `<App />` into `#root`. Standard React 18 `createRoot` entry.

### `App.tsx`

The root component that:

1. Wraps the app in 6 nested context providers
2. Defines all routes with guards (`ProtectedRoute`, `EditorRoute`)
3. Contains the `CVEditor` component (the core editing interface)
4. Implements wrapper components for route pages that connect contexts to components

---

## React Contexts

### ThemeContext

**File:** `src/contexts/ThemeContext.tsx`

| State           | Type                | Description                   |
| --------------- | ------------------- | ----------------------------- |
| `theme`         | `"dark" \| "light"` | Current theme                 |
| `toggleTheme()` | function            | Switch between dark and light |

- Persists to `localStorage('career-forge-theme')`
- Sets `data-theme` attribute on `<html>` element
- Default: `"dark"`

---

### I18nContext (via `i18n.tsx`)

**File:** `src/i18n.tsx`

| State                | Type           | Description                  |
| -------------------- | -------------- | ---------------------------- |
| `lang`               | `"en" \| "de"` | Current language             |
| `setLang(lang)`      | function       | Change language              |
| `t(key)`             | function       | Translate a dot-notation key |
| `availableLanguages` | array          | `[{code, label}]`            |

- Custom implementation (no external i18n library)
- Dot-notation key resolution: `t('nav.editor')` → `locales[lang].nav.editor`
- Falls back to the key string if translation is missing
- Persists to `localStorage('career-forge-lang')`
- Syncs with server preferences for authenticated users

**Supported languages:** English (`en`), German (`de`)

---

### AppStateContext

**File:** `src/contexts/AppStateContext.tsx`

The core document state context. Manages:

| State             | Type                         | Description                                                                 |
| ----------------- | ---------------------------- | --------------------------------------------------------------------------- |
| `data`            | `CVData`                     | Full CV content (name, position, experience[], education[], skills[], etc.) |
| `settings`        | `CVSettings`                 | Visual settings: colors, fonts, layout                                      |
| `clSettings`      | `CLSettings`                 | Cover letter visual settings                                                |
| `profileImage`    | `string\|null`               | URL or filename of profile photo                                            |
| `visibleSections` | `VisibleSections`            | Boolean map of visible sections                                             |
| `sidebarOrder`    | `string[]`                   | Ordered section IDs                                                         |
| `documentType`    | `"resume" \| "cover-letter"` | Active document type                                                        |
| `coverLetterData` | `CoverLetterData`            | Cover letter content                                                        |
| `documentTitle`   | `string`                     | Document title shown in the editor                                          |

**Key methods:**

- `setData(data)` — Replace CV data
- `setSettings(settings)` — Replace visual settings
- `setClSettings(settings)` — Replace cover letter settings
- `setVisibleSections(sections)` — Toggle section visibility
- `setSidebarOrder(order)` — Reorder sidebar sections
- `setProfileImage(image)` — Set profile photo
- `setDocumentType(type)` — Switch between resume and cover letter
- `setCoverLetterData(data)` — Replace cover letter content
- `setDocumentTitle(title)` — Update the document title
- `resetToInitial()` — Reset all data to defaults
- `addCustomSection(template)` — Add a custom document section
- `removeCustomSection(sectionId)` — Remove a custom section
- `updateCustomSection(sectionId, updates)` — Update a custom section
- `migrateData(data)` — Migrate older data shapes to the current schema

State is persisted to `localStorage` under the key `'career-forge-state'` with debounced writes.

---

### PageContext

**File:** `src/contexts/PageContext.tsx`

Multi-page pagination and zoom state.

| State              | Type                      | Description            |
| ------------------ | ------------------------- | ---------------------- |
| `pages`            | array                     | Page data array        |
| `currentPageIndex` | number                    | Active page (0-based)  |
| `zoom`             | number                    | Zoom level (0.5 – 2.0) |
| `viewMode`         | `"pages" \| "continuous"` | Display mode           |

**Methods:**

- `goToPage(index)` — Navigate to specific page
- `nextPage()` / `prevPage()` — Navigate sequentially
- `addPage()` / `removePage()` — Manage page count
- `zoomIn()` / `zoomOut()` / `resetZoom()` — Zoom controls
- `setViewMode(mode)` — Toggle view mode

**Page Configuration (A4 at 96 DPI):**

- Width: 794px (210mm)
- Height: 1123px (297mm)
- Margins: 40px

---

### AuthContext

**File:** `src/contexts/AuthContext.tsx`

Authentication and document persistence.

| State               | Type                       | Description                  |
| ------------------- | -------------------------- | ---------------------------- |
| `user`              | `User\|null`               | Current user info            |
| `loading`           | `boolean`                  | Auth operation in progress   |
| `error`             | `string\|null`             | Last auth error              |
| `isAuthenticated`   | `boolean`                  | User is logged in            |
| `isGuest`           | `boolean`                  | Guest mode active            |
| `documentList`      | `Document[]`               | User’s saved documents       |
| `currentDocumentId` | `number\|'template'\|null` | Currently loaded document ID |

**Auth Methods:**

- `login(email, password)` — Authenticate and store tokens
- `register(email, username, password)` — Create account and auto-login
- `logout()` — Revoke tokens, clear state
- `logoutAllDevices()` — Revoke all sessions
- `startGuestMode()` — Enable editor without account

**Document Methods:**

- `saveDocument(title, data)` — Create or update document on server
- `refreshDocumentList()` — Reload document list from server
- `setCurrentDocumentId(id)` — Set active document

**Preference Methods:**

- `updatePreferences(prefs)` — Sync theme/language to server

---

### UndoContext

**File:** `src/contexts/UndoContext.tsx`

Undo/redo history for document edits.

| State     | Type      | Description               |
| --------- | --------- | ------------------------- |
| `canUndo` | `boolean` | Whether undo is available |
| `canRedo` | `boolean` | Whether redo is available |

**Methods:**

- `undo()` — Revert to previous state
- `redo()` — Re-apply reverted state

---

## Components Reference

### Layout Components

| Component        | Description                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GlobalHeader** | Persistent top navigation bar. Shows logo, nav links (Editor, Templates, Dashboard), save status, language switcher, theme toggle, and user menu. Hidden on landing page for unauthenticated users. |
| **UserMenu**     | Dropdown menu with user info, CV list, new CV, dashboard link, logout. For guests: login button + exit guest.                                                                                       |

### Page Components

| Component            | Route        | Description                                                                                                                       |
| -------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **HomePage**         | `/`          | Landing page with hero, feature cards, and login/register or guest entry options. Contains the `AuthModal`.                       |
| **AuthModal**        | —            | Modal dialog toggling between login and register forms. Validates password length (≥6), username (≥3), and password confirmation. |
| **TemplatesGallery** | `/templates` | Filterable grid of template cards. Filters by document type and category. Templates show CSS-rendered mini previews.              |
| **CVDashboard**      | `/dashboard` | Document management: create, search, sort, duplicate, share, delete, version history.                                             |

### CV Editor Components

| Component               | Description                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CVEditor**            | Core editor page. Contains document title bar, export/import toolbar, `CentralToolbar` or `CLToolbar`, `VerticalMenu`, and either `CVPagesEditor` (resume) or `CoverLetterEditor` (cover letter). Auto-saves with 1s debounce for authenticated users. |
| **CVPagesEditor**       | Multi-page pagination engine for resumes. Renders A4-sized pages (794×1123px). Uses a hidden measurer to calculate page count, clips content per page with `translateY()` offsets. Supports Ctrl+scroll zoom.                                          |
| **CoverLetterEditor**   | Dedicated cover letter editor with DIN 5008-style layout. Handles sender/recipient blocks, body text, and signature fields.                                                                                                                            |
| **PageControls**        | Fixed control bar: page nav (prev/next with input), add/remove page, zoom in/out/reset, view mode toggle.                                                                                                                                              |
| **VerticalMenu**        | Sticky side panel with expandable flyouts for color settings (sidebar gradient + accent) and section visibility toggles.                                                                                                                               |
| **VersionHistory**      | Side panel for creating named document snapshots and restoring them.                                                                                                                                                                                   |
| **KeywordMatcher**      | Side panel for pasting a job description and checking which keywords appear in the current CV.                                                                                                                                                         |
| **ProfileCompleteness** | Bottom bar that shows how complete the CV is based on filled fields.                                                                                                                                                                                   |

### CV Content Components

| Component         | Description                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar**       | Left sidebar of the CV. Contains profile image and 6 reorderable sections: Summary, Skills, Languages, Courses, Strengths, Achievements. Sections can be reordered with ↑/↓ arrows. |
| **MainContent**   | Right area of the CV. Contains header (name, position, contact info) and Experience + Education sections with add/delete entry buttons.                                             |
| **EditableText**  | Inline editing component using `contentEditable`. DOMPurify sanitization on input and paste. Supports placeholder text and HTML formatting.                                         |
| **LanguageLevel** | Visual proficiency indicator: 5 clickable dots (1=Beginner to 5=Native).                                                                                                            |

### Toolbar Components

| Component          | Description                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CentralToolbar** | Document-level toolbar for resumes. Controls font families, font sizes, and color settings. Rendered at the top of the editor.                                                                          |
| **CLToolbar**      | Document-level toolbar for cover letters. Controls formatting options specific to the cover letter layout.                                                                                              |
| **TextToolbar**    | Floating rich-text formatting toolbar. Appears on text selection. Features: bold, italic, underline, strikethrough, text/bg colors, alignment, lists, remove formatting. Uses `document.execCommand()`. |

### UI Controls

| Component             | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| **ThemeToggle**       | Sun/moon button to switch dark/light theme.                               |
| **LanguageSwitcher**  | Dropdown to switch UI language (EN/DE).                                   |
| **ImageCropperModal** | Modal for cropping a profile image before upload. Uses `react-easy-crop`. |

---

## CV Editor System

### Inline Editing

All text in the CV is live-editable through `EditableText` components:

1. User clicks any text field → `contentEditable` activates
2. User types or pastes content
3. `DOMPurify.sanitize()` strips dangerous HTML
4. `onInput` callback fires with sanitized `innerHTML`
5. `AppStateContext` state setters update the relevant field
6. For authenticated users: 1-second debounced auto-save to server

**Allowed HTML tags:** `b`, `i`, `u`, `strong`, `em`, `br`, `p`, `ul`, `ol`, `li`, `a`, `span`, `div`

### Rich Text Formatting

The `TextToolbar` provides Google Docs-style formatting:

- **Font families:** Rubik, Lato, Arial
- **Font sizes:** 10px – 36px (with zoom compensation)
- **Styles:** Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough
- **Colors:** Text color picker, background color picker
- **Alignment:** Left, Center, Right
- **Lists:** Bullet list, Numbered list
- **Clear:** Remove all formatting

### Multi-Page Pagination

The `CVPagesEditor` implements a word-processor-like page system:

1. Full CV content is rendered in a hidden measurer div
2. Total height is calculated and divided by A4 page height (1123px)
3. N visible pages are rendered, each showing a clipped portion
4. `translateY(-pageIndex * pageHeight)` offsets the content per page
5. CSS `overflow: hidden` clips to A4 boundaries
6. Page breaks attempt to avoid splitting elements mid-way

**Controls via `PageControls`:**

- Previous/Next page navigation
- Jump to page by number
- Add/Remove pages manually
- Zoom: 50% – 200% (with Ctrl+scroll)
- View mode: Separate pages or continuous scroll

### Export & Import

**JSON Export** includes the full CV state:

```json
{
  "data": { "name": "...", "experience": [...], ... },
  "settings": { "sidebarColor1": "#312e81", ... },
  "visibleSections": { "summary": true, ... },
  "profileImage": "data:image/...",
  "sidebarOrder": ["summary", "skills", ...],
  "exportedAt": "2026-02-13T15:00:00"
}
```

**Print** uses `window.print()` with extensive `@media print` CSS rules for proper A4 output.

---

## Template System

### Template Definitions

Defined in `src/data/templates.ts`:

| Template             | Type         | Category     | Colors                              |
| -------------------- | ------------ | ------------ | ----------------------------------- |
| Classic Professional | Resume       | Professional | Indigo gradient (#312e81 → #4f46e5) |
| Resume Modern        | Resume       | Modern       | Cyan gradient (#0e7490 → #06b6d4)   |
| Cover Professional   | Cover Letter | Professional | Indigo accent                       |

Each template defines: settings (colors), visible sections, sidebar order, and metadata.

### Template Application Flow

1. User browses `/templates` → selects a template card
2. Template settings are applied to `AppStateContext` (colors, sections, order)
3. Template ID stored in `sessionStorage` for persistence
4. User is navigated to `/editor`
5. Editor renders with the template's visual settings

### Template Configuration

All templates are defined in `src/data/templates.ts`:

- `classic-professional` — Standard corporate resume
- `resume-modern` — Modern/contemporary resume
- `cover-professional` — DIN 5008 cover letter with signature support

---

## Internationalization (i18n)

### Setup

Custom i18n system in `src/i18n.tsx` using React Context. No external library.

### Translation Keys

Organized by category with dot-notation access:

| Category      | Example Keys                                                    |
| ------------- | --------------------------------------------------------------- |
| `home.*`      | `home.title`, `home.subtitle`, `home.guestMode`                 |
| `nav.*`       | `nav.editor`, `nav.templates`, `nav.dashboard`                  |
| `toolbar.*`   | `toolbar.print`, `toolbar.export`, `toolbar.import`             |
| `sections.*`  | `sections.summary`, `sections.experience`, `sections.education` |
| `auth.*`      | `auth.login`, `auth.register`, `auth.email`, `auth.password`    |
| `dashboard.*` | `dashboard.title`, `dashboard.search`, `dashboard.sort`         |
| `templates.*` | `templates.title`, `templates.useTemplate`                      |
| `settings.*`  | `settings.colors`, `settings.sections`                          |

### Adding a New Language

1. Create `src/locales/<code>.json` with all translation keys
2. Add the language to the `availableLanguages` array in `i18n.tsx`

---

## Theme System

### CSS Custom Properties

Themes are implemented via CSS custom properties on `[data-theme]`:

```css
[data-theme="dark"] {
  --bg-primary: #0a0a0b;
  --text-primary: #f0f0f0;
  --accent-color: #6366f1;
  /* ... 40+ variables */
}

[data-theme="light"] {
  --bg-primary: #fafafa;
  --text-primary: #1a1a1a;
  --accent-color: #4f46e5;
  /* ... 40+ variables */
}
```

**Variable categories:**

- `--bg-*` — Background colors (primary, secondary, tertiary, hover, input, elevated)
- `--text-*` — Text colors (primary, secondary, muted)
- `--border-*` — Border colors (default, hover, focus)
- `--accent-*` — Accent colors (default, hover, muted, glow, secondary)
- `--success/error/warning-color` — Status colors
- `--shadow-*` — Box shadows (sm, md, lg, glow)
- `--glass-*` — Glass effect styles (bg, border)

### Design Language

- **Dark theme**: Deep backgrounds (#0a0a0b), indigo accent, cyan secondary, glassmorphism effects
- **Light theme**: Clean white backgrounds, deeper indigo, refined subtle shadows
- **Fonts**: 16 self-hosted font families via `@fontsource/*` npm packages
- **Icons**: Font Awesome 7 self-hosted via `@fortawesome/fontawesome-free`

---

## API Service Layer

**File:** `src/services/api.js`

### Token Management

- **Access tokens**: Stored in `localStorage('cv_auth_token')`
- **Refresh tokens**: HttpOnly cookies (set by server, never accessible to JS)
- **Auto-refresh**: `authenticatedFetch()` checks token expiry before each request
- **Retry on 401**: Automatically refreshes and retries failed requests
- **Concurrency-safe**: Prevents multiple simultaneous refresh attempts

### Available APIs

```javascript
import { authApi, documentApi } from "./services/api";

// Auth
await authApi.register(email, username, password);
await authApi.login(email, password);
await authApi.getCurrentUser();
await authApi.logout();
await authApi.logoutAllDevices();
await authApi.updatePreferences({ theme, language });
await authApi.refreshToken();

// Documents
await documentApi.list();
await documentApi.get(id);
await documentApi.create(title, data);
await documentApi.update(id, { title, data, is_default });
await documentApi.delete(id);
await documentApi.getDefault();
await documentApi.duplicate(id);
await documentApi.exportDocument(id);
await documentApi.importDocument(title, data);
await documentApi.uploadProfileImage(documentId, file);
```

---

## Styling Approach

- **No CSS framework** — Pure custom CSS
- **CSS Custom Properties** — 40+ theme variables
- **Component CSS files**: Separate `.css` per major component
- **Layouts**: CSS Grid + Flexbox
- **Print styles**: Extensive `@media print` rules for A4 output
- **Glass effects**: `backdrop-filter: blur()` for modern UI panels
- **Responsive design**: `auto-fit` grids, flexible layouts

### CSS Files

| File                    | Scope                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `App.css`               | Global styles, theme variables, document content styles, print rules |
| `index.css`             | Base reset                                                           |
| `GlobalHeader.css`      | Navigation bar                                                       |
| `HomePage.css`          | Landing page                                                         |
| `DocumentDashboard.css` | Dashboard table                                                      |
| `CVPagesEditor.css`     | Multi-page editor                                                    |
| `CoverLetterEditor.css` | Cover letter editor                                                  |
| `TemplatesGallery.css`  | Template gallery grid                                                |

---

## Keyboard Shortcuts

| Shortcut      | Action      |
| ------------- | ----------- |
| `Ctrl+B`      | Bold        |
| `Ctrl+I`      | Italic      |
| `Ctrl+U`      | Underline   |
| `Ctrl+Z`      | Undo        |
| `Ctrl+Y`      | Redo        |
| `Ctrl+Scroll` | Zoom in/out |
