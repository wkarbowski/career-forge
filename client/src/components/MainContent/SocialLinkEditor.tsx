import React, { useState } from 'react';
import SocialIconPicker from './SocialIconPicker';
import EditableText from './EditableText';

const stripHtml = (html: string): string => html ? html.replace(/<[^>]+>/g, '').trim() : '';

const btnBase = {
  background: 'none',
  border: 'none',
  padding: '0 2px',
  cursor: 'pointer',
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
};

interface SocialLinkEditorProps {
  icon: string;
  url: string;
  onIconChange: (iconClass: string) => void;
  onUrlChange: (url: string) => void;
  onDelete?: () => void;
  t: (key: string) => string;
}

const SocialLinkEditor = ({ icon, url, onIconChange, onUrlChange, onDelete, t }: SocialLinkEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [originalUrl, setOriginalUrl] = useState('');

  const startEditing = () => {
    setOriginalUrl(url);
    setEditing(true);
  };

  const confirmEdit = () => {
    setEditing(false);
  };

  const cancelEdit = () => {
    onUrlChange(originalUrl);
    setEditing(false);
  };

  return (
    <span className="contact-item social-link-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <SocialIconPicker value={icon} onChange={onIconChange} />

      {!editing && (
        <>
          {url && (
            <a
              href={stripHtml(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="platform-link"
              style={{ textDecoration: 'none', color: 'inherit', marginLeft: 4 }}
            >
              <span className="platform-url">{stripHtml(url).replace(/^https?:\/\/(www\.)?/, '')}</span>
            </a>
          )}
          <button
            type="button"
            aria-label="Edit URL"
            className="edit-url-btn hide-on-print social-pen-end"
            onClick={startEditing}
            tabIndex={-1}
            style={{ ...btnBase, marginLeft: 4, opacity: 0, pointerEvents: 'none', transition: 'opacity 0.18s', color: 'var(--accent-color)' }}
          >
            <i className="fas fa-pen" style={{ fontSize: '11px' }} />
          </button>
          {onDelete && (
            <button
              type="button"
              aria-label="Remove link"
              className="hide-on-print social-pen-end"
              onClick={onDelete}
              tabIndex={-1}
              style={{ ...btnBase, marginLeft: 2, opacity: 0, pointerEvents: 'none', transition: 'opacity 0.18s', color: '#999' }}
            >
              <i className="fas fa-times" style={{ fontSize: '11px' }} />
            </button>
          )}
        </>
      )}

      {editing && (
        <>
          <span style={{ marginLeft: 4, minWidth: 120, display: 'inline-block' }}>
            <EditableText
              value={url}
              onChange={onUrlChange}
              placeholder={t('placeholders.website')}
              autoFocus
            />
          </span>
          <button
            type="button"
            aria-label="Save"
            className="hide-on-print"
            onMouseDown={(e) => { e.preventDefault(); confirmEdit(); }}
            style={{ ...btnBase, marginLeft: 4, color: 'var(--accent-color)' }}
          >
            <i className="fas fa-check" style={{ fontSize: '12px' }} />
          </button>
          <button
            type="button"
            aria-label="Cancel"
            className="hide-on-print"
            onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
            style={{ ...btnBase, marginLeft: 2, color: '#999' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </>
      )}

      <style>{`
        .social-link-item:hover .social-pen-end {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </span>
  );
};

export default SocialLinkEditor;
