import { useTranslation } from '../i18n';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import './HomePage.css';

interface HomePageProps {
  onLogin: () => void;
  onGuestStart: () => void;
  onBrowseTemplates: () => void;
  isLoggedIn: boolean;
  isGuest: boolean;
}

const HomePage = ({ onLogin, onGuestStart, onBrowseTemplates, isLoggedIn, isGuest }: HomePageProps) => {
  const { t } = useTranslation();

  const features = [
    { icon: 'fas fa-palette', titleKey: 'home.featureTitle1', descKey: 'home.featureDesc1', fallbackTitle: 'Beautiful Templates', fallbackDesc: 'Choose from professional, modern, and creative designs tailored for any industry.' },
    { icon: 'fas fa-language', titleKey: 'home.featureTitle2', descKey: 'home.featureDesc2', fallbackTitle: 'Multi‑Language', fallbackDesc: 'Build your CV in English or German with full UI and content localization.' },
    { icon: 'fas fa-file-pdf', titleKey: 'home.featureTitle3', descKey: 'home.featureDesc3', fallbackTitle: 'Export Anywhere', fallbackDesc: 'Download as PDF, PNG, or JSON. Print directly from the editor.' },
    { icon: 'fas fa-lock', titleKey: 'home.featureTitle4', descKey: 'home.featureDesc4', fallbackTitle: 'Privacy First', fallbackDesc: 'All fonts and assets are self‑hosted. No data is sent to third parties.' },
  ];

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
          <div className="home-icon" aria-hidden="true">
            <i className="fas fa-hammer"></i>
          </div>
          <h1>{t('home.title')}</h1>
          <p className="home-subtitle">{t('home.subtitle')}</p>
        </div>

        <div className="home-features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-card-icon" aria-hidden="true">
                <i className={f.icon}></i>
              </div>
              <h3 className="feature-card-title">{t(f.titleKey) || f.fallbackTitle}</h3>
              <p className="feature-card-desc">{t(f.descKey) || f.fallbackDesc}</p>
            </div>
          ))}
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
