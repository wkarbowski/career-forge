import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const PageContext = createContext();

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

const createDefaultPage = (pageNumber = 1) => ({
  id: `page-${Date.now()}-${pageNumber}`,
  pageNumber,
  sections: {
    sidebar: null,  // null = continue from previous, or specific section IDs
    main: null,     // null = continue from previous, or specific section IDs
  },
});

export function PageProvider({ children }) {
  const [pages, setPages] = useState([createDefaultPage(1)]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState('pages'); // 'pages' or 'continuous'
  const [minPages, setMinPages] = useState(1);
  const pageRefs = useRef({});
  // When a user explicitly deletes a page, store the chosen count here so
  // calculatePages in CVPagesEditor won't immediately re-add the page.
  // Also set when restoring pages from the server so the value survives refreshes.
  const userForcedMaxRef = useRef(null);

  const setUserForcedMax = useCallback((count) => {
    userForcedMaxRef.current = count;
  }, []);

  const addPage = useCallback((afterIndex = null) => {
    setPages(prev => {
      const insertIndex = afterIndex !== null ? afterIndex + 1 : prev.length;
      const newPage = createDefaultPage(insertIndex + 1);
      const newPages = [...prev];
      newPages.splice(insertIndex, 0, newPage);
      return newPages.map((page, idx) => ({ ...page, pageNumber: idx + 1 }));
    });
  }, []);

  const removePage = useCallback((pageIndex) => {
    setPages(prev => {
      if (prev.length <= 1) return prev; // Keep at least one page
      const newPages = prev.filter((_, idx) => idx !== pageIndex);
      return newPages.map((page, idx) => ({ ...page, pageNumber: idx + 1 }));
    });
    setCurrentPageIndex(prev => Math.min(prev, pages.length - 2));
  }, [pages.length]);

  const goToPage = useCallback((pageIndex) => {
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

  const registerPageRef = useCallback((pageIndex, ref) => {
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

export function usePages() {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePages must be used within a PageProvider');
  }
  return context;
}

export default PageContext;
