import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'span', 'div'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
};

const EditableText = ({ value, onChange, className = '', tag: Tag = 'span', style = {}, placeholder = '' }) => {
  const ref = useRef(null);

  const decodeEntities = (str) => {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  };

  const handlePaste = (e) => {
    e.preventDefault();

    const clipboard = e.clipboardData || window.clipboardData;
    const html = clipboard.getData && clipboard.getData('text/html');
    const text = clipboard.getData && clipboard.getData('text/plain');
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = document.createDocumentFragment();

    if (html) {
      const sanitizedHtml = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitizedHtml, 'text/html');

      Array.from(doc.body.childNodes).forEach((n) => {
        fragment.appendChild(document.importNode(n, true));
      });
    } else if (text) {
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        fragment.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) fragment.appendChild(document.createElement('br'));
      });
    }

    range.insertNode(fragment);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    setTimeout(() => document.dispatchEvent(new Event('selectionchange')), 0);

    if (ref.current && onChange) {
      const content = ref.current.innerHTML === placeholder ? '' : ref.current.innerHTML;
      onChange(DOMPurify.sanitize(content, DOMPURIFY_CONFIG));
    }
  };

  const handleInput = (e) => {
    if (onChange) {
      const content = e.target.innerHTML === placeholder ? '' : e.target.innerHTML;
      onChange(DOMPurify.sanitize(content, DOMPURIFY_CONFIG));
    }
  };

  const handleFocus = (e) => {
    const el = ref.current;
    if (!el) return;
    if (placeholder && el.innerText === placeholder) {
      el.innerHTML = '';
      el.classList.remove('editable-placeholder');
    }
  };

  const handleBlur = (e) => {
    const el = ref.current;
    if (!el) return;
    if (!el.innerText.trim() && placeholder) {
      el.innerHTML = placeholder;
      el.classList.add('editable-placeholder');
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;

    // Don't replace innerHTML while the toolbar is acting on a selection inside this element.
    // Clicking a toolbar button moves focus to that button, but the selection still lives here.
    // Replacing innerHTML would destroy the selection and hide the toolbar.
    const sel = window.getSelection();
    const hasActiveSelection =
      sel && sel.rangeCount > 0 && !sel.isCollapsed && el.contains(sel.anchorNode);
    if (hasActiveSelection) return;

    if (!value && placeholder) {
      el.innerHTML = placeholder;
      el.classList.add('editable-placeholder');
    } else {
      const decoded = decodeEntities(value || '');
      el.innerHTML = DOMPurify.sanitize(decoded, DOMPURIFY_CONFIG);
      el.classList.remove('editable-placeholder');
    }
  }, [value, placeholder]);

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onPaste={handlePaste}
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      style={style}
    />
  );
};

export default EditableText;
