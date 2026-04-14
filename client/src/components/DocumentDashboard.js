import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppState } from '../contexts/AppStateContext';
import { useTranslation } from '../i18n';
import { documentApi } from '../services/api';
import './DocumentDashboard.css';

const DocumentDashboard = ({ onEditDocument, onPrintDocument, onSavePdfDocument }) => {
  const { documentList, refreshDocumentList, deleteDocument, renameDocument, currentDocumentId } = useAuth();
  const { setDocumentTitle } = useAppState();
  const { t } = useTranslation();

  const [filterType, setFilterType] = useState(() => sessionStorage.getItem('dash_filterType') || 'all');
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('dash_viewMode') || 'grid');
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCvs, setSelectedCvs] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef(null);
  const [shareModal, setShareModal] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [linkPickerFor, setLinkPickerFor] = useState(null);
  const [linkPickerValue, setLinkPickerValue] = useState('');

  useEffect(() => { sessionStorage.setItem('dash_filterType', filterType); }, [filterType]);
  useEffect(() => { sessionStorage.setItem('dash_viewMode', viewMode); }, [viewMode]);
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const detectDocumentType = (cv) => {
    try {
      if (cv.document_type === 'cover_letter') return 'cover-letter';
      return 'resume';
    } catch (err) {
      return 'resume';
    }
  };

  /* ===== Application Packages (linked resume + cover-letter pairs) ===== */
  const { applicationGroups, standaloneDocuments } = useMemo(() => {
    const docs = documentList || [];
    const resumeById = new Map();
    const linkedCoverLetters = [];
    const usedResumeIds = new Set();
    const linkedCLIds = new Set();

    docs.forEach((doc) => {
      if (doc.document_type !== 'cover_letter') resumeById.set(doc.id, doc);
    });

    docs.forEach((doc) => {
      if (doc.document_type === 'cover_letter' && doc.linked_resume_id != null) {
        const resume = resumeById.get(doc.linked_resume_id);
        if (resume) {
          linkedCoverLetters.push({ resume, coverLetter: doc });
          usedResumeIds.add(resume.id);
          linkedCLIds.add(doc.id);
        }
      }
    });

    linkedCoverLetters.sort((a, b) => {
      const aT = Math.max(new Date(a.resume.updated_at).getTime(), new Date(a.coverLetter.updated_at).getTime());
      const bT = Math.max(new Date(b.resume.updated_at).getTime(), new Date(b.coverLetter.updated_at).getTime());
      return bT - aT;
    });

    const standalone = docs.filter((d) => !usedResumeIds.has(d.id) && !linkedCLIds.has(d.id));
    return { applicationGroups: linkedCoverLetters, standaloneDocuments: standalone };
  }, [documentList]);

  const availableResumes = useMemo(() => {
    const linkedIds = new Set(applicationGroups.map((g) => g.resume.id));
    return (documentList || []).filter((d) => d.document_type !== 'cover_letter' && !linkedIds.has(d.id));
  }, [documentList, applicationGroups]);

  const processedCvs = useMemo(() => {
    let filtered = [...standaloneDocuments];
    if (filterType && filterType !== 'all') {
      filtered = filtered.filter((cv) => detectDocumentType(cv) === filterType);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((cv) => cv.title.toLowerCase().includes(term));
    }
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === 'created_at' || sortConfig.key === 'updated_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [standaloneDocuments, searchTerm, sortConfig, filterType]);

  const filteredGroups = useMemo(() => {
    if (filterType === 'resume' || filterType === 'cover-letter') return [];
    let groups = applicationGroups;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      groups = groups.filter((g) =>
        g.resume.title.toLowerCase().includes(term) || g.coverLetter.title.toLowerCase().includes(term)
      );
    }
    return groups;
  }, [applicationGroups, searchTerm, filterType]);

  /* ===== Handlers ===== */
  const handleLinkDocument = async (coverLetterId, resumeId) => {
    try {
      await documentApi.linkToResume(coverLetterId, resumeId);
      await refreshDocumentList();
      setLinkPickerFor(null);
      setLinkPickerValue('');
    } catch (err) { console.error('Failed to link documents:', err); }
  };

  const handleUnlinkDocument = async (coverLetterId) => {
    try {
      await documentApi.unlinkFromResume(coverLetterId);
      await refreshDocumentList();
    } catch (err) { console.error('Failed to unlink documents:', err); }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const handleSelectAll = (e) => {
    setSelectedCvs(e.target.checked ? new Set(processedCvs.map((cv) => cv.id)) : new Set());
  };

  const handleSelectOne = (cvId) => {
    setSelectedCvs((prev) => {
      const s = new Set(prev);
      s.has(cvId) ? s.delete(cvId) : s.add(cvId);
      return s;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedCvs.size === 0) return;
    if (!window.confirm(t('dashboard.confirmDeleteMultiple').replace('{count}', selectedCvs.size))) return;
    setIsDeleting(true);
    try {
      for (const cvId of selectedCvs) await deleteDocument(cvId);
      setSelectedCvs(new Set());
    } catch (err) { console.error('Failed to delete:', err); }
    setIsDeleting(false);
  };

  const handleDeleteOne = async (cvId) => {
    if (!window.confirm(t('userMenu.confirmDelete'))) return;
    await deleteDocument(cvId);
  };

  const handleDuplicate = async (cv) => {
    try {
      const fullDoc = await documentApi.get(cv.id);
      const result = await documentApi.create(`${cv.title} (${t('dashboard.copy')})`, fullDoc.data);
      if (result) await refreshDocumentList();
    } catch (err) { console.error('Failed to duplicate:', err); }
  };

  const handleShareDocument = async (docId) => {
    try {
      const doc = documentList.find((d) => d.id === docId);
      if (doc?.share_token) {
        setShareModal({ docId, url: `${window.location.origin}/shared/${doc.share_token}`, token: doc.share_token });
        return;
      }
      const result = await documentApi.createShareLink(docId);
      if (result?.url) {
        setShareModal({ docId, url: `${window.location.origin}${result.url}`, token: result.share_token });
        await refreshDocumentList();
      }
    } catch (err) { console.error('Failed to create share link:', err); }
  };

  const handleCopyShareLink = async () => {
    if (!shareModal?.url) return;
    try {
      await navigator.clipboard.writeText(shareModal.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) { console.error('Failed to copy:', err); }
  };

  const handleRevokeShareLink = async () => {
    if (!shareModal?.docId) return;
    try {
      await documentApi.revokeShareLink(shareModal.docId);
      setShareModal(null);
      await refreshDocumentList();
    } catch (err) { console.error('Failed to revoke:', err); }
  };

  const handleRename = (cv) => { setEditingId(cv.id); setEditingTitle(cv.title); };

  const handleRenameSubmit = async (cvId) => {
    if (editingTitle.trim() && editingTitle.trim() !== documentList.find((c) => c.id === cvId)?.title) {
      try {
        await renameDocument(cvId, editingTitle.trim());
        if (cvId === currentDocumentId) setDocumentTitle(editingTitle.trim());
      } catch (err) { console.error('Failed to rename:', err); }
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleRenameCancel = () => { setEditingId(null); setEditingTitle(''); };

  const handleRenameKeyDown = (e, cvId) => {
    if (e.key === 'Enter') { e.preventDefault(); handleRenameSubmit(cvId); }
    else if (e.key === 'Escape') handleRenameCancel();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatRelativeDate = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return t('dashboard.justNow');
    if (mins < 60) return t('dashboard.minsAgo').replace('{n}', mins);
    if (hrs < 24) return t('dashboard.hoursAgo').replace('{n}', hrs);
    if (days < 7) return t('dashboard.daysAgo').replace('{n}', days);
    return formatDate(dateStr);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <i className="fas fa-sort sort-icon inactive"></i>;
    return sortConfig.direction === 'asc'
      ? <i className="fas fa-sort-up sort-icon"></i>
      : <i className="fas fa-sort-down sort-icon"></i>;
  };

  /* ===== Render ===== */
  return (
    <div className="dd">
      {/* Header */}
      <header className="dd-header">
        <h1 className="dd-title">
          {filterType === 'all' && t('nav.dashboard')}
          {filterType === 'resume' && t('templates.types.resume')}
          {filterType === 'cover-letter' && t('templates.types.cover-letter')}
        </h1>
        <div className="dd-filters">
          {['all', 'resume', 'cover-letter'].map((ft) => (
            <button
              key={ft}
              className={`dd-filter-btn${filterType === ft ? ' active' : ''}`}
              onClick={() => setFilterType(ft)}
            >
              {ft === 'all' ? t('templates.types.all') : ft === 'resume' ? t('templates.types.resume') : t('templates.types.cover-letter')}
            </button>
          ))}
        </div>
      </header>

      {/* Toolbar */}
      <div className="dd-toolbar">
        <div className="dd-search">
          <i className="fas fa-search dd-search-icon"></i>
          <input
            type="text"
            placeholder={t('dashboard.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="dd-search-clear" onClick={() => setSearchTerm('')}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        <div className="dd-toolbar-right">
          <span className="dd-count">
            {t('dashboard.totalDocs').replace('{count}', documentList.length)}
          </span>
          <div className="dd-view-toggle" role="radiogroup" aria-label={t('dashboard.viewMode') || 'View mode'}>
            <button
              className={`dd-view-btn${viewMode === 'grid' ? ' active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              title={t('dashboard.gridView')}
            >
              <i className="fas fa-th-large"></i>
            </button>
            <button
              className={`dd-view-btn${viewMode === 'table' ? ' active' : ''}`}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              title={t('dashboard.tableView')}
            >
              <i className="fas fa-list"></i>
            </button>
          </div>
          {selectedCvs.size > 0 && (
            <button className="dd-delete-sel" onClick={handleDeleteSelected} disabled={isDeleting}>
              <i className="fas fa-trash"></i> {t('dashboard.deleteSelected')} ({selectedCvs.size})
            </button>
          )}
        </div>
      </div>

      {/* ===== Application Packages ===== */}
      {filterType === 'all' && filteredGroups.length > 0 && (
        <section className="dd-packages">
          <h2 className="dd-section-title">
            <i className="fas fa-briefcase"></i>
            {t('dashboard.applicationPackages')}
            <span className="dd-badge">{filteredGroups.length}</span>
          </h2>

          {viewMode === 'grid' ? (
            <div className="dd-pkg-grid">
              {filteredGroups.map((group) => (
                <div key={`grp-${group.resume.id}`} className="dd-pkg-card">
                  <div className="dd-pkg-pair">
                    <div
                      className="dd-pkg-doc dd-pkg-doc--resume"
                      onClick={() => onEditDocument(group.resume.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onEditDocument(group.resume.id); }}
                    >
                      <div className="dd-pkg-doc-header">
                        <span className="dd-pkg-doc-type">
                          <i className="fas fa-file-alt"></i> {t('templates.types.resume')}
                        </span>
                        <button className="dd-pkg-doc-dup" onClick={(e) => { e.stopPropagation(); handleDuplicate(group.resume); }} title={t('dashboard.duplicate')}>
                          <i className="fas fa-copy"></i>
                        </button>
                      </div>
                      <h4 className="dd-pkg-doc-name">{group.resume.title}</h4>
                      {group.resume.job_title && (
                        <p className="dd-subtitle">{group.resume.job_title}</p>
                      )}
                      <span className="dd-pkg-doc-date">
                        <i className="fas fa-clock"></i> {formatRelativeDate(group.resume.updated_at)}
                      </span>
                    </div>
                    <div className="dd-pkg-link-icon">
                      <i className="fas fa-link"></i>
                    </div>
                    <div
                      className="dd-pkg-doc dd-pkg-doc--cl"
                      onClick={() => onEditDocument(group.coverLetter.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onEditDocument(group.coverLetter.id); }}
                    >
                      <div className="dd-pkg-doc-header">
                        <span className="dd-pkg-doc-type">
                          <i className="fas fa-envelope"></i> {t('templates.types.cover-letter')}
                        </span>
                        <button className="dd-pkg-doc-dup" onClick={(e) => { e.stopPropagation(); handleDuplicate(group.coverLetter); }} title={t('dashboard.duplicate')}>
                          <i className="fas fa-copy"></i>
                        </button>
                      </div>
                      <h4 className="dd-pkg-doc-name">{group.coverLetter.title}</h4>
                      <span className="dd-pkg-doc-date">
                        <i className="fas fa-clock"></i> {formatRelativeDate(group.coverLetter.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div className="dd-pkg-footer">
                    <button className="dd-pkg-unlink" onClick={() => handleUnlinkDocument(group.coverLetter.id)} title={t('dashboard.unlinkDocument')}>
                      <i className="fas fa-unlink"></i> {t('dashboard.unlinkDocument')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dd-pkg-list">
              {filteredGroups.map((group) => (
                <div key={`pkgr-${group.resume.id}`} className="dd-pkg-row">
                  <div className="dd-pkg-row-docs">
                    <button className="dd-pkg-row-doc dd-pkg-row-doc--resume" onClick={() => onEditDocument(group.resume.id)}>
                      <i className="fas fa-file-alt"></i>
                      <span className="dd-pkg-row-text">
                        <span className="dd-pkg-row-title">{group.resume.title}</span>
                        {group.resume.job_title && (
                          <span className="dd-subtitle">{group.resume.job_title}</span>
                        )}
                      </span>
                    </button>
                    <button className="dd-pkg-row-dup" onClick={() => handleDuplicate(group.resume)} title={t('dashboard.duplicate')}>
                      <i className="fas fa-copy"></i>
                    </button>
                    <i className="fas fa-link dd-pkg-row-link"></i>
                    <button className="dd-pkg-row-doc dd-pkg-row-doc--cl" onClick={() => onEditDocument(group.coverLetter.id)}>
                      <i className="fas fa-envelope"></i>
                      <span>{group.coverLetter.title}</span>
                    </button>
                    <button className="dd-pkg-row-dup" onClick={() => handleDuplicate(group.coverLetter)} title={t('dashboard.duplicate')}>
                      <i className="fas fa-copy"></i>
                    </button>
                  </div>
                  <div className="dd-pkg-row-meta">
                    <span className="dd-pkg-row-date">
                      <i className="fas fa-clock"></i>
                      {formatRelativeDate(
                        new Date(group.resume.updated_at) > new Date(group.coverLetter.updated_at)
                          ? group.resume.updated_at : group.coverLetter.updated_at
                      )}
                    </span>
                    <button className="dd-pkg-row-unlink" onClick={() => handleUnlinkDocument(group.coverLetter.id)} title={t('dashboard.unlinkDocument')}>
                      <i className="fas fa-unlink"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== All Documents heading ===== */}
      {filterType === 'all' && (
        <h2 className="dd-section-title dd-section-title--docs">
          <i className="fas fa-folder-open"></i>
          {t('dashboard.allDocuments')}
          {processedCvs.length > 0 && <span className="dd-badge">{processedCvs.length}</span>}
        </h2>
      )}

      {/* ===== Grid View ===== */}
      {viewMode === 'grid' && (
        <div className="dd-grid">
          {processedCvs.length === 0 ? (
            <div className="dd-empty dd-empty--span">
              <i className="fas fa-folder-open"></i>
              <p>{searchTerm ? t('dashboard.noResults') : t('dashboard.noCvs')}</p>
            </div>
          ) : (
            processedCvs.map((cv) => {
              const docType = detectDocumentType(cv);
              return (
                <div
                  key={cv.id}
                  className={`dd-card${selectedCvs.has(cv.id) ? ' selected' : ''}`}
                  onClick={() => onEditDocument(cv.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onEditDocument(cv.id); }}
                >
                  <div className="dd-card-top">
                    <span className={`dd-card-badge dd-card-badge--${docType}`}>
                      <i className={`fas ${docType === 'cover-letter' ? 'fa-envelope' : 'fa-file-alt'}`}></i>
                      {docType === 'cover-letter' ? t('templates.types.cover-letter') : t('templates.types.resume')}
                    </span>
                    <div className="dd-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button className={`dd-card-act${cv.share_token ? ' shared' : ''}`} onClick={() => handleShareDocument(cv.id)} title={t('dashboard.share')}>
                        <i className="fas fa-share-alt"></i>
                      </button>
                      <button className="dd-card-act" onClick={() => handleDuplicate(cv)} title={t('dashboard.duplicate')}>
                        <i className="fas fa-copy"></i>
                      </button>
                      <button className="dd-card-act dd-card-act--danger" onClick={() => handleDeleteOne(cv.id)} title={t('dashboard.delete')}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div className="dd-card-body">
                    {editingId === cv.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="dd-inline-edit"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, cv.id)}
                        onBlur={() => handleRenameSubmit(cv.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="dd-card-name">{cv.title}</h3>
                    )}
                    {docType === 'cover-letter' && (
                      <div className="dd-card-link-area">
                        {linkPickerFor === cv.id ? (
                          <div className="dd-link-picker" onClick={(e) => e.stopPropagation()}>
                            <select value={linkPickerValue} onChange={(e) => setLinkPickerValue(e.target.value)} className="dd-link-picker-sel">
                              <option value="">{t('dashboard.selectResume')}</option>
                              {availableResumes.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                            </select>
                            <button className="dd-link-picker-ok" disabled={!linkPickerValue} onClick={() => handleLinkDocument(cv.id, Number(linkPickerValue))}>
                              <i className="fas fa-check"></i>
                            </button>
                            <button className="dd-link-picker-no" onClick={() => { setLinkPickerFor(null); setLinkPickerValue(''); }}>
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ) : (
                          <button className="dd-link-btn" onClick={(e) => { e.stopPropagation(); setLinkPickerFor(cv.id); }}>
                            <i className="fas fa-link"></i> {t('dashboard.linkToResume')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="dd-card-bottom">
                    <span className="dd-card-date" title={formatDate(cv.updated_at)}>
                      <i className="fas fa-clock"></i> {formatRelativeDate(cv.updated_at)}
                    </span>
                    <div className="dd-card-quick" onClick={(e) => e.stopPropagation()}>
                      <button className="dd-card-act" onClick={() => handleRename(cv)} title={t('dashboard.rename')}>
                        <i className="fas fa-pen"></i>
                      </button>
                      {onPrintDocument && (
                        <button className="dd-card-act" onClick={() => onPrintDocument(cv.id)} title={t('dashboard.print')}>
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

      {/* ===== Table View ===== */}
      {viewMode === 'table' && (
        <div className="dd-table-wrap">
          <table className="dd-table">
            <thead>
              <tr>
                <th className="dd-col-check">
                  <input type="checkbox" checked={selectedCvs.size === processedCvs.length && processedCvs.length > 0} onChange={handleSelectAll} />
                </th>
                <th className="dd-col-title dd-sortable" onClick={() => handleSort('title')}>
                  {t('dashboard.colTitle')} {getSortIcon('title')}
                </th>
                <th className="dd-col-type">{t('dashboard.colType')}</th>
                <th className="dd-col-link">{t('dashboard.colLink')}</th>
                <th className="dd-col-updated dd-sortable" onClick={() => handleSort('updated_at')}>
                  {t('dashboard.colUpdated')} {getSortIcon('updated_at')}
                </th>
                <th className="dd-col-actions">{t('dashboard.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {processedCvs.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="dd-empty">
                      <i className="fas fa-folder-open"></i>
                      <p>{searchTerm ? t('dashboard.noResults') : t('dashboard.noCvs')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedCvs.map((cv) => {
                  const docType = detectDocumentType(cv);
                  return (
                    <tr key={cv.id} className={selectedCvs.has(cv.id) ? 'selected' : ''}>
                      <td className="dd-col-check">
                        <input type="checkbox" checked={selectedCvs.has(cv.id)} onChange={() => handleSelectOne(cv.id)} />
                      </td>
                      <td className="dd-col-title">
                        {editingId === cv.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            className="dd-inline-edit"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, cv.id)}
                            onBlur={() => handleRenameSubmit(cv.id)}
                          />
                        ) : (
                          <span className="dd-title-link" onClick={() => onEditDocument(cv.id)}>
                            {cv.title}
                          </span>
                        )}
                      </td>
                      <td className="dd-col-type">
                        <span className={`dd-type-pill dd-type-pill--${docType}`}>
                          <i className={`fas ${docType === 'cover-letter' ? 'fa-envelope' : 'fa-file-alt'}`}></i>
                          {docType === 'cover-letter' ? t('templates.types.cover-letter') : t('templates.types.resume')}
                        </span>
                      </td>
                      <td className="dd-col-link">
                        {docType === 'cover-letter' && (
                          linkPickerFor === cv.id ? (
                            <div className="dd-link-picker">
                              <select value={linkPickerValue} onChange={(e) => setLinkPickerValue(e.target.value)} className="dd-link-picker-sel">
                                <option value="">{t('dashboard.selectResume')}</option>
                                {availableResumes.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                              </select>
                              <button className="dd-link-picker-ok" disabled={!linkPickerValue} onClick={() => handleLinkDocument(cv.id, Number(linkPickerValue))}>
                                <i className="fas fa-check"></i>
                              </button>
                              <button className="dd-link-picker-no" onClick={() => { setLinkPickerFor(null); setLinkPickerValue(''); }}>
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ) : (
                            <button className="dd-link-btn dd-link-btn--sm" onClick={() => setLinkPickerFor(cv.id)}>
                              <i className="fas fa-link"></i> {t('dashboard.linkToResume')}
                            </button>
                          )
                        )}
                      </td>
                      <td className="dd-col-updated" title={formatDate(cv.updated_at)}>
                        {formatRelativeDate(cv.updated_at)}
                      </td>
                      <td className="dd-col-actions">
                        <div className="dd-row-actions">
                          <button className="dd-row-act dd-row-act--edit" onClick={() => onEditDocument(cv.id)} title={t('dashboard.edit')}><i className="fas fa-pen"></i></button>
                          <button className="dd-row-act" onClick={() => handleRename(cv)} title={t('dashboard.rename')}><i className="fas fa-i-cursor"></i></button>
                          <button className="dd-row-act" onClick={() => handleDuplicate(cv)} title={t('dashboard.duplicate')}><i className="fas fa-copy"></i></button>
                          <button className={`dd-row-act${cv.share_token ? ' shared' : ''}`} onClick={() => handleShareDocument(cv.id)} title={t('dashboard.share')}><i className="fas fa-share-alt"></i></button>
                          {onPrintDocument && (
                            <button className="dd-row-act" onClick={() => onPrintDocument(cv.id)} title={t('dashboard.print')}><i className="fas fa-print"></i></button>
                          )}
                          <button className="dd-row-act dd-row-act--del" onClick={() => handleDeleteOne(cv.id)} title={t('dashboard.delete')}><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {processedCvs.length > 0 && (
        <div className="dd-footer-info">
          {t('dashboard.showing').replace('{shown}', processedCvs.length).replace('{total}', documentList.length)}
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="dd-modal-overlay" onClick={() => { setShareModal(null); setShareCopied(false); }}>
          <div className="dd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-head">
              <h3><i className="fas fa-share-alt"></i> {t('dashboard.share')}</h3>
              <button className="dd-modal-close" onClick={() => { setShareModal(null); setShareCopied(false); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="dd-modal-body">
              <p className="dd-modal-label">{t('dashboard.shareLink')}</p>
              <div className="dd-modal-link-row">
                <input type="text" className="dd-modal-input" value={shareModal.url} readOnly />
                <button className="dd-modal-copy" onClick={handleCopyShareLink} disabled={shareCopied}>
                  <i className={`fas ${shareCopied ? 'fa-check' : 'fa-copy'}`}></i>
                  {shareCopied ? t('dashboard.copied') : t('dashboard.copy')}
                </button>
              </div>
            </div>
            <div className="dd-modal-foot">
              <button className="dd-modal-revoke" onClick={handleRevokeShareLink}>
                <i className="fas fa-ban"></i> {t('dashboard.revokeLink')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDashboard;
