import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'span', 'div', 's', 'strike', 'del'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
};

// Whitelist CSS properties that the text toolbar may apply.
// DOMPurify strips all inline styles unless we explicitly allow them.
const ALLOWED_CSS = [
  'color', 'background-color', 'text-align',
  'font-weight', 'font-style', 'font-size', 'font-family',
  'text-decoration', 'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
];

// Convert <font color="..."> (produced by execCommand('foreColor'))
// into <span style="color: ..."> before DOMPurify strips the <font> tag.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'font' && node.getAttribute && node.getAttribute('color')) {
    const color = node.getAttribute('color');
    const span = document.createElement('span');
    span.style.color = color;
    while (node.firstChild) span.appendChild(node.firstChild);
    node.parentNode?.replaceChild(span, node);
  }
});

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'style' && data.attrValue) {
    const cleaned = data.attrValue
      .split(';')
      .map(d => d.trim())
      .filter(d => {
        const prop = d.split(':')[0]?.trim().toLowerCase();
        return prop && ALLOWED_CSS.includes(prop);
      })
      .join('; ');
    data.attrValue = cleaned || '';
    if (!cleaned) data.keepAttr = false;
  }
});

const EditableText = ({ value, onChange, className = '', tag: Tag = 'span', style = {}, placeholder = '' }) => {
  const ref = useRef(null);

  const decodeEntities = (str) => {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  };

  // Treat content that is only whitespace / <br> tags as empty so the
  // CSS placeholder can show.
  const isContentEmpty = (el) => {
    if (!el) return true;
    const text = el.innerText || '';
    return !text.replace(/\n/g, '').trim();
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
      const html = ref.current.innerHTML;
      onChange(isContentEmpty(ref.current) ? '' : DOMPurify.sanitize(html, DOMPURIFY_CONFIG));
    }
  };

  const handleInput = (e) => {
    if (onChange) {
      const html = e.target.innerHTML;
      onChange(isContentEmpty(e.target) ? '' : DOMPurify.sanitize(html, DOMPURIFY_CONFIG));
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

    const decoded = decodeEntities(value || '');
    el.innerHTML = DOMPurify.sanitize(decoded, DOMPURIFY_CONFIG);
  }, [value]);

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onPaste={handlePaste}
      onInput={handleInput}
      className={`${className} ${!value ? 'editable-placeholder' : ''}`.trim()}
      style={style}
      data-placeholder={placeholder || undefined}
    />
  );
};

export default EditableText;
