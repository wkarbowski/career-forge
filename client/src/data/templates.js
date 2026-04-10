export const cvTemplates = [
  // ─────────────────────────────────────────────────────────
  //  RESUME TEMPLATES
  // ─────────────────────────────────────────────────────────

  {
    id: 'resume-modern',
    name: 'Modern Professional',
    description: 'A sleek, contemporary design with refined teal tones and clean modern typography. Ideal for tech, creative, and modern industry professionals.',
    type: 'resume',
    category: 'modern',
    preview: {
      colors: ['#006666', '#006666'],
      layout: 'sidebar-left',
    },
    settings: {
      layout: 'sidebar-left',
      sidebarColor1: '#006666',
      sidebarColor2: '#006666',
      accentColor: '#006666',
    },
    colorPresets: [
      { id: 'modern-cyan', nameKey: 'presets.modernCyan', sidebarColor1: '#006666', sidebarColor2: '#006666', accentColor: '#006666' },
      { id: 'midnight-slate', nameKey: 'presets.midnightSlate', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39', accentColor: '#1b2f39' },
    ],
    visibleSections: {
      summary: true,
      coreCompetencies: true,
      languages: true,
      skills: true,
      achievements: true,
      experience: true,
      education: true,
    },
    sidebarOrder: [
      'summary',
      'skills',
      'languages',
      'coreCompetencies',
      'achievements',
    ],
  },

  {
    id: 'classic-professional',
    name: 'Classic Professional',
    description: 'A clean, traditional layout trusted by Fortune 500 recruiters. Deep navy tones convey reliability and competence.',
    type: 'resume',
    category: 'professional',
    preview: {
      colors: ['#0f2847', '#2563eb'],
      layout: 'sidebar-right',
    },
    settings: {
      layout: 'sidebar-right',
      sidebarColor1: '#0f2847',
      sidebarColor2: '#1e3a5f',
      accentColor: '#2563eb',
      titleFont: 'Inter',
    },
    colorPresets: [
      { id: 'classic', nameKey: 'presets.classic', sidebarColor1: '#0f2847', sidebarColor2: '#1e3a5f', accentColor: '#2563eb' },
      { id: 'berlin', nameKey: 'presets.berlin', sidebarColor1: '#0f172a', sidebarColor2: '#334155', accentColor: '#3b82f6' },
      { id: 'midnight-slate', nameKey: 'presets.midnightSlate', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39', accentColor: '#1b2f39' },
    ],
    visibleSections: {
      summary: true,
      coreCompetencies: true,
      languages: true,
      skills: true,
      achievements: true,
      experience: true,
      education: true,
    },
    sidebarOrder: [
      'summary',
      'skills',
      'languages',
      'coreCompetencies',
      'achievements',
    ],
  },

  {
    id: 'executive-prestige',
    name: 'Executive Prestige',
    description: 'Commanding charcoal palette with gold accents and serif typography. Designed for senior leaders, directors, and C-suite roles.',
    type: 'resume',
    category: 'professional',
    preview: {
      colors: ['#111827', '#7c6f57'],
      layout: 'top-header',
    },
    settings: {
      layout: 'top-header',
      sidebarColor1: '#111827',
      sidebarColor2: '#374151',
      accentColor: '#7c6f57', // toned gold (was #b45309)
      titleFont: 'Playfair Display',
    },
    colorPresets: [
      { id: 'executive-gold', nameKey: 'presets.executiveGold', sidebarColor1: '#111827', sidebarColor2: '#374151', accentColor: '#7c6f57' },
      { id: 'midnight-slate', nameKey: 'presets.midnightSlate', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39', accentColor: '#1b2f39' },
    ],
    visibleSections: {
      summary: true,
      coreCompetencies: true,
      languages: true,
      skills: true,
      achievements: true,
      experience: true,
      education: true,
    },
    sidebarOrder: [
      'skills',
      'coreCompetencies',
      'languages',
      'summary',
      'achievements',
    ],
  },

  // ─────────────────────────────────────────────────────────
  //  ATS-OPTIMIZED TEMPLATE
  // ─────────────────────────────────────────────────────────

  {
    id: 'ats-optimized',
    name: 'ATS Optimized',
    description: 'A clean single-column layout designed to pass Applicant Tracking Systems. No sidebar, no multi-column — maximum ATS compatibility.',
    type: 'resume',
    category: 'professional',
    atsOptimized: true,
    preview: {
      colors: ['#1a1a2e', '#16213e'],
      layout: 'ats-single-column',
    },
    settings: {
      layout: 'ats-single-column',
      sidebarColor1: '#1a1a2e',
      sidebarColor2: '#16213e',
      accentColor: '#0f3460',
    },
    colorPresets: [
      { id: 'ats-navy', nameKey: 'presets.atsNavy', sidebarColor1: '#1a1a2e', sidebarColor2: '#16213e', accentColor: '#0f3460' },
      { id: 'ats-charcoal', nameKey: 'presets.atsCharcoal', sidebarColor1: '#1f2937', sidebarColor2: '#374151', accentColor: '#4b5563' },
      { id: 'midnight-slate', nameKey: 'presets.midnightSlate', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39', accentColor: '#1b2f39' },
    ],
    visibleSections: {
      summary: true,
      coreCompetencies: true,
      languages: true,
      skills: true,
      achievements: true,
      experience: true,
      education: true,
    },
    sidebarOrder: [
      'summary',
      'coreCompetencies',
      'skills',
      'languages',
      'achievements',
    ],
  },

  // ─────────────────────────────────────────────────────────
  //  COVER LETTER TEMPLATES
  // ─────────────────────────────────────────────────────────

  {
    id: 'cover-executive',
    name: 'Executive Cover Letter',
    description: 'A commanding cover letter with charcoal header band and gold accent line. Designed for senior leaders and C-suite roles.',
    type: 'cover-letter',
    category: 'professional',
    preview: {
      colors: ['#111827', '#374151', '#7c6f57'],
      layout: 'top-band',
    },
    settings: {
      accentColor: '#7c6f57',
      clStyle: 'executive',
      sidebarColor1: '#111827',
      sidebarColor2: '#374151',
    },
    clSettings: {
      nameFont: 'Playfair Display',
      nameFontSize: 28,
      senderFont: 'Inter',
      senderFontSize: 11,
      subjectFont: 'Playfair Display',
      subjectFontSize: 14,
      bodyFont: 'Inter',
      bodyFontSize: 12,
    },
    colorPresets: [
      { id: 'executive-gold', nameKey: 'presets.executiveGold', accentColor: '#7c6f57', sidebarColor1: '#111827', sidebarColor2: '#374151' },
      { id: 'midnight-slate', nameKey: 'presets.midnightSlate', accentColor: '#1b2f39', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39' },
    ],
  },

  {
    id: 'cover-professional',
    name: 'Standard Cover Letter',
    description: 'A formal, business-appropriate cover letter with a minimal design. Choose from multiple accent color schemes.',
    type: 'cover-letter',
    category: 'professional',
    preview: {
      colors: ['#2563eb', '#0d9488', '#7c3aed'],
      layout: 'full-width',
    },
    settings: {
      accentColor: '#1a1a1a',
      clStyle: 'standard',
    },
    clSettings: {
      nameFont: 'Open Sans',
      nameFontSize: 28,
      senderFont: 'Open Sans',
      senderFontSize: 11,
      subjectFont: 'Open Sans',
      subjectFontSize: 13,
      bodyFont: 'Open Sans',
      bodyFontSize: 12,
    },
    colorPresets: [
      { id: 'cover-indigo', nameKey: 'presets.coverIndigo', accentColor: '#2563eb' },
      { id: 'cover-teal', nameKey: 'presets.coverTeal', accentColor: '#0d9488' },
      { id: 'cover-violet', nameKey: 'presets.coverViolet', accentColor: '#7c3aed' },
      { id: 'cover-gold', nameKey: 'presets.coverGold', accentColor: '#92400e' },
      { id: 'cover-green', nameKey: 'presets.coverGreen', accentColor: '#059669' },
      { id: 'midnight-slate', nameKey: 'presets.midnightSlate', accentColor: '#1b2f39' },
    ],
  },
];

// Color presets for each cover letter style (used by VerticalMenu sidebar panel)
export const CL_COLOR_PRESETS = {
  modern: [
    { id: 'modern-cyan',      nameKey: 'presets.modernCyan',      accentColor: '#006666', sidebarColor1: '#006666', sidebarColor2: '#006666' },
    { id: 'midnight-slate',   nameKey: 'presets.midnightSlate',   accentColor: '#1b2f39', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39' },
  ],
  classic: [
    { id: 'classic',          nameKey: 'presets.classic',         accentColor: '#2563eb', sidebarColor1: '#0f2847', sidebarColor2: '#1e3a5f' },
    { id: 'berlin',           nameKey: 'presets.berlin',          accentColor: '#3b82f6', sidebarColor1: '#0f172a', sidebarColor2: '#334155' },
    { id: 'midnight-slate',   nameKey: 'presets.midnightSlate',   accentColor: '#1b2f39', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39' },
  ],
  executive: [
    { id: 'executive-gold', nameKey: 'presets.executiveGold', accentColor: '#7c6f57', sidebarColor1: '#111827', sidebarColor2: '#374151' },
    { id: 'modern-cyan',    nameKey: 'presets.modernCyan',    accentColor: '#006666', sidebarColor1: '#006666', sidebarColor2: '#006666' },
    { id: 'classic',        nameKey: 'presets.classic',       accentColor: '#2563eb', sidebarColor1: '#0f2847', sidebarColor2: '#1e3a5f' },
    { id: 'berlin',         nameKey: 'presets.berlin',        accentColor: '#3b82f6', sidebarColor1: '#0f172a', sidebarColor2: '#334155' },
    { id: 'midnight-slate', nameKey: 'presets.midnightSlate', accentColor: '#1b2f39', sidebarColor1: '#0d1b2a', sidebarColor2: '#1b2f39' },
  ],
  standard: [
    { id: 'cover-indigo',  nameKey: 'presets.coverIndigo',  accentColor: '#2563eb' },
    { id: 'cover-teal',    nameKey: 'presets.coverTeal',    accentColor: '#0d9488' },
    { id: 'cover-violet',  nameKey: 'presets.coverViolet',  accentColor: '#7c3aed' },
    { id: 'cover-gold',    nameKey: 'presets.coverGold',    accentColor: '#92400e' },
    { id: 'cover-green',   nameKey: 'presets.coverGreen',   accentColor: '#059669' },
    { id: 'modern-cyan',   nameKey: 'presets.modernCyan',   accentColor: '#006666' },
    { id: 'berlin',        nameKey: 'presets.berlin',       accentColor: '#3b82f6' },
    { id: 'midnight-slate', nameKey: 'presets.midnightSlate', accentColor: '#1b2f39' },
  ],
};

export const documentTypes = [
  { id: 'all', name: 'All' },
  { id: 'resume', name: 'Resumes' },
  { id: 'cover-letter', name: 'Cover Letters' },
];

export const getTemplateById = (id) => {
  return cvTemplates.find(t => t.id === id) || cvTemplates[0];
};

export const getTemplatesByType = (type) => {
  if (type === 'all') return cvTemplates;
  return cvTemplates.filter(t => t.type === type);
};
