import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { I18nContextValue } from './types';
import en from './locales/en.json';
import de from './locales/de.json';

type LocaleData = Record<string, unknown>;

const locales: Record<string, LocaleData> = { en, de };

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k: string) => k,
  availableLanguages: ['en'],
});

interface I18nProviderProps {
  children: ReactNode;
  defaultLang?: string;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children, defaultLang = 'en' }) => {
  const [lang, setLang] = useState<string>(() => {
    const saved = localStorage.getItem('career-forge-lang');
    return saved && locales[saved] ? saved : defaultLang;
  });

  const changeLang = (newLang: string): void => {
    if (locales[newLang]) {
      setLang(newLang);
      localStorage.setItem('career-forge-lang', newLang);
    }
  };

  const t = (key: string): string => {
    const parts = key.split('.');
    let node: unknown = locales[lang] || locales.en;
    for (const p of parts) {
      if (node && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, p)) {
        node = (node as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    return typeof node === 'string' ? node : key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t, availableLanguages: Object.keys(locales) }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) return { t: (k: string) => k, lang: 'en', setLang: () => {}, availableLanguages: ['en'] };
  return { t: ctx.t, lang: ctx.lang, setLang: ctx.setLang, availableLanguages: ctx.availableLanguages };
};

export default I18nContext;
