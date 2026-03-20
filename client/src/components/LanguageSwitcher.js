import React from 'react';
import { useTranslation } from '../i18n';

const languageNames = {
  en: 'EN',
  de: 'DE',
};

const LanguageSwitcher = () => {
  const { lang, setLang, availableLanguages, t } = useTranslation();

  return (
    <label className="language-switcher-label" style={{ display: 'contents' }}>
      <span className="sr-only">{t('accessibility.changeLanguage') || 'Change language'}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label={t('accessibility.changeLanguage') || 'Change language'}
      >
        {availableLanguages.map((code) => (
          <option key={code} value={code}>
            {languageNames[code] || code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSwitcher;
