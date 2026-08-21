import { useTranslation } from '../i18n';
import ToolbarDropdown from './ToolbarDropdown';

const languageNames: Record<string, string> = {
  en: 'EN',
  de: 'DE',
};

const LanguageSwitcher = () => {
  const { lang, setLang, availableLanguages, t } = useTranslation();

  const groups = [
    {
      label: '',
      options: availableLanguages.map((code) => ({
        value: code,
        label: languageNames[code] || code.toUpperCase(),
      })),
    },
  ];

  return (
    <ToolbarDropdown
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      groups={groups}
      ariaLabel={t('accessibility.changeLanguage') || 'Change language'}
      className="language-switcher-dropdown"
    />
  );
};

export default LanguageSwitcher;
