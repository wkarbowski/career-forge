export const cvTemplates = [
  {
    id: 'classic-professional',
    name: 'Classic Professional',
    description: 'A clean, traditional layout perfect for corporate and professional roles.',
    type: 'resume',
    category: 'professional',
    preview: {
      colors: ['#4f46e5', '#818cf8'],
      layout: 'sidebar-left'
    },
    settings: {
      sidebarColor1: '#312e81',
      sidebarColor2: '#4f46e5',
      accentColor: '#6366f1',
    },
    visibleSections: {
      summary: true,
      strengths: true,
      languages: true,
      skills: true,
      achievements: true,
      experience: true,
      education: true,
      courses: true,
    },
    sidebarOrder: [
      'summary',
      'skills',
      'languages',
      'courses',
      'strengths',
      'achievements',
]},
  {
    id: 'resume-modern',
    name: 'Modern Professional',
    description: 'A sleek, contemporary design with clean lines and modern typography.',
    type: 'resume',
    category: 'modern',
    preview: {
      colors: ['#06b6d4', '#0891b2'],
      layout: 'sidebar-left'
    },
    settings: {
      sidebarColor1: '#0e7490',
      sidebarColor2: '#06b6d4',
      accentColor: '#22d3ee',
    },
    visibleSections: {
      summary: true,
      strengths: true,
      languages: true,
      skills: true,
      achievements: true,
      experience: true,
      education: true,
      courses: true,
    },
    sidebarOrder: [
      'summary',
      'skills',
      'languages',
      'courses',
      'strengths',
      'achievements',
    ],
  },
  {
    id: 'cover-professional',
    name: 'Professional Cover Letter',
    description: 'A formal, business-appropriate cover letter for corporate applications.',
    type: 'cover-letter',
    category: 'professional',
    preview: {
      colors: ['#4f46e5', '#818cf8'],
      layout: 'full-width'
    },
    settings: {
      accentColor: '#6366f1',
    },
  },
];

export const templateCategories = [
  { id: 'all', name: 'All Templates' },
  { id: 'professional', name: 'Professional' },
  { id: 'modern', name: 'Modern' },
  { id: 'creative', name: 'Creative' },
  { id: 'technical', name: 'Technical' },
];

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
