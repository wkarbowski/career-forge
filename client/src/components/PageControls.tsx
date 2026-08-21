import { usePages } from '../contexts/PageContext';
import { useTranslation } from '../i18n';

interface PageControlsProps {
  onRemovePage?: (pageIndex: number) => void;
}

const PageControls = ({ onRemovePage }: PageControlsProps = {}) => {
  const {
    currentPageIndex,
    totalPages,
    addPage,
    removePage,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    viewMode,
    setViewMode,
    userForcedMaxRef,
  } = usePages();

  const { t } = useTranslation();

  const toggleViewMode = () => {
    setViewMode(viewMode === 'pages' ? 'continuous' : 'pages');
  };

  const addPageAtEnd = () => {
    addPage(totalPages - 1);
  };

  const removeLastPage = () => {
    if (totalPages <= 1) return;
    const pageIndex = totalPages - 1;
    userForcedMaxRef.current = totalPages - 1;
    if (onRemovePage) {
      onRemovePage(pageIndex);
      return;
    }
    removePage(pageIndex);
  };

  return (
    <div className="page-controls">
      <div className="page-controls-section page-nav">
        <span className="page-total">{currentPageIndex + 1} / {totalPages}</span>
      </div>

      <div className="page-controls-section page-actions">
        <button
          className="page-control-btn"
          onClick={addPageAtEnd}
          title={t('pages.add') || 'Add Page'}
        >
          <i className="fas fa-plus"></i>
          <span className="btn-label">{t('pages.addPage') || 'Add Page'}</span>
        </button>

        <button
          className="page-control-btn page-control-btn-danger"
          onClick={removeLastPage}
          disabled={totalPages <= 1}
          title={t('pages.remove') || 'Remove Page'}
        >
          <i className="fas fa-trash"></i>
          <span className="btn-label">{t('pages.removePage') || 'Remove'}</span>
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
