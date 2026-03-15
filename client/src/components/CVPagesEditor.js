import React, { useRef, useEffect, useCallback } from 'react';
import { usePages, PAGE_CONFIG } from '../contexts/PageContext';
import Sidebar from './Sidebar/Sidebar';
import MainContent from './MainContent/MainContent';
import PageControls from './PageControls';
import { useAppState } from '../contexts/AppStateContext';
import './CVPagesEditor.css';


const CVPagesEditor = ({ profileImage, onImageUpload, onImageRemove }) => {
  const { zoom, setZoom, pages: contextPages, setPages, viewMode, registerPageRef, setMinPages, removePage, userForcedMaxRef } = usePages();
  const { settings } = useAppState();
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const pageCount = contextPages.length;

  const applyPageBreaks = useCallback(() => {
    if (!contentRef.current) return;

    const pageHeight = PAGE_CONFIG.height;
    const marginTop = PAGE_CONFIG.marginTop;
    const marginBottom = PAGE_CONFIG.marginBottom;

    const breakableElements = contentRef.current.querySelectorAll(
      '.section, .experience-item, .sidebar-section, .education-item, h2, h3'
    );

    breakableElements.forEach(el => {
      el.style.paddingTop = '';
    });

    breakableElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const relativeTop = rect.top - contentRect.top;
      
      const startPage = Math.floor(relativeTop / pageHeight);
      const pageEndY = (startPage + 1) * pageHeight - marginBottom;
      
      const elementBottom = relativeTop + rect.height;
      if (elementBottom > pageEndY && relativeTop < pageEndY) {
        const pushPadding = pageEndY - relativeTop + marginTop;
        if (pushPadding < pageHeight / 2) { // Only push if less than half a page
          el.style.paddingTop = `${pushPadding}px`;
        }
      }
    });
  }, []);

  const calculatePages = useCallback(() => {
    if (!contentRef.current) return;

    const rawHeight = contentRef.current.scrollHeight;
    // The measurer is position:absolute with a fixed width inside the scaled
    // canvas, so its scrollHeight already reflects the true unscaled layout
    // height — do NOT divide by zoom.
    const pageHeight = PAGE_CONFIG.height;

    const measured = Math.max(1, Math.ceil((rawHeight - 0.5) / pageHeight));

    console.debug('[CVPagesEditor] calculatePages', { rawHeight, pageHeight, measured });

    setMinPages(measured);

    // Only ever grow pages — but respect explicit user deletions.
    // If the user deleted a page, don't auto-restore it unless content truly
    // overflows beyond what fits in the user's chosen count.
    setPages(prev => {
      if (prev.length >= measured) return prev;
      // User explicitly set a smaller page count — hold it until content overflows
      if (userForcedMaxRef.current !== null) {
        if (measured <= userForcedMaxRef.current + 1) return prev; // hold user's count until content truly overflows beyond it
        // Content genuinely overflowed the user's count — release the lock
        userForcedMaxRef.current = null;
      }
      return Array.from({ length: measured }, (_, i) => ({ id: `page-${Date.now()}-${i + 1}`, pageNumber: i + 1 }));
    });

    applyPageBreaks();
  }, [setPages, applyPageBreaks, setMinPages, userForcedMaxRef]);

  useEffect(() => {
    calculatePages();

    let resizeTimeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculatePages, 100);
    });

    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    return () => {
      clearTimeout(resizeTimeout);
      observer.disconnect();
    };
  }, [calculatePages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      const step = 0.1;
      if (delta < 0) {
        setZoom(prev => Math.min(prev + step, 2));
      } else if (delta > 0) {
        setZoom(prev => Math.max(prev - step, 0.5));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel, { passive: false });
  }, [setZoom]);

  const pages = contextPages.map((_, i) => i);

  const totalContentHeight = pageCount * PAGE_CONFIG.height;


  const GAP = 40;
  const canvasNaturalHeight = pageCount * PAGE_CONFIG.height + Math.max(0, pageCount - 1) * GAP;
  const zoomPaddingBottom = Math.ceil(canvasNaturalHeight * Math.max(0, zoom - 1)) + 100;

  return (
    <div
      className={`cv-pages-editor view-${viewMode}`}
      ref={containerRef}
      style={{ paddingBottom: zoomPaddingBottom }}
    >
      <div 
        className="cv-pages-editor-canvas"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
      >
        {/* Hidden content measurer */}
        <div 
          ref={contentRef}
          className="cv-content-measurer"
          style={{
            position: 'absolute',
            visibility: 'hidden',
            width: PAGE_CONFIG.width,
            pointerEvents: 'none',
          }}
        >
          <div className="cv-page-layout">
            <div 
              className="cv-page-sidebar"
            >
              <Sidebar
                profileImage={profileImage}
                onImageUpload={onImageUpload}
                onImageRemove={onImageRemove}
              />
            </div>
            <div 
              className="cv-page-main"
              style={{
                padding: `${PAGE_CONFIG.marginTop}px ${PAGE_CONFIG.marginRight}px ${PAGE_CONFIG.marginBottom}px 30px`,
              }}
            >
              <MainContent showHeader={true} pageIndex={0} />
            </div>
          </div>
        </div>

        {/* Visible pages - each clips a portion of the flowing content */}
        {pages.map((pageIndex) => (
          <div key={pageIndex} className="cv-page-wrapper">
            {pageCount > 1 && pageIndex !== 0 && (
              <button
                className="cv-page-remove-btn"
                onClick={() => {
                  userForcedMaxRef.current = pageCount - 1;
                  removePage(pageIndex);
                }}
                title="Remove page"
              >
                <i className="fas fa-times" />
              </button>
            )}
            <div 
              ref={(el) => registerPageRef(pageIndex, el)}
              className={`cv-page ${pageIndex === 0 ? 'cv-page-active' : ''}`}
              data-page-index={pageIndex}
              style={{
                width: PAGE_CONFIG.width,
                height: PAGE_CONFIG.height,
                '--sidebar-color-1': settings?.sidebarColor1 || '#312e81',
                '--sidebar-color-2': settings?.sidebarColor2 || '#4f46e5',
              }}
            >
            {/* Page number badge */}
            <div className="cv-page-number-badge">
              {pageIndex + 1} / {pageCount}
            </div>

            {/* Clipped viewport - clips content to this page's portion */}
            <div 
              className="cv-page-viewport"
              style={{
                overflow: 'hidden',
                height: PAGE_CONFIG.height,
                width: PAGE_CONFIG.width,
              }}
            >
              {/* Content offset - shifts content up so this page's portion is visible */}
              <div 
                className="cv-page-content-offset"
                style={{
                  transform: `translateY(-${pageIndex * PAGE_CONFIG.height}px)`,
                }}
              >
                {/* Full height layout so sidebar gradient spans all pages */}
                <div className="cv-page-layout" style={{ height: totalContentHeight }}>
                  <div 
                    className="cv-page-sidebar"
                    style={{ height: totalContentHeight }}
                  >
                    <Sidebar
                      profileImage={profileImage}
                      onImageUpload={onImageUpload}
                      onImageRemove={onImageRemove}
                    />
                  </div>
                  <div 
                    className="cv-page-main"
                    style={{
                      padding: `${PAGE_CONFIG.marginTop}px ${PAGE_CONFIG.marginRight}px ${PAGE_CONFIG.marginBottom}px 30px`,
                      height: totalContentHeight,
                    }}
                  >
                    <MainContent showHeader={true} pageIndex={0} />
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        ))}
      </div>

      {/* Zoom Controls */}
      <PageControls />
    </div>
  );
};

export default CVPagesEditor;
