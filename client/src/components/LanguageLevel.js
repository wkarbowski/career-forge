import React from 'react';

const LanguageLevel = ({ level, onChange }) => {
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
