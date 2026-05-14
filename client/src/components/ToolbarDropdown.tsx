import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ToolbarDropdown.css';

interface DropdownOption {
  value: string;
  label: string;
  style?: React.CSSProperties;
}

interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

interface ToolbarDropdownProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  groups: DropdownGroup[];
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}

const ToolbarDropdown = ({ value, onChange, groups, className = '', ariaLabel, placeholder }: ToolbarDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => groups.flatMap((group) => group.options.map((option) => ({ ...option, groupLabel: group.label }))),
    [groups]
  );

  const selectedOption = options.find((option) => String(option.value) === String(value)) || null;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (nextValue: string) => {
    onChange({ target: { value: nextValue } });
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={`toolbar-dropdown ${className} ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="toolbar-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="toolbar-dropdown-value" style={selectedOption?.style}>
          {selectedOption?.label || placeholder}
        </span>
      </button>
      <span className="toolbar-dropdown-chevron" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </span>

      {isOpen && (
        <div className="toolbar-dropdown-menu" role="listbox" aria-label={ariaLabel || placeholder}>
          {groups.map((group) => (
            <div key={group.label} className="toolbar-dropdown-group">
              {group.label ? <div className="toolbar-dropdown-group-label">{group.label}</div> : null}
              {group.options.map((option) => {
                const isSelected = String(option.value) === String(value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`toolbar-dropdown-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="toolbar-dropdown-option-label" style={option.style}>{option.label}</span>
                    {isSelected ? <span className="toolbar-dropdown-option-check">✓</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToolbarDropdown;
