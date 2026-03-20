import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';

/**
 * AuthModal — base: local email + password authentication only.
 *
 * Extension pattern:
 *   Pass an `extraProviders` node to inject OAuth/SSO buttons without
 *   modifying this file:
 *
 *     import OAuthButtons from '../cloud/components/OAuthButtons';
 *     <AuthModal extraProviders={<OAuthButtons onSuccess={...} />} />
 *
 *   Extended callers may pass a PdfExportButton; default callers omit the prop.
 */
const AuthModal = ({ isOpen, onClose, onSuccess, extraProviders = null }) => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef(null);

  const { login, register, error, clearError } = useAuth();
  const { t } = useTranslation();

  // Focus trap + Escape key handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus first input on open
    const timer = setTimeout(() => {
      const firstInput = modalRef.current?.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError(t('auth.passwordsNoMatch'));
        return;
      }
      if (password.length < 6) {
        setLocalError(t('auth.passwordTooShort'));
        return;
      }
      if (username.length < 3) {
        setLocalError(t('auth.usernameTooShort'));
        return;
      }
      if (!gdprConsent) {
        setLocalError(t('auth.consentRequired'));
        return;
      }
    }

    setIsSubmitting(true);
    
    let result;
    if (mode === 'login') {
      result = await login(email, password);
    } else {
      result = await register(email, username, password);
    }

    setIsSubmitting(false);

    if (result.success) {
      resetForm();
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    }
  };

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setGdprConsent(false);
    setLocalError('');
    clearError();
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const displayError = localError || error;

  return (
    <div className="auth-modal-overlay" onClick={handleClose} role="presentation">
      <div className="auth-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="auth-modal-close" onClick={handleClose} aria-label={t('common.cancel') || 'Close'}>×</button>
        
        <h2 id="auth-modal-title">{mode === 'login' ? t('auth.login') : t('auth.register')}</h2>
        
        {displayError && (
          <div className="auth-error">{displayError}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="username">{t('auth.username')}</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                autoComplete="username"
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="auth-field auth-consent">
              <label className="auth-consent-label">
                <input
                  type="checkbox"
                  checked={gdprConsent}
                  onChange={(e) => setGdprConsent(e.target.checked)}
                />
                <span>
                  {t('auth.consentText')}{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    {t('auth.privacyPolicy')}
                  </a>
                  {t('auth.consentTextEnd')}
                </span>
              </label>
            </div>
          )}

          <button 
            type="submit" 
            className="auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.pleaseWait') : (mode === 'login' ? t('auth.login') : t('auth.register'))}
          </button>
        </form>

        {/* Slot for extended OAuth / SSO providers */}
        {extraProviders && (
          <div className="auth-extra-providers">
            <div className="auth-divider"><span>or</span></div>
            {extraProviders}
          </div>
        )}

        <div className="auth-switch">
          {mode === 'login' ? (
            <p>{t('auth.noAccount')} <button type="button" onClick={switchMode}>{t('auth.signUp')}</button></p>
          ) : (
            <p>{t('auth.hasAccount')} <button type="button" onClick={switchMode}>{t('auth.login')}</button></p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
