import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppState } from '../contexts/AppStateContext';
import { useTranslation } from '../i18n';
import { documentApi } from '../services/api';
import './DocumentDashboard.css';

const DocumentDashboard = ({ onBack, onEditDocument, onPrintDocument, onSavePdfDocument }) => {
  const { documentList, refreshDocumentList, deleteDocument, renameDocument, currentDocumentId } = useAuth();
  const { setDocumentTitle } = useAppState();
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState('all'); // all | resume | cover-letter
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCvs, setSelectedCvs] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const decodeEntities = (str) => {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  };

  // Heuristic to determine document type from stored data/title
  const detectDocumentType = (cv) => {
    try {
      const data = cv.data || {};
      if (data.layout && String(data.layout).toLowerCase().includes('cover')) return 'cover-letter';
      if (data.settings && data.settings.headerStyle) return 'cover-letter';
      if (cv.title && /cover/i.test(cv.title)) return 'cover-letter';
      return 'resume';
    } catch (err) {
      return 'resume';
    }
  };

  const processedCvs = useMemo(() => {
    let filtered = [...documentList];
    if (filterType && filterType !== 'all') {
      filtered = filtered.filter(cv => detectDocumentType(cv) === filterType);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(cv => 
        cv.title.toLowerCase().includes(term) ||
        decodeEntities(cv.data?.data?.personal?.name || '').toLowerCase().includes(term) ||
        decodeEntities(cv.data?.data?.personal?.position || '').toLowerCase().includes(term)
      );
    }
    
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'name') {
        aVal = decodeEntities(a.data?.data?.personal?.name || '');
        bVal = decodeEntities(b.data?.data?.personal?.name || '');
      } else if (sortConfig.key === 'position') {
        aVal = decodeEntities(a.data?.data?.personal?.position || '');
        bVal = decodeEntities(b.data?.data?.personal?.position || '');
      }
      
      if (sortConfig.key === 'created_at' || sortConfig.key === 'updated_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [documentList, searchTerm, sortConfig, filterType]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedCvs(new Set(processedCvs.map(cv => cv.id)));
    } else {
      setSelectedCvs(new Set());
    }
  };

  const handleSelectOne = (cvId) => {
    setSelectedCvs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cvId)) {
        newSet.delete(cvId);
      } else {
        newSet.add(cvId);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedCvs.size === 0) return;
    
    const confirmMsg = t('dashboard.confirmDeleteMultiple').replace('{count}', selectedCvs.size);
    if (!window.confirm(confirmMsg)) return;
    
    setIsDeleting(true);
    try {
      for (const cvId of selectedCvs) {
        await deleteDocument(cvId);
      }
      setSelectedCvs(new Set());
    } catch (err) {
      console.error('Failed to delete CVs:', err);
    }
    setIsDeleting(false);
  };

  const handleDeleteOne = async (cvId) => {
    if (!window.confirm(t('userMenu.confirmDelete'))) return;
    await deleteDocument(cvId);
  };

  const handleDuplicate = async (cv) => {
    try {
      const fullDoc = await documentApi.get(cv.id);
      const newTitle = `${cv.title} (${t('dashboard.copy')})`;
      const result = await documentApi.create(newTitle, fullDoc.data);
      if (result) {
        await refreshDocumentList();
      }
    } catch (err) {
      console.error('Failed to duplicate document:', err);
    }
  };

  const handleRename = (cv) => {
    setEditingId(cv.id);
    setEditingTitle(cv.title);
  };

  const handleRenameSubmit = async (cvId) => {
      if (editingTitle.trim() && editingTitle.trim() !== documentList.find(c => c.id === cvId)?.title) {
      try {
        await renameDocument(cvId, editingTitle.trim());
        if (cvId === currentDocumentId) {
          setDocumentTitle(editingTitle.trim());
        }
      } catch (err) {
        console.error('Failed to rename document:', err);
      }
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleRenameKeyDown = (e, cvId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit(cvId);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return t('dashboard.justNow');
    if (diffMins < 60) return t('dashboard.minsAgo').replace('{n}', diffMins);
    if (diffHours < 24) return t('dashboard.hoursAgo').replace('{n}', diffHours);
    if (diffDays < 7) return t('dashboard.daysAgo').replace('{n}', diffDays);
    return formatDate(dateStr);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <i className="fas fa-sort sort-icon inactive"></i>;
    }
    return sortConfig.direction === 'asc' 
      ? <i className="fas fa-sort-up sort-icon"></i>
      : <i className="fas fa-sort-down sort-icon"></i>;
  };

  return (
    <div className="cv-dashboard">
      <div className="dashboard-header">
        <button className="back-btn" onClick={onBack}>
          <i className="fas fa-arrow-left"></i>
          {t('dashboard.backToEditor')}
        </button>
        <div className="dashboard-title-block">
          <h1>
            {filterType === 'all' && t('nav.dashboard')}
            {filterType === 'resume' && t('templates.types.resume')}
            {filterType === 'cover-letter' && t('templates.types.cover-letter')}
          </h1>

          <div className="document-filters">
            <button className={`filter-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>{t('templates.types.all')}</button>
            <button className={`filter-btn ${filterType === 'resume' ? 'active' : ''}`} onClick={() => setFilterType('resume')}>{t('templates.types.resume')}</button>
            <button className={`filter-btn ${filterType === 'cover-letter' ? 'active' : ''}`} onClick={() => setFilterType('cover-letter')}>{t('templates.types.cover-letter')}</button>
          </div>
        </div>
      </div>

      <div className="dashboard-toolbar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder={t('dashboard.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          <span className="cv-count">
            {t('dashboard.totalCvs').replace('{count}', documentList.length)}
          </span>

          <div className="view-toggle" role="radiogroup" aria-label={t('dashboard.viewMode') || 'View mode'}>
            <button
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              title={t('dashboard.gridView') || 'Grid view'}
            >
              <i className="fas fa-th-large"></i>
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              title={t('dashboard.tableView') || 'Table view'}
            >
              <i className="fas fa-list"></i>
            </button>
          </div>

          {selectedCvs.size > 0 && (
            <button 
              className="delete-selected-btn"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
            >
              <i className="fas fa-trash"></i>
              {t('dashboard.deleteSelected')} ({selectedCvs.size})
            </button>
          )}
        </div>
      </div>

      {/* Card Grid View */}
      {viewMode === 'grid' && (
        <div className="dashboard-grid">
          {processedCvs.length === 0 ? (
            <div className="empty-state grid-empty">
              <i className="fas fa-folder-open"></i>
              <p>
                {searchTerm
                  ? t('dashboard.noResults')
                  : filterType === 'all'
                    ? t('dashboard.noCvs')
                    : filterType === 'resume'
                      ? t('dashboard.noResumes')
                      : t('dashboard.noCoverLetters')
                }
              </p>
            </div>
          ) : (
            processedCvs.map((cv) => {
              const docType = detectDocumentType(cv);
              const name = decodeEntities(cv.data?.data?.personal?.name) || '';
              const position = decodeEntities(cv.data?.data?.personal?.position) || '';
              return (
                <div
                  key={cv.id}
                  className={`dashboard-card ${selectedCvs.has(cv.id) ? 'selected' : ''}`}
                  onClick={() => onEditDocument(cv.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onEditDocument(cv.id); }}
                >
                  <div className="dashboard-card-header">
                    <div className={`card-type-badge ${docType}`}>
                      <i className={`fas ${docType === 'cover-letter' ? 'fa-envelope' : 'fa-file-alt'}`}></i>
                      {docType === 'cover-letter' ? t('templates.types.cover-letter') : t('templates.types.resume')}
                    </div>
                    <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="card-action-btn" onClick={() => handleDuplicate(cv)} title={t('dashboard.duplicate')}>
                        <i className="fas fa-copy"></i>
                      </button>
                      <button className="card-action-btn danger" onClick={() => handleDeleteOne(cv.id)} title={t('dashboard.delete')}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div className="dashboard-card-body">
                    {editingId === cv.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="inline-edit-input"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, cv.id)}
                        onBlur={() => handleRenameSubmit(cv.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="card-title">{cv.title}</h3>
                    )}
                    {name && <p className="card-name">{name}</p>}
                    {position && <p className="card-position">{position}</p>}
                  </div>
                  <div className="dashboard-card-footer">
                    <span className="card-date" title={formatDate(cv.updated_at)}>
                      <i className="fas fa-clock"></i>
                      {formatRelativeDate(cv.updated_at)}
                    </span>
                    <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="card-action-btn" onClick={() => handleRename(cv)} title={t('dashboard.rename')}>
                        <i className="fas fa-pen"></i>
                      </button>
                      {onPrintDocument && (
                        <button className="card-action-btn" onClick={() => onPrintDocument(cv.id)} title={t('dashboard.print')}>
                          <i className="fas fa-print"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
      <div className="table-container">
        <table className="cv-table">
          <thead>
            <tr>
              <th className="col-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCvs.size === processedCvs.length && processedCvs.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="col-title sortable" onClick={() => handleSort('title')}>
                {t('dashboard.colTitle')}
                {getSortIcon('title')}
              </th>
              <th className="col-name sortable" onClick={() => handleSort('name')}>
                {t('dashboard.colName')}
                {getSortIcon('name')}
              </th>
              <th className="col-position sortable" onClick={() => handleSort('position')}>
                {t('dashboard.colPosition')}
                {getSortIcon('position')}
              </th>
              <th className="col-created sortable" onClick={() => handleSort('created_at')}>
                {t('dashboard.colCreated')}
                {getSortIcon('created_at')}
              </th>
              <th className="col-updated sortable" onClick={() => handleSort('updated_at')}>
                {t('dashboard.colUpdated')}
                {getSortIcon('updated_at')}
              </th>
              <th className="col-actions">{t('dashboard.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {processedCvs.length === 0 ? (
              <tr className="empty-row">
                <td colSpan="7">
                  <div className="empty-state">
                    <i className="fas fa-folder-open"></i>
                    <p>
                      {searchTerm
                        ? t('dashboard.noResults')
                        : filterType === 'all'
                          ? t('dashboard.noCvs')
                          : filterType === 'resume'
                            ? t('dashboard.noResumes')
                            : t('dashboard.noCoverLetters')
                      }
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              processedCvs.map((cv) => (
                <tr key={cv.id} className={selectedCvs.has(cv.id) ? 'selected' : ''}>
                  <td className="col-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedCvs.has(cv.id)}
                      onChange={() => handleSelectOne(cv.id)}
                    />
                  </td>
                  <td className="col-title">
                    {editingId === cv.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="inline-edit-input"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, cv.id)}
                        onBlur={() => handleRenameSubmit(cv.id)}
                      />
                    ) : (
                      <span className="cv-title-text">{cv.title}</span>
                    )}
                  </td>
                  <td className="col-name">
                    {decodeEntities(cv.data?.data?.personal?.name) || <span className="empty-cell">—</span>}
                  </td>
                  <td className="col-position">
                    {decodeEntities(cv.data?.data?.personal?.position) || <span className="empty-cell">—</span>}
                  </td>
                  <td className="col-created" title={formatDate(cv.created_at)}>
                    {formatRelativeDate(cv.created_at)}
                  </td>
                  <td className="col-updated" title={formatDate(cv.updated_at)}>
                    {formatRelativeDate(cv.updated_at)}
                  </td>
                  <td className="col-actions">
                    <div className="action-buttons">
                      <button 
                        className="action-btn edit" 
                        onClick={() => onEditDocument(cv.id)}
                        title={t('dashboard.edit')}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        className="action-btn rename" 
                        onClick={() => handleRename(cv)}
                        title={t('dashboard.rename')}
                      >
                        <i className="fas fa-pen"></i>
                      </button>
                      <button 
                        className="action-btn duplicate" 
                        onClick={() => handleDuplicate(cv)}
                        title={t('dashboard.duplicate')}
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                      {onPrintDocument && (
                        <button 
                          className="action-btn print" 
                          onClick={() => onPrintDocument(cv.id)}
                          title={t('dashboard.print')}
                        >
                          <i className="fas fa-print"></i>
                        </button>
                      )}
                      {onSavePdfDocument && (
                        <button 
                          className="action-btn save-pdf" 
                          onClick={() => onSavePdfDocument(cv.id)}
                          title={t('dashboard.savePdf')}
                        >
                          <i className="fas fa-file-pdf"></i>
                        </button>
                      )}
                      <button 
                        className="action-btn delete" 
                        onClick={() => handleDeleteOne(cv.id)}
                        title={t('dashboard.delete')}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {processedCvs.length > 0 && (
        <div className="table-footer">
          <span>
            {t('dashboard.showing')
              .replace('{shown}', processedCvs.length)
              .replace('{total}', documentList.length)}
          </span>
        </div>
      )}
    </div>
  );
};

export default DocumentDashboard;
