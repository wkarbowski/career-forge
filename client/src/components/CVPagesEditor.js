import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePages, PAGE_CONFIG } from '../contexts/PageContext';
import Sidebar from './Sidebar/Sidebar';
import MainContent from './MainContent/MainContent';
import PageControls from './PageControls';
import { useAppState } from '../contexts/AppStateContext';
import { useTranslation } from '../i18n';
import './CVPagesEditor.css';


const CVPagesEditor = ({ profileImage, onImageUpload, onImageRemove }) => {
  const { zoom, setZoom, pages: contextPages, setPages, viewMode, registerPageRef, setMinPages, removePage, userForcedMaxRef } = usePages();
  const { settings } = useAppState();
  const { t } = useTranslation();
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  // Defensive: ensure profileImage is string or null
  const safeProfileImage = typeof profileImage === 'string' ? profileImage : null;
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
  }, [calculatePages, settings]);

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

  // Mobile warning
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setShowMobileWarning(mq.matches);
    const handler = (e) => setShowMobileWarning(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const pages = contextPages.map((_, i) => i);

  const totalContentHeight = pageCount * PAGE_CONFIG.height;

  const layout = settings?.layout || 'sidebar-left';
  const layoutClass = `layout-${layout}`;

  const GAP = 40;
  const canvasNaturalHeight = pageCount * PAGE_CONFIG.height + Math.max(0, pageCount - 1) * GAP;
  const zoomPaddingBottom = Math.ceil(canvasNaturalHeight * Math.max(0, zoom - 1)) + 100;

  const cssVarsStyle = {
    '--name-font': `'${settings?.nameFont || settings?.titleFont || 'Rubik'}', sans-serif`,
    '--name-font-size': `${settings?.nameFontSize ?? 36}px`,
    '--heading-font': `'${settings?.headingFont || settings?.titleFont || 'Rubik'}', sans-serif`,
    '--heading-font-size': `${settings?.headingFontSize ?? 14}px`,
    '--subtitle-font': `'${settings?.subtitleFont || 'Rubik'}', sans-serif`,
    '--subtitle-font-size': `${settings?.subtitleFontSize ?? 14}px`,
    '--body-font': `'${settings?.bodyFont || 'Inter'}', sans-serif`,
    '--body-font-size': `${settings?.bodyFontSize ?? 13}px`,
    '--sidebar-color-1': settings?.sidebarColor1 || '#312e81',
    '--sidebar-color-2': settings?.sidebarColor2 || '#4f46e5',
    '--accent-color': settings?.accentColor || '#6366f1',
  };

  const renderLayout = (heightStyle) => {
    if (layout === 'top-header') {
      return (
        <div className="cv-page-layout" style={heightStyle ? { height: heightStyle } : undefined}>
          <div className="cv-page-top-header-band">
            <MainContent showHeader={true} headerOnly={true} pageIndex={0} />
          </div>
          <div className="cv-page-body-columns">
            <div
              className="cv-page-sidebar"
              style={heightStyle ? { height: heightStyle } : undefined}
            >
              <Sidebar
                profileImage={safeProfileImage}
                onImageUpload={onImageUpload}
                onImageRemove={onImageRemove}
              />
            </div>
            <div
              className="cv-page-main"
              style={{
                padding: `20px ${PAGE_CONFIG.marginRight}px ${PAGE_CONFIG.marginBottom}px 30px`,
                ...(heightStyle ? { height: heightStyle } : {}),
              }}
            >
              <MainContent showHeader={false} pageIndex={0} />
            </div>
          </div>
        </div>
      );
    }

    if (layout === 'minimal') {
      return (
        <div className="cv-page-layout" style={heightStyle ? { height: heightStyle } : undefined}>
          <div className="cv-page-minimal-header">
            <MainContent showHeader={true} headerOnly={true} pageIndex={0} />
          </div>
          <div className="cv-page-body-columns">
            <div
              className="cv-page-sidebar"
              style={heightStyle ? { height: heightStyle } : undefined}
            >
              <Sidebar
                profileImage={safeProfileImage}
                onImageUpload={onImageUpload}
                onImageRemove={onImageRemove}
              />
            </div>
            <div
              className="cv-page-main"
              style={{
                padding: `20px ${PAGE_CONFIG.marginRight}px ${PAGE_CONFIG.marginBottom}px 30px`,
                ...(heightStyle ? { height: heightStyle } : {}),
              }}
            >
              <MainContent showHeader={false} pageIndex={0} />
            </div>
          </div>
        </div>
      );
    }

    // ATS-optimized single-column layout — no sidebar, everything stacked
    if (layout === 'ats-single-column') {
      return (
        <div className="cv-page-layout cv-page-ats-layout" style={heightStyle ? { height: heightStyle } : undefined}>
          <div className="cv-page-ats-header">
            <MainContent showHeader={true} headerOnly={true} pageIndex={0} />
          </div>
          <div className="cv-page-ats-body" style={{ padding: `20px ${PAGE_CONFIG.marginRight}px ${PAGE_CONFIG.marginBottom}px ${PAGE_CONFIG.marginLeft || 40}px` }}>
            <Sidebar
              profileImage={safeProfileImage}
              onImageUpload={onImageUpload}
              onImageRemove={onImageRemove}
            />
            <MainContent showHeader={false} pageIndex={0} />
          </div>
        </div>
      );
    }

    // sidebar-left (default) and sidebar-right share the same structure
    return (
      <div className="cv-page-layout" style={heightStyle ? { height: heightStyle } : undefined}>
        <div
          className="cv-page-sidebar"
          style={heightStyle ? { height: heightStyle } : undefined}
        >
          <Sidebar
            profileImage={safeProfileImage}
            onImageUpload={onImageUpload}
            onImageRemove={onImageRemove}
          />
        </div>
        <div
          className="cv-page-main"
          style={{
            padding: `${PAGE_CONFIG.marginTop}px ${PAGE_CONFIG.marginRight}px ${PAGE_CONFIG.marginBottom}px 30px`,
            ...(heightStyle ? { height: heightStyle } : {}),
          }}
        >
          <MainContent showHeader={true} pageIndex={0} />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`cv-pages-editor view-${viewMode}`}
      ref={containerRef}
      style={{ paddingBottom: zoomPaddingBottom }}
    >
      {showMobileWarning && (
        <div className="mobile-warning-overlay">
          <div className="mobile-warning-content">
            <i className="fas fa-desktop"></i>
            <p>{t('mobile.warning')}</p>
            <button onClick={() => setShowMobileWarning(false)} className="mobile-warning-dismiss">
              {t('mobile.continue')}
            </button>
          </div>
        </div>
      )}
      <div 
        className="cv-pages-editor-canvas"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
      >
        {/* Hidden content measurer */}
        <div 
          ref={contentRef}
          className={`cv-content-measurer ${layoutClass}`}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            width: PAGE_CONFIG.width,
            pointerEvents: 'none',
            ...cssVarsStyle,
          }}
        >
          {renderLayout(null)}
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
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
            <div 
              ref={(el) => registerPageRef(pageIndex, el)}
              className={`cv-page ${layoutClass} ${pageIndex === 0 ? 'cv-page-active' : ''}`}
              data-page-index={pageIndex}
              style={{
                width: PAGE_CONFIG.width,
                height: PAGE_CONFIG.height,
                ...cssVarsStyle,
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
                {renderLayout(totalContentHeight)}
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
