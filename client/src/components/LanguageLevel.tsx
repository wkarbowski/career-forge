import React from 'react';

interface LanguageLevelProps {
  level: number | null;
  onChange: (level: number | null) => void;
}

const LanguageLevel = ({ level, onChange }: LanguageLevelProps) => {
  return (
    <div className="language-level">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={level && i <= level ? 'active' : ''}
          onClick={() => onChange(level === i ? null : i)}
          style={{ cursor: 'pointer' }}
        ></span>
      ))}
    </div>
  );
};

export default LanguageLevel;
