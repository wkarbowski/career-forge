import React from 'react';

// Helper to format YYYY-MM to MM/YYYY
function formatMonthYear(value) {
  if (!value) return '';
  const [year, month] = value.split('-');
  if (!year || !month) return '';
  return `${month}/${year}`;
}

// Helper to parse MM/YYYY to YYYY-MM
function parseMonthYear(value) {
  if (!value) return '';
  const [month, year] = value.split('/');
  if (!month || !year) return '';
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}`;
}

export default function DateRangeInput({
  start = '',
  end = '',
  onChange,
  placeholder = 'MM/YYYY',
  className = '',
}) {
  // Accepts and emits values as YYYY-MM
  const handleStartChange = (e) => {
    const val = e.target.value;
    onChange({ start: val, end });
  };
  const handleEndChange = (e) => {
    const val = e.target.value;
    onChange({ start, end: val });
  };

  return (
    <span className={`date-range-input ${className}`.trim()}>
      <input
        type="month"
        value={start}
        onChange={handleStartChange}
        placeholder={placeholder}
        className="date-range-input-start"
      />
      <span className="date-range-separator"> - </span>
      <input
        type="month"
        value={end}
        onChange={handleEndChange}
        placeholder={placeholder}
        className="date-range-input-end"
      />
    </span>
  );
}
