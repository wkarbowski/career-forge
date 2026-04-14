import React from 'react';

// Helper to format YYYY-MM to MM/YYYY
function formatMonthYear(value: string): string {
  if (!value) return '';
  const [year, month] = value.split('-');
  if (!year || !month) return '';
  return `${month}/${year}`;
}

// Helper to parse MM/YYYY to YYYY-MM
function parseMonthYear(value: string): string {
  if (!value) return '';
  const [month, year] = value.split('/');
  if (!month || !year) return '';
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}`;
}

interface DateRangeInputProps {
  start?: string;
  end?: string;
  onChange: (value: { start: string; end: string }) => void;
  placeholder?: string;
  className?: string;
}

export default function DateRangeInput({
  start = '',
  end = '',
  onChange,
  placeholder = 'MM/YYYY',
  className = '',
}: DateRangeInputProps) {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({ start: val, end });
  };
  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
