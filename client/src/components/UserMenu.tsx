import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import { documentApi } from '../services/api';

interface UserMenuProps {
  onLogin: () => void;
  onLoadDocument: (id: number | string) => void;
  onExitGuest: () => void;
}

const UserMenu = ({ onLogin, onLoadDocument, onExitGuest }: UserMenuProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showCvList, setShowCvList] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [operationError, setOperationError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    user,
    isAuthenticated,
    isGuest,
    logout,
    documentList,
    currentDocumentId,
    deleteDocument
  } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCvList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setIsOpen(false);
    navigate('/');
  };

  const handleExportAllData = async () => {
    // Export all documents as a single JSON file for GDPR data portability
    try {
      const exports = await Promise.all(
        documentList.map(doc => documentApi.get(String(doc.id)))
      );
      const blob = new Blob(
        [JSON.stringify({ exported_at: new Date().toISOString(), documents: exports }, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `career-forge-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setOperationError('Export failed: ' + (err as Error).message);
    }
  };

  const handleLoadDocument = (docId: number | string) => {
    onLoadDocument(docId);
    setIsOpen(false);
    setShowCvList(false);
  };

  const handleShowDashboard = () => {
    navigate('/dashboard');
    setIsOpen(false);
  };

  const handleDeleteDocument = async (e: React.MouseEvent, cvId: number | string) => {
    e.stopPropagation();
    if (window.confirm(t('userMenu.confirmDelete'))) {
      await deleteDocument(cvId);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (isGuest) {
    return (
      <div className="user-menu guest-menu" ref={menuRef}>
        <button className="user-menu-login-btn" onClick={onLogin}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {t('auth.login')}
        </button>
        <button className="user-menu-exit-btn" onClick={onExitGuest} title={t('toolbar.exitGuest')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <button className="user-menu-login-btn" onClick={onLogin}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        {t('auth.login')}
      </button>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="user-avatar">
          {user?.username.charAt(0).toUpperCase()}
        </div>
        <span className="user-name">{user?.username}</span>
        <svg
          className={`user-menu-arrow ${isOpen ? 'open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <span className="user-email">{user?.email}</span>
          </div>

          {operationError && (
            <div className="user-menu-error" role="alert">
              <i className="fas fa-exclamation-triangle"></i>
              {operationError}
              <button className="user-menu-error-close" onClick={() => setOperationError('')} aria-label="Dismiss">×</button>
            </div>
          )}

          {/* Documents Section */}
          <div className="user-menu-section">
            <div className="user-menu-section-label">{t('userMenu.documents') || 'Documents'}</div>
            <button className="user-menu-item dashboard" onClick={handleShowDashboard} role="menuitem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              {t('userMenu.dashboard')}
            </button>

            <button
              className="user-menu-item"
              onClick={() => setShowCvList(!showCvList)}
              aria-expanded={showCvList}
              role="menuitem"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {t('userMenu.myCvs')} ({documentList.length})
              <svg
                className={`submenu-arrow ${showCvList ? 'open' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {showCvList && (
              <div className="cv-list-submenu">
                {documentList.length === 0 ? (
                  <div className="cv-list-empty">{t('userMenu.noCvs')}</div>
                ) : (
                  documentList.map((doc) => (
                    <div
                      key={doc.id}
                      className={`cv-list-item ${doc.id === currentDocumentId ? 'active' : ''}`}
                      onClick={() => handleLoadDocument(doc.id)}
                    >
                      <div className="cv-list-item-info">
                        <span className="cv-title">{doc.title}</span>
                        <span className="cv-date">{formatDate(doc.updated_at ?? '')}</span>
                      </div>
                      <button
                        className="cv-delete-btn"
                        onClick={(e) => handleDeleteDocument(e, doc.id)}
                        title={t('dashboard.delete') || 'Delete document'}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="user-menu-divider" />

          {/* Session Section */}
          <div className="user-menu-section">
            <div className="user-menu-section-label">{t('userMenu.session') || 'Session'}</div>
            <button
              className="user-menu-item logout"
              onClick={handleLogout}
              disabled={loggingOut}
              role="menuitem"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {loggingOut ? t('auth.loggingOut') || 'Logging out...' : t('auth.logout')}
            </button>
          </div>

          <div className="user-menu-divider" />

          {/* Data & Privacy Section */}
          <div className="user-menu-section">
            <div className="user-menu-section-label">{t('userMenu.dataPrivacy') || 'Data & Privacy'}</div>

            <button
              className="user-menu-item"
              onClick={() => { navigate('/account'); setIsOpen(false); }}
              role="menuitem"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {t('account.title') || 'Account Settings'}
            </button>
            <button
              className="user-menu-item export-data"
              onClick={handleExportAllData}
              title={t('userMenu.exportDataTooltip') || 'Download all your CV data as JSON (GDPR data portability)'}
              role="menuitem"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('userMenu.exportData') || 'Export My Data'}
            </button>

            <a
              className="user-menu-item privacy-link"
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {t('userMenu.privacyPolicy') || 'Privacy Policy'}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
