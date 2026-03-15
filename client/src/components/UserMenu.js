import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import { documentApi } from '../services/api';

const UserMenu = ({ onLogin, onLoadDocument, onExitGuest }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showCvList, setShowCvList] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [operationError, setOperationError] = useState('');
  const menuRef = useRef(null);

  const { 
    user, 
    isAuthenticated,
    isGuest,
    logout,
    logoutAllDevices,
    deleteAccount,
    documentList, 
    currentDocumentId, 
    createNewDocument, 
    deleteDocument 
  } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
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

  const handleLogoutAllDevices = async () => {
    if (window.confirm(t('userMenu.confirmLogoutAll') || 'This will log you out from all devices. Continue?')) {
      setLoggingOut(true);
      await logoutAllDevices();
      setLoggingOut(false);
      setIsOpen(false);
      navigate('/');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmMsg = t('userMenu.confirmDeleteAccount') ||
      'This will permanently delete your account and all your CV data. This cannot be undone. Type DELETE to confirm.';
    const input = window.prompt(confirmMsg);
    if (input !== 'DELETE') return;
    setLoggingOut(true);
    const result = await deleteAccount();
    setLoggingOut(false);
    if (!result.success) {
      setOperationError(result.error || 'Failed to delete account');
      return;
    }
    setIsOpen(false);
    navigate('/');
  };

  const handleExportAllData = async () => {
    // Export all CVs as a single JSON file for GDPR data portability
    try {
      const exports = await Promise.all(
        documentList.map(doc => documentApi.get(doc.id))
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
      setOperationError('Export failed: ' + err.message);
    }
  };

  const handleLoadDocument = (docId) => {
    onLoadDocument(docId);
    setIsOpen(false);
    setShowCvList(false);
  };

  const handleNewDocument = () => {
    createNewDocument();
    onLoadDocument(null); // Signal to create new document
    setIsOpen(false);
  };

  const handleShowDashboard = () => {
    navigate('/dashboard');
    setIsOpen(false);
  };

  const handleDeleteDocument = async (e, cvId) => {
    e.stopPropagation();
    if (window.confirm(t('userMenu.confirmDelete'))) {
      await deleteDocument(cvId);
    }
  };

  const formatDate = (dateStr) => {
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
          {user.username.charAt(0).toUpperCase()}
        </div>
        <span className="user-name">{user.username}</span>
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
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <span className="user-email">{user.email}</span>
          </div>

          {operationError && (
            <div className="user-menu-error" role="alert">
              <i className="fas fa-exclamation-triangle"></i>
              {operationError}
              <button className="user-menu-error-close" onClick={() => setOperationError('')} aria-label="Dismiss">×</button>
            </div>
          )}

          <div className="user-menu-section">
            <button 
              className="user-menu-item"
              onClick={() => setShowCvList(!showCvList)}
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
                        <span className="cv-date">{formatDate(doc.updated_at)}</span>
                      </div>
                      <button 
                        className="cv-delete-btn"
                        onClick={(e) => handleDeleteDocument(e, doc.id)}
                        title="Delete document"
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

            <button className="user-menu-item" onClick={handleNewDocument}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('userMenu.newCv')}
            </button>

            <button className="user-menu-item dashboard" onClick={handleShowDashboard}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              {t('userMenu.dashboard')}
            </button>
          </div>

          <div className="user-menu-divider" />

          <button 
            className="user-menu-item logout" 
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {loggingOut ? t('auth.loggingOut') || 'Logging out...' : t('auth.logout')}
          </button>
          
          <button 
            className="user-menu-item logout-all" 
            onClick={handleLogoutAllDevices}
            disabled={loggingOut}
            title={t('userMenu.logoutAllTooltip') || 'Log out from all browsers and devices'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
              <circle cx="5" cy="18" r="1.5" fill="currentColor" />
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="5" cy="6" r="1.5" fill="currentColor" />
            </svg>
            {t('userMenu.logoutAll') || 'Logout All Devices'}
          </button>

          <div className="user-menu-divider" />

          <button
            className="user-menu-item export-data"
            onClick={handleExportAllData}
            title={t('userMenu.exportDataTooltip') || 'Download all your CV data as JSON (GDPR data portability)'}
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
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t('userMenu.privacyPolicy') || 'Privacy Policy'}
          </a>

          <button
            className="user-menu-item delete-account"
            onClick={handleDeleteAccount}
            disabled={loggingOut}
            title={t('userMenu.deleteAccountTooltip') || 'Permanently delete your account (GDPR right to erasure)'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            {t('userMenu.deleteAccount') || 'Delete Account'}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
