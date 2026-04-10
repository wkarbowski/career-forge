import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { initialData, initialCoverLetterData } from '../data/initialData';

const AppStateContext = createContext();

const LS_KEY = 'career-forge-state';

export const defaultSettings = {
  sidebarColor1: '#312e81',
  sidebarColor2: '#4f46e5',
  accentColor: '#6366f1',
  layout: 'sidebar-left',
  nameFont: 'Rubik',
  nameFontSize: 36,
  headingFont: 'Rubik',
  headingFontSize: 14,
  subtitleFont: 'Rubik',
  subtitleFontSize: 14,
  bodyFont: 'Inter',
  bodyFontSize: 13,
};

export const defaultClSettings = {
  nameFont: 'Open Sans',
  nameFontSize: 28,
  senderFont: 'Open Sans',
  senderFontSize: 11,
  subjectFont: 'Open Sans',
  subjectFontSize: 13,
  bodyFont: 'Open Sans',
  bodyFontSize: 12,
};

const defaultVisibleSections = {
  summary: true,
  coreCompetencies: true,
  languages: true,
  skills: true,
  achievements: true,
  experience: true,
  education: true,
};

const defaultSidebarOrder = [
  'summary',
  'skills',
  'languages',
  'coreCompetencies',
  'achievements',
];

const loadFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

const saved = loadFromLocalStorage();

// Migrate legacy data structures to current schema
function migrateData(data) {
  if (!data) return data;
  const migrated = { ...data };

  // Strengths → coreCompetencies: map title→name, drop description
  if (migrated.strengths && !migrated.coreCompetencies) {
    migrated.coreCompetencies = migrated.strengths.map(s => ({
      id: s.id,
      name: s.title || s.name || '',
    }));
    delete migrated.strengths;
  }

  // Courses → merge into education with type:'course'
  if (migrated.courses) {
    const courseItems = migrated.courses.map(c => ({
      id: c.id,
      type: 'course',
      title: c.title || '',
      institution: c.description || '',
      period: c.period || '',
      description: '',
    }));
    migrated.education = [
      ...(migrated.education || []).map(e => ({ type: 'degree', ...e })),
      ...courseItems,
    ];
    delete migrated.courses;
  } else if (migrated.education) {
    // Ensure existing education items have a type field
    migrated.education = migrated.education.map(e => ({ type: 'degree', ...e }));
  }

  // Ensure customSections exists
  if (!migrated.customSections) {
    migrated.customSections = [];
  }

  // Ensure contact has linkedin/github fields
  if (migrated.contact && !('linkedin' in migrated.contact)) {
    migrated.contact = { ...migrated.contact, linkedin: '', github: '' };
  }

  return migrated;
}

// Migrate visibleSections: rename legacy keys
function migrateVisibleSections(vs) {
  if (!vs) return vs;
  const migrated = { ...vs };
  if ('strengths' in migrated) {
    migrated.coreCompetencies = migrated.strengths;
    delete migrated.strengths;
  }
  if ('courses' in migrated) {
    delete migrated.courses;
  }
  return migrated;
}

// Migrate sidebarOrder: rename legacy section names
function migrateSidebarOrder(order) {
  if (!order) return order;
  return order
    .map(name => (name === 'strengths' ? 'coreCompetencies' : name))
    .filter(name => name !== 'courses');
}

export function AppStateProvider({ children }) {
  const [data, setData] = useState(() => migrateData(saved?.data ?? initialData));
  const [settings, setSettings] = useState({ ...defaultSettings, ...(saved?.settings ?? {}) });
  const [clSettings, setClSettings] = useState({ ...defaultClSettings, ...(saved?.clSettings ?? {}) });
  const [profileImage, setProfileImage] = useState(saved?.profileImage ?? null);
  const [visibleSections, setVisibleSections] = useState(() => migrateVisibleSections(saved?.visibleSections ?? defaultVisibleSections));
  const [sidebarOrder, setSidebarOrder] = useState(() => migrateSidebarOrder(saved?.sidebarOrder ?? defaultSidebarOrder));
  const [documentType, setDocumentType] = useState(saved?.documentType ?? 'resume');
  const [coverLetterData, setCoverLetterData] = useState(saved?.coverLetterData ?? initialCoverLetterData);
  const [documentTitle, setDocumentTitle] = useState(saved?.documentTitle ?? '');

  // Debounced localStorage sync
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ data, settings, clSettings, profileImage, visibleSections, sidebarOrder, documentType, coverLetterData, documentTitle }));
      } catch (e) { /* storage full or private mode */ }
    }, 1000);
    return () => clearTimeout(saveTimerRef.current);
  }, [data, settings, clSettings, profileImage, visibleSections, sidebarOrder, documentType, coverLetterData, documentTitle]);

  const resetToInitial = useCallback(() => {
    setData(initialData);
    setSettings(defaultSettings);
    setClSettings(defaultClSettings);
    setProfileImage(null);
    setVisibleSections(defaultVisibleSections);
    setSidebarOrder(defaultSidebarOrder);
    setDocumentType('resume');
    setCoverLetterData(initialCoverLetterData);
    setDocumentTitle('');
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }, []);

  // Custom section CRUD
  const addCustomSection = useCallback((sectionTemplate) => {
    const id = `custom_${Date.now()}`;
    const newSection = {
      ...sectionTemplate,
      id,
      items: sectionTemplate.items.map(item => ({ ...item, id: `item_${Date.now()}_${Math.random().toString(36).slice(2)}` })),
    };
    setData(prev => ({
      ...prev,
      customSections: [...(prev.customSections || []), newSection],
    }));
    // Register visibility (keyed directly by section id)
    setVisibleSections(prev => ({ ...prev, [id]: true }));
    if (newSection.position === 'sidebar') {
      setSidebarOrder(prev => [...prev, id]);
    }
    return id;
  }, []);

  const removeCustomSection = useCallback((sectionId) => {
    setData(prev => ({
      ...prev,
      customSections: (prev.customSections || []).filter(s => s.id !== sectionId),
    }));
    setVisibleSections(prev => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    setSidebarOrder(prev => prev.filter(name => name !== sectionId));
  }, []);

  const updateCustomSection = useCallback((sectionId, updates) => {
    setData(prev => ({
      ...prev,
      customSections: (prev.customSections || []).map(s =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  return (
    <AppStateContext.Provider value={{
      data, setData,
      settings, setSettings,
      clSettings, setClSettings,
      profileImage, setProfileImage,
      visibleSections, setVisibleSections,
      sidebarOrder, setSidebarOrder,
      documentType, setDocumentType,
      coverLetterData, setCoverLetterData,
      documentTitle, setDocumentTitle,
      resetToInitial,
      addCustomSection,
      removeCustomSection,
      updateCustomSection,
      migrateData,
      migrateVisibleSections,
      migrateSidebarOrder,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppStateContext);
}
