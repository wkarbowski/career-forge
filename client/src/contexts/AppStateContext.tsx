import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { CVData, CVSettings, CLSettings, VisibleSections, DocumentType, CoverLetterData, CustomSection, CustomSectionTemplate } from '../types';
import { initialData, initialCoverLetterData } from '../data/initialData';

export interface AppStateContextValue {
  data: CVData;
  setData: React.Dispatch<React.SetStateAction<CVData>>;
  settings: CVSettings;
  setSettings: React.Dispatch<React.SetStateAction<CVSettings>>;
  clSettings: CLSettings;
  setClSettings: React.Dispatch<React.SetStateAction<CLSettings>>;
  profileImage: string | null;
  setProfileImage: React.Dispatch<React.SetStateAction<string | null>>;
  visibleSections: VisibleSections;
  setVisibleSections: React.Dispatch<React.SetStateAction<VisibleSections>>;
  sidebarOrder: string[];
  setSidebarOrder: React.Dispatch<React.SetStateAction<string[]>>;
  documentType: DocumentType;
  setDocumentType: React.Dispatch<React.SetStateAction<DocumentType>>;
  coverLetterData: CoverLetterData;
  setCoverLetterData: React.Dispatch<React.SetStateAction<CoverLetterData>>;
  documentTitle: string;
  setDocumentTitle: React.Dispatch<React.SetStateAction<string>>;
  resetToInitial: () => void;
  addCustomSection: (sectionTemplate: CustomSectionTemplate) => string;
  removeCustomSection: (sectionId: string) => void;
  updateCustomSection: (sectionId: string, updates: Partial<CustomSection>) => void;
  migrateData: (data: CVData) => CVData;
  migrateVisibleSections: (vs: VisibleSections) => VisibleSections;
  migrateSidebarOrder: (order: string[]) => string[];
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const LS_KEY = 'career-forge-state';

export const defaultSettings: CVSettings = {
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

export const defaultClSettings: CLSettings = {
  nameFont: 'Open Sans',
  nameFontSize: 28,
  senderFont: 'Open Sans',
  senderFontSize: 11,
  subjectFont: 'Open Sans',
  subjectFontSize: 13,
  bodyFont: 'Open Sans',
  bodyFontSize: 12,
};

const defaultVisibleSections: VisibleSections = {
  summary: true,
  coreCompetencies: true,
  languages: true,
  skills: true,
  achievements: true,
  experience: true,
  education: true,
};

const defaultSidebarOrder: string[] = [
  'summary',
  'skills',
  'languages',
  'coreCompetencies',
  'achievements',
];

interface SavedState {
  data?: CVData;
  settings?: Partial<CVSettings>;
  clSettings?: Partial<CLSettings>;
  profileImage?: string | null;
  visibleSections?: VisibleSections;
  sidebarOrder?: string[];
  documentType?: DocumentType;
  coverLetterData?: CoverLetterData;
  documentTitle?: string;
}

const loadFromLocalStorage = (): SavedState | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

const saved: SavedState | null = loadFromLocalStorage();

function migrateData(data: CVData): CVData {
  if (!data) return data;
  const migrated = { ...data } as Record<string, unknown>;

  // Strengths → coreCompetencies: map title→name, drop description
  if (migrated.strengths && !migrated.coreCompetencies) {
    migrated.coreCompetencies = (migrated.strengths as Array<Record<string, unknown>>).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: (s.title as string) || (s.name as string) || '',
    }));
    delete migrated.strengths;
  }

  // Courses → merge into education with type:'course'
  if (migrated.courses) {
    const courseItems = (migrated.courses as Array<Record<string, unknown>>).map((c: Record<string, unknown>) => ({
      id: c.id,
      type: 'course',
      title: (c.title as string) || '',
      institution: (c.description as string) || '',
      period: (c.period as string) || '',
      description: '',
    }));
    migrated.education = [
      ...((migrated.education as Array<Record<string, unknown>>) || []).map((e: Record<string, unknown>) => ({ type: 'degree', ...e })),
      ...courseItems,
    ];
    delete migrated.courses;
  } else if (migrated.education) {
    // Ensure existing education items have a type field
    migrated.education = (migrated.education as Array<Record<string, unknown>>).map((e: Record<string, unknown>) => ({ type: 'degree', ...e }));
  }

  // Ensure customSections exists
  if (!migrated.customSections) {
    migrated.customSections = [];
  }

  // Ensure contact has linkedin/github fields
  if (migrated.contact && typeof migrated.contact === 'object' && !('linkedin' in (migrated.contact as Record<string, unknown>))) {
    migrated.contact = { ...(migrated.contact as Record<string, unknown>), linkedin: '', github: '' };
  }

  return migrated as unknown as CVData;
}

// Migrate visibleSections: rename legacy keys
function migrateVisibleSections(vs: VisibleSections): VisibleSections {
  if (!vs) return vs;
  const migrated = { ...vs } as Record<string, boolean>;
  if ('strengths' in migrated) {
    migrated.coreCompetencies = migrated.strengths;
    delete (migrated as Record<string, unknown>).strengths;
  }
  if ('courses' in migrated) {
    delete (migrated as Record<string, unknown>).courses;
  }
  return migrated as VisibleSections;
}

function migrateSidebarOrder(order: string[]): string[] {
  if (!order) return order;
  return order
    .map(name => (name === 'strengths' ? 'coreCompetencies' : name))
    .filter(name => name !== 'courses');
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CVData>(() => migrateData(saved?.data ?? initialData));
  const [settings, setSettings] = useState<CVSettings>({ ...defaultSettings, ...(saved?.settings ?? {}) });
  const [clSettings, setClSettings] = useState<CLSettings>({ ...defaultClSettings, ...(saved?.clSettings ?? {}) });
  const [profileImage, setProfileImage] = useState<string | null>(saved?.profileImage ?? null);
  const [visibleSections, setVisibleSections] = useState<VisibleSections>(() => migrateVisibleSections(saved?.visibleSections ?? defaultVisibleSections));
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(() => migrateSidebarOrder(saved?.sidebarOrder ?? defaultSidebarOrder));
  const [documentType, setDocumentType] = useState<DocumentType>(saved?.documentType ?? 'resume');
  const [coverLetterData, setCoverLetterData] = useState<CoverLetterData>(saved?.coverLetterData ?? initialCoverLetterData);
  const [documentTitle, setDocumentTitle] = useState<string>(saved?.documentTitle ?? '');

  // Debounced localStorage sync
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ data, settings, clSettings, profileImage, visibleSections, sidebarOrder, documentType, coverLetterData, documentTitle }));
      } catch (e) { /* storage full or private mode */ }
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
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
  const addCustomSection = useCallback((sectionTemplate: CustomSectionTemplate) => {
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

  const removeCustomSection = useCallback((sectionId: string) => {
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

  const updateCustomSection = useCallback((sectionId: string, updates: Partial<CustomSection>) => {
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

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
