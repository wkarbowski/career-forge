import React from 'react';
import { useTranslation } from '../i18n';

import type { CVData } from '../types';

const hasText = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const plainText = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return plainText.length > 0;
};

const checks: Array<{ key: string; test: (d: CVData) => boolean }> = [
  { key: 'name', test: (d) => hasText(d.name) },
  { key: 'email', test: (d) => hasText(d.contact?.email) },
  { key: 'phone', test: (d) => hasText(d.contact?.phone) },
  { key: 'summary', test: (d) => hasText(d.summary) },
  { key: 'experience', test: (d) => (d.experience?.length ?? 0) > 0 },
  { key: 'education', test: (d) => (d.education?.length ?? 0) > 0 },
  { key: 'skills', test: (d) => (d.skills?.length ?? 0) > 0 },
  { key: 'languages', test: (d) => (d.languages?.length ?? 0) > 0 },
];

interface ProfileCompletenessProps {
  data: CVData;
}

const ProfileCompleteness = ({ data }: ProfileCompletenessProps) => {
  const { t } = useTranslation();
  if (!data) return null;

  const results = checks.map((c) => ({ key: c.key, passed: !!c.test(data) }));
  const passed = results.filter((r) => r.passed).length;
  const pct = Math.round((passed / checks.length) * 100);

  const color = pct >= 80 ? 'var(--accent-color, #4caf50)' : pct >= 50 ? '#ff9800' : '#f44336';

  return (
    <div className="profile-completeness">
      <div className="pc-header">
        <span className="pc-label">{t('completeness.title')}</span>
        <span className="pc-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="pc-bar">
        <div className="pc-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <ul className="pc-checklist">
        {results.map((r) => (
          <li key={r.key} className={r.passed ? 'done' : 'missing'}>
            <i className={`fas ${r.passed ? 'fa-check-circle' : 'fa-circle'}`}></i>
            {t(`completeness.${r.key}`)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProfileCompleteness;
