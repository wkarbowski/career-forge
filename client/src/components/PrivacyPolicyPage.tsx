import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import './PrivacyPolicyPage.css';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <button className="privacy-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('gdpr.back') || 'Back'}
        </button>

        <h1>{t('gdpr.privacyTitle') || 'Privacy Policy'}</h1>
        <p className="privacy-updated">{t('gdpr.lastUpdated') || 'Last updated: February 2026'}</p>

        <section>
          <h2>1. {t('gdpr.s1Title') || 'Controller'}</h2>
          <p>
            {t('gdpr.s1Body') ||
              'Career Forge is an open-source web application. The data controller is the operator of the instance you are using. Please contact the site operator for data-protection queries.'}
          </p>
        </section>

        <section>
          <h2>2. {t('gdpr.s2Title') || 'Data We Collect'}</h2>
          <ul>
            <li><strong>{t('gdpr.s2AccountData') || 'Account data'}</strong> — e-mail address, username, hashed password (collected on registration; legal basis: performance of contract, Art. 6(1)(b) GDPR).</li>
            <li><strong>{t('gdpr.s2CvData') || 'Document content'}</strong> — all text, formatting, and uploaded profile images you enter into the editor (legal basis: performance of contract).</li>
            <li><strong>{t('gdpr.s2AuthTokens') || 'Authentication tokens'}</strong> — an access token stored in <code>localStorage</code> and a refresh token stored as an HttpOnly cookie restricted to <code>/api/auth</code>. These are strictly necessary for the service and do not require consent.</li>
            <li><strong>{t('gdpr.s2LocalStorage') || 'Editor state'}</strong> — draft CV content is stored in <code>localStorage</code> for offline resilience. No tracking data is stored.</li>
            <li><strong>{t('gdpr.s2IpLogs') || 'Security logs'}</strong> — IP address and browser User-Agent are recorded for security audit purposes (failed logins, account lockouts) under legitimate interest, Art. 6(1)(f) GDPR.</li>
          </ul>
        </section>

        <section>
          <h2>3. {t('gdpr.s3Title') || 'Third-Party Services'}</h2>
          <p>
            {t('gdpr.s3None') ||
              'Career Forge does not use any third-party services that receive your personal data. All web fonts are self-hosted from dependencies bundled with the application. All UI icons (Font Awesome) are bundled locally. No analytics, advertising, tracking, or telemetry services are used. No data is sent to Google, Cloudflare, Meta, or any other external party.'}
          </p>
        </section>

        <section>
          <h2>4. {t('gdpr.s4Title') || 'Data Retention'}</h2>
          <p>
            {t('gdpr.s4Body') ||
              'Your account data and CVs are retained for as long as your account exists. Security audit logs are retained for a maximum of 90 days. You can delete your account at any time (see Your Rights below).'}
          </p>
        </section>

        <section>
          <h2>5. {t('gdpr.s5Title') || 'Your Rights (GDPR, Arts. 15–22)'}</h2>
          <ul>
            <li><strong>Right of access (Art. 15)</strong> — request a copy of your data.</li>
            <li><strong>Right to rectification (Art. 16)</strong> — correct inaccurate data via the editor.</li>
            <li><strong>Right to erasure (Art. 17)</strong> — permanently delete your account via <em>User Menu → Delete Account</em>. All documents, profile images, and tokens are deleted immediately.</li>
            <li><strong>Right to data portability (Art. 20)</strong> — export all your document data as JSON via <em>User Menu → Export My Data</em>.</li>
            <li><strong>Right to object (Art. 21)</strong> — object to processing based on legitimate interest by contacting the site operator.</li>
            <li><strong>Right to withdraw consent</strong> — clear your browser's <code>localStorage</code> key <code>gdpr_consent_v1</code> to withdraw the privacy acknowledgement at any time.</li>
          </ul>
        </section>

        <section>
          <h2>6. {t('gdpr.s6Title') || 'Cookies'}</h2>
          <table className="privacy-table">
            <thead>
              <tr>
                <th>{t('gdpr.cookieName') || 'Cookie'}</th>
                <th>{t('gdpr.cookiePurpose') || 'Purpose'}</th>
                <th>{t('gdpr.cookieType') || 'Type'}</th>
                <th>{t('gdpr.cookieExpiry') || 'Expiry'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>refresh_token</code></td>
                <td>Keeps you logged in across browser sessions</td>
                <td>Strictly necessary</td>
                <td>30 days</td>
              </tr>
              <tr>
                <td><code>gdpr_consent_v1</code></td>
                <td>Stores your cookie consent choice</td>
                <td>Strictly necessary</td>
                <td>Persistent (localStorage)</td>
              </tr>
              <tr>
                <td><code>cv_auth_token</code></td>
                <td>Short-lived JWT access token for API requests</td>
                <td>Strictly necessary</td>
                <td>15–60 minutes (localStorage)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>7. {t('gdpr.s7Title') || 'Contact'}</h2>
          <p>
            {t('gdpr.s7Body') ||
              'To exercise your rights or raise a data-protection concern, please contact the operator of this Career Forge instance. You also have the right to lodge a complaint with your national supervisory authority (e.g. the BfDI in Germany or the ICO in the UK).'}
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
