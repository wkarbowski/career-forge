import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';

const AccountSettings = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('account.passwordMismatch') });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: t('account.passwordTooShort') });
      return;
    }
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: t('account.passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: t('account.passwordChangeFailed') });
    }
  };

  const handleLogoutAll = async () => {
    try {
      await authApi.logoutAllDevices();
      setMessage({ type: 'success', text: t('account.loggedOutAll') });
    } catch (err) {
      setMessage({ type: 'error', text: t('account.logoutAllFailed') });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await authApi.deleteAccount();
      logout();
    } catch (err) {
      setMessage({ type: 'error', text: t('account.deleteFailed') });
    }
  };

  return (
    <div className="account-settings">
      <h2><i className="fas fa-cog"></i> {t('account.title')}</h2>

      {message && (
        <div className={`account-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <section className="account-section">
        <h3>{t('account.profile')}</h3>
        <div className="account-field">
          <label>{t('account.email')}</label>
          <span>{user?.email || '—'}</span>
        </div>
      </section>

      <section className="account-section">
        <h3>{t('account.changePassword')}</h3>
        <form onSubmit={handleChangePassword} className="account-form">
          <input
            type="password"
            placeholder={t('account.currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <input
            type="password"
            placeholder={t('account.newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder={t('account.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button type="submit">{t('account.updatePassword')}</button>
        </form>
      </section>

      <section className="account-section">
        <h3>{t('account.security')}</h3>
        <button className="account-btn secondary" onClick={handleLogoutAll}>
          <i className="fas fa-sign-out-alt"></i> {t('account.logoutAllDevices')}
        </button>
      </section>

      <section className="account-section danger-zone">
        <h3>{t('account.dangerZone')}</h3>
        {!confirmDelete ? (
          <button className="account-btn danger" onClick={() => setConfirmDelete(true)}>
            <i className="fas fa-trash"></i> {t('account.deleteAccount')}
          </button>
        ) : (
          <div className="account-confirm-delete">
            <p>{t('account.deleteConfirm')}</p>
            <button className="account-btn danger" onClick={handleDeleteAccount}>
              {t('account.deleteYes')}
            </button>
            <button className="account-btn secondary" onClick={() => setConfirmDelete(false)}>
              {t('account.deleteNo')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccountSettings;
