import React from 'react';
import { useTranslation } from '../i18n';

const languageNames = {
  en: 'EN',
  de: 'DE',
};

const LanguageSwitcher = () => {
  const { lang, setLang, availableLanguages } = useTranslation();

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      title="Change language"
    >
      {availableLanguages.map((code) => (
        <option key={code} value={code}>
          {languageNames[code] || code.toUpperCase()}
        </option>
      ))}
    </select>
  );
};

export default LanguageSwitcher;
