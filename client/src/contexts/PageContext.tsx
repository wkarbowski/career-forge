import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Page, PageConfig } from '../types';

type ViewMode = 'pages' | 'continuous';

export interface PageContextValue {
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  currentPageIndex: number;
  setCurrentPageIndex: React.Dispatch<React.SetStateAction<number>>;
  currentPage: Page;
  totalPages: number;
  addPage: (afterIndex?: number | null) => void;
  removePage: (pageIndex: number) => void;
  goToPage: (pageIndex: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  registerPageRef: (pageIndex: number, ref: HTMLElement | null) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  minPages: number;
  setMinPages: React.Dispatch<React.SetStateAction<number>>;
  resetPages: () => void;
  userForcedMaxRef: React.MutableRefObject<number | null>;
  setUserForcedMax: (count: number) => void;
  PAGE_CONFIG: PageConfig;
}

const PageContext = createContext<PageContextValue | null>(null);

export const PAGE_CONFIG = {
  width: 794,
  height: 1123,
  marginTop: 40,    // Reduced margins to match print output
  marginBottom: 40,
  marginLeft: 0,    // Sidebar extends to edge
  marginRight: 40,
  get contentWidth() {
    return this.width - this.marginLeft - this.marginRight;
  },
  get contentHeight() {
    return this.height - this.marginTop - this.marginBottom;
  },
};

const createDefaultPage = (pageNumber: number = 1): Page => ({
  id: `page-${Date.now()}-${pageNumber}`,
  pageNumber,
  sections: {
    sidebar: null,
    main: null,
  },
});

interface PageProviderProps {
  children: ReactNode;
}

export function PageProvider({ children }: PageProviderProps) {
  const [pages, setPages] = useState<Page[]>([createDefaultPage(1)]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('pages');
  const [minPages, setMinPages] = useState<number>(1);
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});
  const userForcedMaxRef = useRef<number | null>(null);

  const setUserForcedMax = useCallback((count: number): void => {
    userForcedMaxRef.current = count;
  }, []);

  const addPage = useCallback((afterIndex: number | null = null): void => {
    setPages(prev => {
      const insertIndex = afterIndex !== null ? afterIndex + 1 : prev.length;
      const newPage = createDefaultPage(insertIndex + 1);
      const newPages = [...prev];
      newPages.splice(insertIndex, 0, newPage);
      return newPages.map((page, idx) => ({ ...page, pageNumber: idx + 1 }));
    });
  }, []);

  const removePage = useCallback((pageIndex: number): void => {
    setPages(prev => {
      if (prev.length <= 1) return prev; // Keep at least one page
      const newPages = prev.filter((_, idx) => idx !== pageIndex);
      return newPages.map((page, idx) => ({ ...page, pageNumber: idx + 1 }));
    });
    setCurrentPageIndex(prev => Math.min(prev, pages.length - 2));
  }, [pages.length]);

  const goToPage = useCallback((pageIndex: number): void => {
    if (pageIndex >= 0 && pageIndex < pages.length) {
      setCurrentPageIndex(pageIndex);
      const pageEl = pageRefs.current[pageIndex];
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [pages.length]);

  const nextPage = useCallback(() => {
    goToPage(currentPageIndex + 1);
  }, [currentPageIndex, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPageIndex - 1);
  }, [currentPageIndex, goToPage]);

  const registerPageRef = useCallback((pageIndex: number, ref: HTMLElement | null): void => {
    pageRefs.current[pageIndex] = ref;
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const resetPages = useCallback(() => {
    setPages([createDefaultPage(1)]);
    setCurrentPageIndex(0);
    userForcedMaxRef.current = null;
  }, []);

  return (
    <PageContext.Provider value={{
      pages,
      setPages,
      currentPageIndex,
      setCurrentPageIndex,
      currentPage: pages[currentPageIndex],
      totalPages: pages.length,
      addPage,
      removePage,
      goToPage,
      nextPage,
      prevPage,
      registerPageRef,
      zoom,
      setZoom,
      zoomIn,
      zoomOut,
      resetZoom,
      viewMode,
      setViewMode,
      minPages,
      setMinPages,
      resetPages,
      userForcedMaxRef,
      setUserForcedMax,
      PAGE_CONFIG,
    }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePages(): PageContextValue {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePages must be used within a PageProvider');
  }
  return context;
}

export default PageContext;
