import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import './GdprBanner.css';

const GDPR_KEY = 'gdpr_consent_v1';

export const hasGdprConsent = () => {
  try {
    return localStorage.getItem(GDPR_KEY) === 'accepted';
  } catch {
    return false;
  }
};

const GdprBanner = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GDPR_KEY);
      if (!stored) setVisible(true);
    } catch {
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(GDPR_KEY, 'accepted'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="gdpr-banner" role="dialog" aria-live="polite" aria-label={t('gdpr.bannerLabel') || 'Cookie and privacy notice'}>
      <div className="gdpr-banner-content">
        <svg className="gdpr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <div className="gdpr-text">
          <strong>{t('gdpr.title') || 'Privacy Notice'}</strong>
          <p>
            {t('gdpr.body') ||
              'Career Forge stores your resume and cover letter data on our servers and uses strictly necessary authentication cookies (HttpOnly). All fonts and icons are self-hosted — no data is sent to Google, Cloudflare, or any third party.'}
            {' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              {t('gdpr.learnMore') || 'Privacy Policy'}
            </a>
          </p>
        </div>
        <div className="gdpr-actions">
          <button className="gdpr-btn gdpr-accept" onClick={accept}>
            {t('gdpr.accept') || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GdprBanner;
