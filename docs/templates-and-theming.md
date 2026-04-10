# Templates & Theming

> Template system, theme implementation, and internationalization (i18n).

---

## Table of Contents

- [Template System](#template-system)
- [Theme System](#theme-system)
- [Internationalization (i18n)](#internationalization-i18n)
- [Print Styling](#print-styling)

---

## Template System

### Overview

Templates define the visual style and section configuration for CV documents. They provide a starting point for users, applying predefined colors, section visibility, and layout preferences.

### Available Templates

| ID | Name | Type | Category | Sidebar Colors |
|----|------|------|----------|------|
| `resume-modern` | Modern Professional | Resume | Modern | Teal (#006666) |
| `classic-professional` | Classic Professional | Resume | Professional | Navy gradient (#0f2847 → #1e3a5f) |
| `executive-prestige` | Executive Prestige | Resume | Professional | Dark gradient (#111827 → #374151) |
| `ats-optimized` | ATS Optimized | Resume | Technical | Navy gradient (#1a1a2e → #16213e) |
| `cover-executive` | Executive Cover Letter | Cover Letter | Professional | Dark gradient (#111827 → #374151) |
| `cover-professional` | Standard Cover Letter | Cover Letter | Professional | Indigo accent (#2563eb) |

### Template Structure

Each template in `src/data/templates.js` includes:

```javascript
{
  id: 'classic-professional',
  name: 'Classic Professional',
  description: 'A clean, traditional resume layout...',
  type: 'resume',                    // 'resume' | 'cover-letter'
  category: 'professional',          // 'professional' | 'modern' | 'creative' | 'technical'
  preview: {
    colors: {
      primary: '#312e81',            // Preview card color 1
      secondary: '#4f46e5',          // Preview card color 2
      accent: '#6366f1'              // Preview card accent
    }
  },
  settings: {
    sidebarColor1: '#312e81',        // Applied sidebar gradient start
    sidebarColor2: '#4f46e5',        // Applied sidebar gradient end
    accentColor: '#6366f1'           // Applied heading/link accent
  },
  visibleSections: {
    summary: true,
    strengths: true,
    languages: true,
    skills: true,
    achievements: true,
    experience: true,
    education: true,
    courses: true
  },
  sidebarOrder: ['summary', 'skills', 'languages', 'courses', 'strengths', 'achievements']
}
```

### Template Data Files

Located in `src/data/templates.js`:

| Template ID | Type | Description |
|-------------|------|-------------|
| `resume-modern` | `resume` | Sleek modern design with teal tones |
| `classic-professional` | `resume` | Traditional professional resume with navy sidebar |
| `executive-prestige` | `resume` | Executive layout with dark gradient |
| `ats-optimized` | `resume` | Clean, parser-friendly layout for ATS systems |
| `cover-executive` | `cover-letter` | Executive cover letter with dark gradient |
| `cover-professional` | `cover-letter` | Standard professional cover letter |

### Filter Categories

**Document Types:**
- `all` — All documents
- `resume` — Resume/CV documents
- `cover-letter` — Cover letters

**Categories:**
- `all` — All styles
- `professional` — Classic, traditional layouts
- `modern` — Contemporary, sleek designs
- `creative` — Artistic, unique layouts
- `technical` — Developer/engineer focused

### Template Application Flow

```
TemplatesGallery → User clicks "Use Template"
    │
    ▼
getTemplateById(templateId) → template config
    │
    ▼
Apply to AppStateContext:
  - updateSettings(template.settings)         → colors
  - setVisibleSections(template.visibleSections) → section toggles
  - setSidebarOrder(template.sidebarOrder)    → section order
    │
    ▼
sessionStorage.setItem('selected-template', id)
    │
    ▼
navigate('/editor') → Editor renders with new settings
```

### Adding a New Template

1. Add the template definition to the `cvTemplates` array in `src/data/templates.js`:
   ```javascript
   {
     id: 'my-custom-template',
     name: 'My Custom Template',
     description: 'Description',
     type: 'resume',
     category: 'creative',
     preview: { colors: { primary: '#...', secondary: '#...', accent: '#...' } },
     settings: { sidebarColor1: '#...', sidebarColor2: '#...', accentColor: '#...' },
     visibleSections: { /* ... */ },
     sidebarOrder: [/* ... */]
   }
   ```

2. Optionally create a config file in `src/templates/` for custom layout logic.

3. The template automatically appears in the gallery and is filterable by type/category.

---

## Theme System

### Architecture

The theme system uses CSS Custom Properties (CSS Variables) switched via a `data-theme` attribute on the `<html>` element.

```
ThemeContext.toggleTheme()
    │
    ▼
theme state: "dark" ↔ "light"
    │
    ├─► <html data-theme="dark|light">
    ├─► localStorage('career-forge-theme')
    └─► authApi.updatePreferences({ theme })  (if authenticated)
```

### CSS Variables

Defined in `src/App.css` under `[data-theme="dark"]` and `[data-theme="light"]`:

#### Background Colors
| Variable | Dark | Light |
|----------|------|-------|
| `--bg-primary` | `#0a0a0b` | `#fafafa` |
| `--bg-secondary` | `#121214` | `#f0f0f2` |
| `--bg-tertiary` | `#1a1a1f` | `#e8e8ec` |
| `--bg-hover` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.04)` |
| `--bg-input` | `rgba(255,255,255,0.05)` | `#ffffff` |
| `--bg-elevated` | `#1e1e24` | `#ffffff` |

#### Text Colors
| Variable | Dark | Light |
|----------|------|-------|
| `--text-primary` | `#f0f0f0` | `#1a1a1a` |
| `--text-secondary` | `#a0a0a8` | `#4a4a52` |
| `--text-muted` | `#68687a` | `#8a8a96` |

#### Accent Colors
| Variable | Dark | Light |
|----------|------|-------|
| `--accent-color` | `#6366f1` | `#4f46e5` |
| `--accent-hover` | `#818cf8` | `#6366f1` |
| `--accent-muted` | `rgba(99,102,241,0.15)` | `rgba(79,70,229,0.1)` |
| `--accent-glow` | `rgba(99,102,241,0.3)` | `rgba(79,70,229,0.15)` |
| `--accent-secondary` | `#22d3ee` | `#0891b2` |

#### Status Colors
| Variable | Dark | Light |
|----------|------|-------|
| `--success-color` | `#10b981` | `#059669` |
| `--error-color` | `#ef4444` | `#dc2626` |
| `--warning-color` | `#f59e0b` | `#d97706` |

#### Effects
| Variable | Dark | Light |
|----------|------|-------|
| `--shadow-sm` | Subtle dark shadow | Subtle light shadow |
| `--shadow-md` | Medium dark shadow | Medium light shadow |
| `--shadow-lg` | Large dark shadow with accent glow | Large clean shadow |
| `--glass-bg` | `rgba(255,255,255,0.03)` | `rgba(255,255,255,0.7)` |
| `--glass-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` |

### Using Theme Variables in Components

```css
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
}

.my-component:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-glow);
}
```

### Design Language

- **Dark theme**: Deep backgrounds, indigo primary accent, cyan secondary, glassmorphism (blur + transparency), glow shadows
- **Light theme**: Clean whites, deeper indigo, refined subtle shadows, no glow
- **Typography**: Inter (body, 400/500/600/700), Rubik (headings, 400/500/600/700)
- **Icons**: Font Awesome 6.4 (`fas fa-*` classes)

---

## Internationalization (i18n)

### Architecture

Custom i18n implementation using React Context (no external library):

```
I18nProvider (src/i18n.js)
    ├─► lang: "en" | "de"
    ├─► t(key): dot-notation translation lookup
    ├─► setLang(code): change language
    └─► availableLanguages: [{code, label}]
```

### Translation Files

| File | Language | Keys |
|------|----------|------|
| `src/locales/en.json` | English | ~180 keys |
| `src/locales/de.json` | German | ~180 keys |

### Key Namespaces

| Namespace | Description | Example Keys |
|-----------|-------------|-------------|
| `home` | Landing page | `home.title`, `home.subtitle`, `home.guestMode` |
| `nav` | Navigation | `nav.editor`, `nav.templates`, `nav.dashboard` |
| `toolbar` | Editor toolbar | `toolbar.print`, `toolbar.export` |
| `sections` | CV section names | `sections.summary`, `sections.experience` |
| `settings` | Settings panel | `settings.colors`, `settings.sections` |
| `auth` | Auth forms | `auth.login`, `auth.register`, `auth.email` |
| `dashboard` | CV dashboard | `dashboard.title`, `dashboard.search` |
| `templates` | Template gallery | `templates.title`, `templates.useTemplate` |
| `userMenu` | User menu | `userMenu.logout`, `userMenu.newCV` |
| `saveStatus` | Save indicator | `saveStatus.saving`, `saveStatus.saved` |
| `pages` | Page controls | `pages.page`, `pages.zoom` |
| `buttons` | Common buttons | `buttons.add`, `buttons.delete` |
| `profile` | Profile section | `profile.photo`, `profile.upload` |
| `placeholders` | Placeholder text | `placeholders.name`, `placeholders.email` |
| `common` | Common strings | `common.cancel`, `common.confirm` |

### Using Translations

```jsx
import { useI18n } from '../i18n';

function MyComponent() {
  const { t, lang, setLang } = useI18n();
  
  return (
    <div>
      <h1>{t('home.title')}</h1>
      <p>{t('sections.experience')}</p>
      <button onClick={() => setLang('de')}>Deutsch</button>
    </div>
  );
}
```

### Adding a New Language

1. **Create the locale file:**
   Copy `src/locales/en.json` to `src/locales/<code>.json` and translate all values.

2. **Register the language:**
   ```javascript
   // src/i18n.js
   import fr from './locales/fr.json';
   
   const translations = { en, de, fr };
   
   const availableLanguages = [
     { code: 'en', label: 'English' },
     { code: 'de', label: 'Deutsch' },
     { code: 'fr', label: 'Français' }
   ];
   ```

3. The language automatically appears in the `LanguageSwitcher` dropdown.

### Language Persistence

- **Guest users**: Language saved to `localStorage('career-forge-lang')`
- **Authenticated users**: Language synced with server preferences
  - On login: server preference applied to client
  - On change: client preference sent to server via `PATCH /api/auth/preferences`

---

## Print Styling

### Overview

The application includes extensive `@media print` CSS rules in `src/App.css` for proper A4 document output.

### Print Behavior

- `window.print()` triggered by the Print button
- All UI chrome (header, toolbar, menus, controls) hidden
- CV content scaled to fit A4 page: `transform: scale(0.85)` with `width: 117.65%` compensation
- Background colors preserved via `print-color-adjust: exact`

### Print CSS Rules

```css
@media print {
  @page {
    size: A4;
    margin: 0;
  }
  
  /* Hide all non-CV elements */
  .global-header, .text-toolbar, .vertical-menu,
  .page-controls, .editor-toolbar { display: none !important; }
  
  /* Scale to fit A4 */
  .cv-page {
    transform: scale(0.85);
    width: 117.65%;
  }
  
  /* Preserve background colors */
  .sidebar {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
  
  /* Prevent content splitting */
  .experience-entry, .education-entry {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
```

### Browser Print Instructions

| Browser | Background Colors Setting |
|---------|--------------------------|
| Chrome/Edge | Print → More settings → "Background graphics" ✓ |
| Firefox | Print → Options → "Print Background Colors and Images" ✓ |
| Safari | Print → "Print backgrounds" ✓ |

### Print Optimization Tips

- Reset zoom to 100% before printing
- Keep content concise for single-page output
- Use custom scale 90–95% if content slightly overflows
- Optimal sidebar content: 3–4 line summary, 2–4 languages, 3–5 skills
- Optimal main content: 2–4 experience entries, 1–3 education entries
