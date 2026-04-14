#!/usr/bin/env python3
"""Write the new DocumentDashboard.js file."""
import os

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    '..', 'client', 'src', 'components', 'DocumentDashboard.js')

CONTENT = r'''import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppState } from '../contexts/AppStateContext';
import { useTranslation } from '../i18n';
import { documentApi } from '../services/api';
import './DocumentDashboard.css';

const DocumentDashboard = ({ onEditDocument, onPrintDocument, onSavePdfDocument, onNewDocument }) => {
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
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => { sessionStorage.setItem('dash_filterType', filterType); }, [filterType]);
  useEffect(() => { sessionStorage.setItem('dash_viewMode', viewMode); }, [viewMode]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    const handleClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const detectDocumentType = (cv) => {
    if (cv.document_type === 'cover_letter') return 'cover-letter';
    return 'resume';
  };

  // ===== Derived data =====
  const applicationGroups = useMemo(() => {
    const docs = documentList || [];
    const resumeById = new Map();
    const groups = [];
    const usedResumeIds = new Set();

    docs.forEach((doc) => {
      if (doc.document_type !== 'cover_letter') resumeById.set(doc.id, doc);
    });

    docs.forEach((doc) => {
      if (doc.document_type === 'cover_letter' && doc.linked_resume_id != null) {
        const resume = resumeById.get(doc.linked_resume_id);
        if (resume) {
          groups.push({ resume, coverLetter: doc });
          usedResumeIds.add(resume.id);
        }
      }
    });

    groups.sort((a, b) => {
      const aTime = Math.max(new Date(a.resume.updated_at).getTime(), new Date(a.coverLetter.updated_at).getTime());
      const bTime = Math.max(new Date(b.resume.updated_at).getTime(), new Date(b.coverLetter.updated_at).getTime());
      return bTime - aTime;
    });

    return groups;
  }, [documentList]);

  const availableResumes = useMemo(() => {
    const linked = new Set(applicationGroups.map((g) => g.resume.id));
    return (documentList || []).filter((d) => d.document_type !== 'cover_letter' && !linked.has(d.id));
  }, [documentList, applicationGroups]);

  // All documents (flat) — filtered, searched, sorted
  const allDocuments = useMemo(() => {
    let list = [...(documentList || [])];
    if (filterType === 'resume') list = list.filter((d) => d.document_type !== 'cover_letter');
    else if (filterType === 'cover-letter') list = list.filter((d) => d.document_type === 'cover_letter');
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(term));
    }
    list.sort((a, b) => {
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
    return list;
  }, [documentList, searchTerm, sortConfig, filterType]);

  const filteredGroups = useMemo(() => {
    if (filterType === 'resume' || filterType === 'cover-letter') return [];
    if (!searchTerm) return applicationGroups;
    const term = searchTerm.toLowerCase();
    return applicationGroups.filter((g) =>
      g.resume.title.toLowerCase().includes(term) || g.coverLetter.title.toLowerCase().includes(term)
    );
  }, [applicationGroups, searchTerm, filterType]);

  // ===== Handlers =====
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
    if (e.target.checked) setSelectedCvs(new Set(allDocuments.map((d) => d.id)));
    else setSelectedCvs(new Set());
  };

  const handleSelectOne = (id) => {
    setSelectedCvs((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedCvs.size === 0) return;
    if (!window.confirm(t('dashboard.confirmDeleteMultiple').replace('{count}', selectedCvs.size))) return;
    setIsDeleting(true);
    try {
      for (const id of selectedCvs) await deleteDocument(id);
      setSelectedCvs(new Set());
    } catch (err) { console.error('Failed to delete:', err); }
    setIsDeleting(false);
  };

  const handleDeleteOne = async (id) => {
    if (!window.confirm(t('userMenu.confirmDelete'))) return;
    await deleteDocument(id);
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
    } catch (err) { console.error('Failed to share:', err); }
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

  const handleRenameKeyDown = (e, cvId) => {
    if (e.key === 'Enter') { e.preventDefault(); handleRenameSubmit(cvId); }
    else if (e.key === 'Escape') { setEditingId(null); setEditingTitle(''); }
  };

  // ===== Helpers =====
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatRelativeDate = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return t('dashboard.justNow');
    if (mins < 60) return t('dashboard.minsAgo').replace('{n}', mins);
    if (hours < 24) return t('dashboard.hoursAgo').replace('{n}', hours);
    if (days < 7) return t('dashboard.daysAgo').replace('{n}', days);
    return formatDate(dateStr);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <i className="fas fa-sort sort-icon inactive"></i>;
    return sortConfig.direction === 'asc'
      ? <i className="fas fa-sort-up sort-icon"></i>
      : <i className="fas fa-sort-down sort-icon"></i>;
  };

  const getLinkedResumeTitle = (doc) => {
    if (doc.document_type !== 'cover_letter' || doc.linked_resume_id == null) return null;
    const r = (documentList || []).find((d) => d.id === doc.linked_resume_id);
    return r ? r.title : null;
  };

  const filterLabel = filterType === 'resume'
    ? t('templates.types.resume')
    : filterType === 'cover-letter'
      ? t('templates.types.cover-letter')
      : t('templates.types.all');

  return (
    <div className="cv-dashboard">
      {/* ===== Header ===== */}
      <div className="dashboard-header">
        <h1>{t('nav.dashboard')}</h1>
        <div className="header-actions">
          <button className="new-doc-btn resume" onClick={() => onNewDocument('resume')}>
            <i className="fas fa-file-alt"></i> {t('dashboard.newResume')}
          </button>
          <button className="new-doc-btn cover-letter" onClick={() => onNewDocument('cover-letter')}>
            <i className="fas fa-envelope"></i> {t('dashboard.newCoverLetter')}
          </button>
        </div>
      </div>

      {/* ===== Toolbar ===== */}
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
          <div className="filter-dropdown" ref={filterRef}>
            <button className="filter-pill" onClick={() => setFilterOpen(!filterOpen)}>
              <i className="fas fa-filter"></i>
              {filterLabel}
              <i className={`fas fa-chevron-down filter-chevron ${filterOpen ? 'open' : ''}`}></i>
            </button>
            {filterOpen && (
              <div className="filter-menu">
                {['all', 'resume', 'cover-letter'].map((type) => (
                  <button
                    key={type}
                    className={`filter-menu-item ${filterType === type ? 'active' : ''}`}
                    onClick={() => { setFilterType(type); setFilterOpen(false); }}
                  >
                    {type === 'all' && <i className="fas fa-th-large"></i>}
                    {type === 'resume' && <i className="fas fa-file-alt"></i>}
                    {type === 'cover-letter' && <i className="fas fa-envelope"></i>}
                    {type === 'all' ? t('templates.types.all') : type === 'resume' ? t('templates.types.resume') : t('templates.types.cover-letter')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="cv-count">
            {t('dashboard.totalDocs').replace('{count}', (documentList || []).length)}
          </span>

          <div className="view-toggle" role="radiogroup" aria-label={t('dashboard.viewMode')}>
            <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title={t('dashboard.gridView')}>
              <i className="fas fa-th-large"></i>
            </button>
            <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} title={t('dashboard.tableView')}>
              <i className="fas fa-list"></i>
            </button>
          </div>

          {selectedCvs.size > 0 && (
            <button className="delete-selected-btn" onClick={handleDeleteSelected} disabled={isDeleting}>
              <i className="fas fa-trash"></i>
              {t('dashboard.deleteSelected')} ({selectedCvs.size})
            </button>
          )}
        </div>
      </div>

      {/* ===== Application Packages (only when groups exist) ===== */}
      {filteredGroups.length > 0 && filterType === 'all' && (
        <div className="packages-section">
          <h2 className="section-heading">
            <i className="fas fa-briefcase"></i>
            {t('dashboard.applicationPackages')}
            <span className="section-count">{filteredGroups.length}</span>
          </h2>

          <div className="packages-list">
            {filteredGroups.map((group) => (
              <div key={`pkg-${group.resume.id}`} className="package-row">
                <div className="package-docs">
                  <button className="package-doc resume" onClick={() => onEditDocument(group.resume.id)}>
                    <i className="fas fa-file-alt"></i>
                    <span className="package-doc-title">{group.resume.title}</span>
                  </button>
                  <span className="package-link-icon"><i className="fas fa-link"></i></span>
                  <button className="package-doc cover-letter" onClick={() => onEditDocument(group.coverLetter.id)}>
                    <i className="fas fa-envelope"></i>
                    <span className="package-doc-title">{group.coverLetter.title}</span>
                  </button>
                </div>
                <div className="package-meta">
                  <span className="package-date">
                    <i className="fas fa-clock"></i>
                    {formatRelativeDate(
                      new Date(group.resume.updated_at) > new Date(group.coverLetter.updated_at)
                        ? group.resume.updated_at
                        : group.coverLetter.updated_at
                    )}
                  </span>
                  <div className="package-actions">
                    <button className="pkg-action-btn" onClick={() => onEditDocument(group.resume.id)} title={t('dashboard.edit')}>
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="pkg-action-btn unlink" onClick={() => handleUnlinkDocument(group.coverLetter.id)} title={t('dashboard.unlinkDocument')}>
                      <i className="fas fa-unlink"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== All Documents heading ===== */}
      <h2 className="section-heading documents-heading">
        <i className="fas fa-folder-open"></i>
        {t('dashboard.allDocuments')}
        {allDocuments.length > 0 && <span className="section-count">{allDocuments.length}</span>}
      </h2>

      {/* ===== Grid View ===== */}
      {viewMode === 'grid' && (
        <div className="dashboard-grid">
          {allDocuments.length === 0 && !searchTerm && (documentList || []).length === 0 ? (
            <div className="empty-state grid-empty">
              <i className="fas fa-folder-open"></i>
              <p>{t('dashboard.emptyHint')}</p>
              <div className="empty-state-actions">
                <button className="empty-state-btn" onClick={() => onNewDocument('resume')}>
                  <i className="fas fa-plus"></i> {t('dashboard.createFirst')}
                </button>
              </div>
            </div>
          ) : allDocuments.length === 0 ? (
            <div className="empty-state grid-empty">
              <i className="fas fa-search"></i>
              <p>{t('dashboard.noResults')}</p>
            </div>
          ) : (
            <>
              {allDocuments.map((cv) => {
                const docType = detectDocumentType(cv);
                const linkedTitle = getLinkedResumeTitle(cv);
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
                        {docType === 'cover-letter' ? t('templates.types.cover-letter-singular') : t('templates.types.resume-singular')}
                      </div>
                      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                        <button className={`card-action-btn${cv.share_token ? ' shared' : ''}`} onClick={() => handleShareDocument(cv.id)} title={t('dashboard.share')}>
                          <i className="fas fa-share-alt"></i>
                        </button>
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
                      {linkedTitle && (
                        <p className="card-link-chip linked">
                          <i className="fas fa-link"></i> {linkedTitle}
                        </p>
                      )}
                      {docType === 'cover-letter' && !linkedTitle && (
                        <div className="card-link-prompt" onClick={(e) => e.stopPropagation()}>
                          {linkPickerFor === cv.id ? (
                            <div className="inline-link-picker">
                              <select
                                value={linkPickerValue}
                                onChange={(e) => setLinkPickerValue(e.target.value)}
                                className="link-picker-select"
                              >
                                <option value="">{t('dashboard.selectResume')}</option>
                                {availableResumes.map((d) => (
                                  <option key={d.id} value={d.id}>{d.title}</option>
                                ))}
                              </select>
                              <button className="link-picker-confirm" disabled={!linkPickerValue} onClick={() => { if (linkPickerValue) handleLinkDocument(cv.id, Number(linkPickerValue)); }}>
                                <i className="fas fa-check"></i>
                              </button>
                              <button className="link-picker-cancel" onClick={() => { setLinkPickerFor(null); setLinkPickerValue(''); }}>
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ) : (
                            <button className="link-prompt-btn" onClick={() => setLinkPickerFor(cv.id)}>
                              <i className="fas fa-link"></i> {t('dashboard.linkToResume')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="dashboard-card-footer">
                      <span className="card-date" title={formatDate(cv.updated_at)}>
                        <i className="fas fa-clock"></i> {formatRelativeDate(cv.updated_at)}
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
              })}
              <div className="dashboard-card ghost-card" onClick={() => onNewDocument('resume')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onNewDocument('resume'); }}>
                <div className="ghost-card-inner">
                  <i className="fas fa-plus"></i>
                  <span>{t('dashboard.createNew')}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Table View ===== */}
      {viewMode === 'table' && (
        <div className="table-container">
          <table className="cv-table">
            <thead>
              <tr>
                <th className="col-checkbox">
                  <input type="checkbox" checked={selectedCvs.size === allDocuments.length && allDocuments.length > 0} onChange={handleSelectAll} />
                </th>
                <th className="col-title sortable" onClick={() => handleSort('title')}>
                  {t('dashboard.colTitle')} {getSortIcon('title')}
                </th>
                <th className="col-type">{t('dashboard.colType')}</th>
                <th className="col-link">{t('dashboard.colLink')}</th>
                <th className="col-updated sortable" onClick={() => handleSort('updated_at')}>
                  {t('dashboard.colUpdated')} {getSortIcon('updated_at')}
                </th>
                <th className="col-actions">{t('dashboard.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {allDocuments.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="6">
                    <div className="empty-state">
                      <i className="fas fa-folder-open"></i>
                      <p>{searchTerm ? t('dashboard.noResults') : t('dashboard.emptyHint')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                allDocuments.map((cv) => {
                  const docType = detectDocumentType(cv);
                  const linkedTitle = getLinkedResumeTitle(cv);
                  return (
                    <tr key={cv.id} className={selectedCvs.has(cv.id) ? 'selected' : ''}>
                      <td className="col-checkbox">
                        <input type="checkbox" checked={selectedCvs.has(cv.id)} onChange={() => handleSelectOne(cv.id)} />
                      </td>
                      <td className="col-title">
                        {editingId === cv.id ? (
                          <input ref={editInputRef} type="text" className="inline-edit-input" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onKeyDown={(e) => handleRenameKeyDown(e, cv.id)} onBlur={() => handleRenameSubmit(cv.id)} />
                        ) : (
                          <span className="cv-title-text">{cv.title}</span>
                        )}
                      </td>
                      <td className="col-type">
                        <span className={`table-type-badge ${docType}`}>
                          <i className={`fas ${docType === 'cover-letter' ? 'fa-envelope' : 'fa-file-alt'}`}></i>
                          {docType === 'cover-letter' ? t('templates.types.cover-letter-singular') : t('templates.types.resume-singular')}
                        </span>
                      </td>
                      <td className="col-link">
                        {linkedTitle ? (
                          <span className="link-pill linked" title={linkedTitle}>
                            <i className="fas fa-link"></i> {linkedTitle}
                          </span>
                        ) : docType === 'cover-letter' ? (
                          <button className="link-prompt-btn small" onClick={() => { setLinkPickerFor(cv.id); setLinkPickerValue(''); }}>
                            <i className="fas fa-link"></i> {t('dashboard.linkToResume')}
                          </button>
                        ) : null}
                      </td>
                      <td className="col-updated" title={formatDate(cv.updated_at)}>
                        {formatRelativeDate(cv.updated_at)}
                      </td>
                      <td className="col-actions">
                        <div className="action-buttons">
                          <button className="action-btn edit" onClick={() => onEditDocument(cv.id)} title={t('dashboard.edit')}>
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="action-btn rename" onClick={() => handleRename(cv)} title={t('dashboard.rename')}>
                            <i className="fas fa-pen"></i>
                          </button>
                          <button className="action-btn duplicate" onClick={() => handleDuplicate(cv)} title={t('dashboard.duplicate')}>
                            <i className="fas fa-copy"></i>
                          </button>
                          <button className={`action-btn share${cv.share_token ? ' shared' : ''}`} onClick={() => handleShareDocument(cv.id)} title={t('dashboard.share')}>
                            <i className="fas fa-share-alt"></i>
                          </button>
                          {onPrintDocument && (
                            <button className="action-btn print" onClick={() => onPrintDocument(cv.id)} title={t('dashboard.print')}>
                              <i className="fas fa-print"></i>
                            </button>
                          )}
                          {onSavePdfDocument && (
                            <button className="action-btn save-pdf" onClick={() => onSavePdfDocument(cv.id)} title={t('dashboard.savePdf')}>
                              <i className="fas fa-file-pdf"></i>
                            </button>
                          )}
                          <button className="action-btn delete" onClick={() => handleDeleteOne(cv.id)} title={t('dashboard.delete')}>
                            <i className="fas fa-trash"></i>
                          </button>
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

      {allDocuments.length > 0 && (
        <div className="table-footer">
          <span>{t('dashboard.showing').replace('{shown}', allDocuments.length).replace('{total}', (documentList || []).length)}</span>
        </div>
      )}

      {/* ===== Share Modal ===== */}
      {shareModal && (
        <div className="share-modal-overlay" onClick={() => { setShareModal(null); setShareCopied(false); }}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3><i className="fas fa-share-alt"></i> {t('dashboard.share')}</h3>
              <button className="share-modal-close" onClick={() => { setShareModal(null); setShareCopied(false); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="share-modal-body">
              <p className="share-modal-label">{t('dashboard.shareLink')}</p>
              <div className="share-link-row">
                <input type="text" className="share-link-input" value={shareModal.url} readOnly onClick={(e) => e.target.select()} />
                <button className="share-copy-btn" onClick={handleCopyShareLink}>
                  <i className={`fas ${shareCopied ? 'fa-check' : 'fa-copy'}`}></i>
                  {shareCopied ? t('dashboard.copied') : t('dashboard.copy')}
                </button>
              </div>
            </div>
            <div className="share-modal-footer">
              <button className="share-revoke-btn" onClick={handleRevokeShareLink}>
                <i className="fas fa-unlink"></i> {t('dashboard.revokeLink')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Link picker modal for table view ===== */}
      {linkPickerFor && viewMode === 'table' && (
        <div className="share-modal-overlay" onClick={() => { setLinkPickerFor(null); setLinkPickerValue(''); }}>
          <div className="share-modal link-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3><i className="fas fa-link"></i> {t('dashboard.linkToResume')}</h3>
              <button className="share-modal-close" onClick={() => { setLinkPickerFor(null); setLinkPickerValue(''); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="share-modal-body">
              <select value={linkPickerValue} onChange={(e) => setLinkPickerValue(e.target.value)} className="link-modal-select">
                <option value="">{t('dashboard.selectResume')}</option>
                {availableResumes.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
              <button className="share-copy-btn" disabled={!linkPickerValue} onClick={() => { if (linkPickerValue) handleLinkDocument(linkPickerFor, Number(linkPickerValue)); }}>
                <i className="fas fa-check"></i> {t('dashboard.linkConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDashboard;
'''

with open(TARGET, 'w') as f:
    f.write(CONTENT)
print(f'Written {len(CONTENT)} bytes to {TARGET}')
