import React, { useState, useEffect, useRef } from 'react';

const SOCIAL_ICONS = [
  { cls: 'fas fa-globe',         label: 'Website'       },
  { cls: 'fab fa-linkedin',      label: 'LinkedIn'      },
  { cls: 'fab fa-github',        label: 'GitHub'        },
  { cls: 'fab fa-gitlab',        label: 'GitLab'        },
  { cls: 'fab fa-xing',          label: 'Xing'          },
  { cls: 'fab fa-x-twitter',     label: 'X / Twitter'   },
  { cls: 'fab fa-stackoverflow', label: 'Stack Overflow' },
  { cls: 'fab fa-behance',       label: 'Behance'       },
  { cls: 'fab fa-dribbble',      label: 'Dribbble'      },
];

interface SocialIconPickerProps {
  value?: string;
  onChange: (iconClass: string) => void;
}

const SocialIconPicker = ({ value = 'fas fa-globe', onChange }: SocialIconPickerProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <span className="social-icon-picker" ref={ref}>
      <button
        type="button"
        className="social-icon-trigger"
        onClick={() => setOpen(o => !o)}
        title="Change icon"
      >
        <i className={value} />
      </button>

      {open && (
        <div className="social-icon-popover">
          {SOCIAL_ICONS.map(({ cls, label }) => (
            <button
              key={cls}
              type="button"
              className={`social-icon-option${cls === value ? ' active' : ''}`}
              title={label}
              onClick={() => { onChange(cls); setOpen(false); }}
            >
              <i className={cls} />
            </button>
          ))}
        </div>
      )}
    </span>
  );
};

export default SocialIconPicker;
