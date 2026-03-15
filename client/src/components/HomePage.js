import React from 'react';
import { useTranslation } from '../i18n';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import './HomePage.css';

const HomePage = ({ onLogin, onGuestStart, onBrowseTemplates, isLoggedIn, isGuest }) => {
  const { t } = useTranslation();

  return (
    <div className="home-page">
      {!isLoggedIn && !isGuest && (
        <div className="home-controls">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      )}
      
      <div className="home-content">
        <div className="home-hero">
          <div className="home-icon">
            <i className="fas fa-hammer"></i>
          </div>
          <h1>{t('home.title')}</h1>
          <p className="home-subtitle">{t('home.subtitle')}</p>
        </div>

        <div className="home-features">
          <div className="feature">
            <i className="fas fa-palette"></i>
            <span>{t('home.feature1')}</span>
          </div>
          <div className="feature">
            <i className="fas fa-language"></i>
            <span>{t('home.feature2')}</span>
          </div>
          <div className="feature">
            <i className="fas fa-download"></i>
            <span>{t('home.feature3')}</span>
          </div>
        </div>

        <div className="home-actions">
          {isLoggedIn || isGuest ? (
            <>
              <button className="btn-primary" onClick={onGuestStart}>
                <i className="fas fa-edit"></i>
                {t('home.goToEditor')}
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={onLogin}>
                <i className="fas fa-sign-in-alt"></i>
                {t('home.loginButton')}
              </button>
              <div className="or-divider">
                <span>{t('home.or')}</span>
              </div>
              <button className="btn-secondary" onClick={onGuestStart}>
                <i className="fas fa-user-clock"></i>
                {t('home.guestButton')}
              </button>
              <p className="guest-note">{t('home.guestNote')}</p>
            </>
          )}
        </div>

        <div className="home-templates-link">
          <button className="btn-link" onClick={onBrowseTemplates}>
            <i className="fas fa-th-large"></i>
            {t('home.browseTemplates')}
          </button>
        </div>
      </div>

      <footer className="home-footer">
        <p>{t('home.footer')}</p>
      </footer>
    </div>
  );
};

export default HomePage;
