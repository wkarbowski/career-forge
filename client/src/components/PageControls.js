import React from 'react';
import { usePages } from '../contexts/PageContext';
import { useTranslation } from '../i18n';

const PageControls = () => {
  const { 
    currentPageIndex,
    totalPages,
    addPage,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    viewMode,
    setViewMode,
  } = usePages();

  const { t } = useTranslation();

  const toggleViewMode = () => {
    setViewMode(viewMode === 'pages' ? 'continuous' : 'pages');
  };

  return (
    <div className="page-controls">
      <div className="page-controls-section page-nav">
        <span className="page-total">{currentPageIndex + 1} / {totalPages}</span>
      </div>

      <div className="page-controls-section page-actions">
        <button 
          className="page-control-btn"
          onClick={() => addPage(currentPageIndex)}
          title={t('pages.add') || 'Add Page'}
        >
          <i className="fas fa-plus"></i>
          <span className="btn-label">{t('pages.addPage') || 'Add Page'}</span>
        </button>
        
        <button 
          className="page-control-btn"
          onClick={toggleViewMode}
          title={viewMode === 'pages' ? (t('pages.continuousView') || 'Continuous View') : (t('pages.pagesView') || 'Pages View')}
        >
          <i className={`fas ${viewMode === 'pages' ? 'fa-scroll' : 'fa-file'}`}></i>
          <span className="btn-label">{viewMode === 'pages' ? (t('pages.continuousView') || 'Continuous') : (t('pages.pagesView') || 'Pages')}</span>
        </button>
        

      </div>

      <div className="page-controls-section zoom-controls">
        <button 
          className="page-control-btn"
          onClick={zoomOut}
          disabled={zoom <= 0.5}
          title={t('pages.zoomOut') || 'Zoom Out'}
        >
          <i className="fas fa-search-minus"></i>
        </button>
        
        <button 
          className="zoom-level"
          onClick={resetZoom}
          title={t('pages.resetZoom') || 'Reset Zoom'}
        >
          {Math.round(zoom * 100)}%
        </button>
        
        <button 
          className="page-control-btn"
          onClick={zoomIn}
          disabled={zoom >= 2}
          title={t('pages.zoomIn') || 'Zoom In'}
        >
          <i className="fas fa-search-plus"></i>
        </button>
      </div>

    </div>
  );
};

export default PageControls;
