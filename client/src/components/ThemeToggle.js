import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const label = isDark
    ? (t('accessibility.switchToLight') || 'Switch to light mode')
    : (t('accessibility.switchToDark') || 'Switch to dark mode');

  return (
    <button
      onClick={toggleTheme}
      className="secondary"
      style={{
        padding: '10px 16px',
        borderRadius: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
      }}
      title={label}
      aria-label={label}
    >
      <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'}></i>
    </button>
  );
};

export default ThemeToggle;
