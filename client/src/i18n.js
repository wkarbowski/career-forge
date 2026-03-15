import React, { createContext, useContext, useState } from 'react';
import en from './locales/en.json';
import de from './locales/de.json';

const locales = { en, de };

const I18nContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k });

export const I18nProvider = ({ children, defaultLang = 'en' }) => {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('career-forge-lang');
    return saved && locales[saved] ? saved : defaultLang;
  });

  const changeLang = (newLang) => {
    if (locales[newLang]) {
      setLang(newLang);
      localStorage.setItem('career-forge-lang', newLang);
    }
  };

  const t = (key) => {
    const parts = key.split('.');
    let node = locales[lang] || locales.en;
    for (const p of parts) {
      if (node && Object.prototype.hasOwnProperty.call(node, p)) node = node[p];
      else return key;
    }
    return node;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t, availableLanguages: Object.keys(locales) }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) return { t: (k) => k, lang: 'en', setLang: () => {}, availableLanguages: ['en'] };
  return { t: ctx.t, lang: ctx.lang, setLang: ctx.setLang, availableLanguages: ctx.availableLanguages };
};

export default I18nContext;
