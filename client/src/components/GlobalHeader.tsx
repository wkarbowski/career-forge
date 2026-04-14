import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import AuthModal from './AuthModal';
import './GlobalHeader.css';

interface GlobalHeaderProps {
  onLoadDocument?: (id: string) => void;
  saveStatus?: 'saving' | 'saved' | 'error' | null;
}

const GlobalHeader = ({ onLoadDocument, saveStatus }: GlobalHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, isGuest, exitGuestMode, currentDocumentId } = useAuth();
  const { t } = useTranslation();

  const isHomePage = location.pathname === '/';
  const isEditor = location.pathname.startsWith('/editor');
  const isTemplates = location.pathname === '/templates';
  const isDashboard = location.pathname === '/dashboard';

  const handleExitGuest = () => {
    exitGuestMode();
    navigate('/');
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    navigate('/dashboard');
  };

  if (isHomePage && !isAuthenticated && !isGuest) {
    return null;
  }

  return (
    <>
      <header className="global-header">
        <div className="header-left">
          <button 
            className="header-logo" 
            onClick={() => navigate('/')}
          >
            <i className="fas fa-hammer"></i>
            <span>Career Forge</span>
          </button>

          {(isAuthenticated || isGuest) && (
            <nav className="header-nav">
              <button 
                className={`nav-item ${isEditor ? 'active' : ''}`}
                onClick={() => {
                  if (currentDocumentId && currentDocumentId !== 'template') {
                    navigate(`/editor/${currentDocumentId}`);
                    return;
                  }
                  navigate('/editor');
                }}
              >
                <i className="fas fa-edit"></i>
                <span>{t('nav.editor')}</span>
              </button>
              <button 
                className={`nav-item ${isTemplates ? 'active' : ''}`}
                onClick={() => navigate('/templates')}
              >
                <i className="fas fa-palette"></i>
                <span>{t('nav.templates')}</span>
              </button>
              {isAuthenticated && (
                <button 
                  className={`nav-item ${isDashboard ? 'active' : ''}`}
                  onClick={() => navigate('/dashboard')}
                >
                  <i className="fas fa-th-large"></i>
                  <span>{t('nav.dashboard')}</span>
                </button>
              )}
            </nav>
          )}
        </div>

        <div className="header-right">
          {isGuest && (
            <span className="guest-mode-badge">
              <i className="fas fa-user-clock"></i>
              <span>{t('toolbar.guestMode')}</span>
            </span>
          )}
          
          {isAuthenticated && saveStatus && (
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' && <><i className="fas fa-spinner fa-spin"></i> {t('saveStatus.saving')}</>}
              {saveStatus === 'saved' && <><i className="fas fa-check"></i> {t('saveStatus.saved')}</>}
              {saveStatus === 'error' && <><i className="fas fa-exclamation-triangle"></i> {t('saveStatus.error')}</>}
            </span>
          )}

          <LanguageSwitcher />
          <ThemeToggle />
          
          <UserMenu 
            onLogin={() => setShowAuthModal(true)} 
            onLoadDocument={onLoadDocument ?? (() => {})}
            onExitGuest={handleExitGuest}
          />
        </div>
      </header>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={handleAuthSuccess}
      />

      {isGuest && isEditor && (
        <div className="guest-warning-banner">
          <i className="fas fa-exclamation-triangle"></i>
          <span>{t('guest.warningBanner')}</span>
          <button className="guest-warning-signup" onClick={() => setShowAuthModal(true)}>
            {t('guest.signUpNow')}
          </button>
        </div>
      )}
    </>
  );
};

export default GlobalHeader;
