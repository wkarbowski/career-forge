import React from 'react';

const LanguageLevel = ({ level, onChange }) => {
  return (
    <div className="language-level" onClick={() => onChange((level % 5) + 1)}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= level ? 'active' : ''}></span>
      ))}
    </div>
  );
};

export default LanguageLevel;
