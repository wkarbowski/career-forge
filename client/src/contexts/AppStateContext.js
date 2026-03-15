import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { initialData, initialCoverLetterData } from '../data/initialData';

const AppStateContext = createContext();

const LS_KEY = 'career-forge-state';

const defaultSettings = {
  sidebarColor1: '#312e81',
  sidebarColor2: '#4f46e5',
  accentColor: '#6366f1',
};

const defaultVisibleSections = {
  summary: true,
  strengths: true,
  languages: true,
  skills: true,
  achievements: true,
  experience: true,
  education: true,
  courses: true,
};

const defaultSidebarOrder = [
  'summary',
  'skills',
  'languages',
  'courses',
  'strengths',
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

export function AppStateProvider({ children }) {
  const [data, setData] = useState(saved?.data ?? initialData);
  const [settings, setSettings] = useState(saved?.settings ?? defaultSettings);
  const [profileImage, setProfileImage] = useState(saved?.profileImage ?? null);
  const [visibleSections, setVisibleSections] = useState(saved?.visibleSections ?? defaultVisibleSections);
  const [sidebarOrder, setSidebarOrder] = useState(saved?.sidebarOrder ?? defaultSidebarOrder);
  const [documentType, setDocumentType] = useState(saved?.documentType ?? 'resume');
  const [coverLetterData, setCoverLetterData] = useState(saved?.coverLetterData ?? initialCoverLetterData);
  const [documentTitle, setDocumentTitle] = useState(saved?.documentTitle ?? '');

  // Debounced localStorage sync
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ data, settings, profileImage, visibleSections, sidebarOrder, documentType, coverLetterData, documentTitle }));
      } catch (e) { /* storage full or private mode */ }
    }, 1000);
    return () => clearTimeout(saveTimerRef.current);
  }, [data, settings, profileImage, visibleSections, sidebarOrder, documentType, coverLetterData, documentTitle]);

  const resetToInitial = useCallback(() => {
    setData(initialData);
    setSettings(defaultSettings);
    setProfileImage(null);
    setVisibleSections(defaultVisibleSections);
    setSidebarOrder(defaultSidebarOrder);
    setDocumentType('resume');
    setCoverLetterData(initialCoverLetterData);
    setDocumentTitle('');
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }, []);

  return (
    <AppStateContext.Provider value={{
      data, setData,
      settings, setSettings,
      profileImage, setProfileImage,
      visibleSections, setVisibleSections,
      sidebarOrder, setSidebarOrder,
      documentType, setDocumentType,
      coverLetterData, setCoverLetterData,
      documentTitle, setDocumentTitle,
      resetToInitial,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppStateContext);
}
