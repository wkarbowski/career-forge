import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppState } from '../contexts/AppStateContext';
import { useTranslation } from '../i18n';
import ToolbarDropdown from './ToolbarDropdown';
import './CentralToolbar.css';

const FONT_OPTIONS_SANS = [
  'Inter', 'Rubik', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Poppins', 'PT Sans', 'Source Sans 3',
];
const FONT_OPTIONS_SERIF = ['Playfair Display', 'Merriweather', 'Lora'];

// Scale presets: [name, heading, subtitle, body]
const SCALE_PRESETS = {
  compact:  { nameFontSize: 28, headingFontSize: 12, subtitleFontSize: 12, bodyFontSize: 11 },
  standard: { nameFontSize: 36, headingFontSize: 14, subtitleFontSize: 14, bodyFontSize: 13 },
  spacious: { nameFontSize: 44, headingFontSize: 18, subtitleFontSize: 18, bodyFontSize: 16 },
};

const getActivePresetKey = (settings) => {
  const currentSizes = {
    nameFontSize: settings?.nameFontSize,
    headingFontSize: settings?.headingFontSize,
    subtitleFontSize: settings?.subtitleFontSize,
    bodyFontSize: settings?.bodyFontSize,
  };

  return Object.entries(SCALE_PRESETS).find(([, preset]) => (
    preset.nameFontSize === currentSizes.nameFontSize &&
    preset.headingFontSize === currentSizes.headingFontSize &&
    preset.subtitleFontSize === currentSizes.subtitleFontSize &&
    preset.bodyFontSize === currentSizes.bodyFontSize
  ))?.[0] || null;
};

const interpolateScale = (t) => {
  // t: 0 = compact, 0.5 = standard, 1 = spacious
  const from = t <= 0.5 ? SCALE_PRESETS.compact : SCALE_PRESETS.standard;
  const to = t <= 0.5 ? SCALE_PRESETS.standard : SCALE_PRESETS.spacious;
  const local = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
  const result = {};
  for (const key of Object.keys(from)) {
    result[key] = Math.round(from[key] + (to[key] - from[key]) * local);
  }
  return result;
};

const fontGroups = [
  {
    label: 'Sans-serif',
    options: FONT_OPTIONS_SANS.map((font) => ({ label: font, value: font, style: { fontFamily: font } })),
  },
  {
    label: 'Serif',
    options: FONT_OPTIONS_SERIF.map((font) => ({ label: font, value: font, style: { fontFamily: font } })),
  },
];

const FontSelect = ({ value, onChange, ariaLabel }) => (
  <ToolbarDropdown
    value={value}
    onChange={onChange}
    groups={fontGroups}
    className="toolbar-dropdown--font"
    ariaLabel={ariaLabel}
    placeholder="Select font"
  />
);

// ── Inline formatting via Selection/Range API ──

const wrapSelectionWith = (tagName, style) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const wrapper = document.createElement(tagName);
  if (style) Object.assign(wrapper.style, style);
  try {
    range.surroundContents(wrapper);
  } catch {
    // surroundContents fails if range spans partial nodes — fall back to extractContents
    const frag = range.extractContents();
    wrapper.appendChild(frag);
    range.insertNode(wrapper);
  }
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(wrapper);
  sel.addRange(newRange);
  return wrapper;
};

const isWrappedIn = (tagName) => {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return false;
  let node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
  while (node) {
    if (node.nodeName === tagName.toUpperCase()) return true;
    if (node.contentEditable === 'true') break;
    node = node.parentElement;
  }
  return false;
};

const unwrapTag = (tagName) => {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return;
  let node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
  while (node) {
    if (node.nodeName === tagName.toUpperCase()) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }
    if (node.contentEditable === 'true') break;
    node = node.parentElement;
  }
};

const toggleInlineTag = (tagName) => {
  if (isWrappedIn(tagName)) {
    unwrapTag(tagName);
  } else {
    wrapSelectionWith(tagName);
  }
};

const setBlockAlignment = (alignment) => {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return;
  let block = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
  // Walk up to find nearest block-level element
  while (block && window.getComputedStyle(block).display === 'inline') block = block.parentElement;
  if (block) block.style.textAlign = alignment;
};

const insertList = (ordered) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);

  const list = document.createElement(ordered ? 'ol' : 'ul');
  const li = document.createElement('li');

  if (sel.isCollapsed) {
    li.appendChild(document.createTextNode('\u200B'));
  } else {
    li.appendChild(range.extractContents());
  }
  list.appendChild(li);
  range.insertNode(list);

  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(li);
  newRange.collapse(false);
  sel.addRange(newRange);
};

const removeFormat = () => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const frag = range.extractContents();
  const text = frag.textContent;
  range.insertNode(document.createTextNode(text));
};

const CentralToolbar = () => {
  const { t } = useTranslation();
  const { settings, setSettings } = useAppState();
  const toolbarRef = useRef(null);
  const savedRangeRef = useRef(null);

  const [hasEditableFocus, setHasEditableFocus] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // Derive scale slider value from current bodyFontSize
  const bodyFontSize = settings?.bodyFontSize ?? 13;
  const scaleValue = bodyFontSize <= 11 ? 0 : bodyFontSize >= 16 ? 1 : (bodyFontSize - 11) / (16 - 11) * 0.5 + 0.25;
  const activePresetKey = getActivePresetKey(settings);

  // Monitor focus on editable elements for inline formatting state
  const detectEditableFocus = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setHasEditableFocus(false); return; }
    let node = sel.focusNode || sel.anchorNode;
    if (!node) { setHasEditableFocus(false); return; }
    if (node.nodeType === 3) node = node.parentElement;

    let editable = node;
    while (editable && editable.contentEditable !== 'true') editable = editable.parentElement;
    if (!editable) { setHasEditableFocus(false); return; }
    setHasEditableFocus(true);

    if (node && node.nodeType === 1) {
      try {
        const computed = window.getComputedStyle(node);
        const fw = computed.fontWeight;
        setIsBold(fw === 'bold' || fw === '700' || parseInt(fw, 10) >= 700);
        setIsItalic(computed.fontStyle === 'italic');
        setIsUnderline(
          computed.textDecorationLine?.includes('underline') ||
          computed.textDecoration?.includes('underline')
        );
      } catch (err) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const handle = () => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
      detectEditableFocus();
    };
    document.addEventListener('selectionchange', handle);
    document.addEventListener('focusin', handle);
    return () => {
      document.removeEventListener('selectionchange', handle);
      document.removeEventListener('focusin', handle);
    };
  }, [detectEditableFocus]);

  // Save/restore selection for inline formatting buttons
  const handleToolbarMouseDown = (e) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const saved = savedRangeRef.current;
    if (!saved) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    if (sel.rangeCount > 0 && !sel.isCollapsed && !toolbarRef.current?.contains(sel.anchorNode)) return true;
    try {
      if (!document.body.contains(saved.startContainer) || !document.body.contains(saved.endContainer)) return false;
      sel.removeAllRanges();
      sel.addRange(saved);
      return true;
    } catch (_e) {
      return false;
    }
  };

  const findEditableEl = (node) => {
    if (!node) return null;
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el && el.contentEditable !== 'true') el = el.parentElement;
    return el || null;
  };

  const getTargetEl = () => {
    const saved = savedRangeRef.current;
    if (saved && document.body.contains(saved.startContainer))
      return findEditableEl(saved.startContainer);
    return findEditableEl(window.getSelection()?.anchorNode);
  };

  const fireInputEvent = (el) => {
    if (el) el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  };

  const applyFormat = (fn) => {
    const targetEl = getTargetEl();
    restoreSelection();
    fn();
    fireInputEvent(targetEl);
    detectEditableFocus();
  };

  const handleColor = (e) => {
    const targetEl = getTargetEl();
    restoreSelection();
    wrapSelectionWith('span', { color: e.target.value });
    fireInputEvent(targetEl);
  };

  const handleBgColor = (e) => {
    const targetEl = getTargetEl();
    restoreSelection();
    wrapSelectionWith('span', { backgroundColor: e.target.value });
    fireInputEvent(targetEl);
  };

  // Global style handlers
  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const nameFont = settings?.nameFont || settings?.titleFont || 'Rubik';
  const headingFont = settings?.headingFont || settings?.titleFont || 'Rubik';
  const bodyFont = settings?.bodyFont || 'Inter';

  const handleScaleChange = (e) => {
    const sizes = interpolateScale(parseFloat(e.target.value));
    setSettings(prev => ({ ...prev, ...sizes }));
  };

  const applyPreset = (preset) => {
    setSettings(prev => ({ ...prev, ...SCALE_PRESETS[preset] }));
  };

  const colorInputStyle = {
    position: 'absolute', left: 0, top: 0,
    width: '100%', height: '100%',
    opacity: 0, border: 0, padding: 0, margin: 0, cursor: 'pointer',
  };

  return (
    <div
      ref={toolbarRef}
      className="central-toolbar"
      onMouseDown={handleToolbarMouseDown}
      role="toolbar"
      aria-label={t('centralToolbar.label')}
    >
      {/* ── Document Typography ── */}
      <div className="ct-section ct-typography">
        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-signature ct-label-icon" />
            {t('centralToolbar.name')}
          </span>
          <FontSelect value={nameFont} onChange={e => set('nameFont', e.target.value)} ariaLabel={t('centralToolbar.name')} />
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-layer-group ct-label-icon" />
            {t('centralToolbar.headings')}
          </span>
          <FontSelect value={headingFont} onChange={e => set('headingFont', e.target.value)} ariaLabel={t('centralToolbar.headings')} />
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-paragraph ct-label-icon" />
            {t('centralToolbar.body')}
          </span>
          <FontSelect value={bodyFont} onChange={e => set('bodyFont', e.target.value)} ariaLabel={t('centralToolbar.body')} />
        </div>

        <div className="ct-divider" />

        {/* Scale slider replaces 4 individual size pickers */}
        <div className="ct-group ct-scale-group">
          <span className="ct-label">
            <i className="fas fa-text-height ct-label-icon" />
            {t('centralToolbar.scale')}
          </span>
          <div className="ct-scale-controls">
            <div className="ct-scale-presets">
              <button className={`ct-preset-btn ${activePresetKey === 'compact' ? 'ct-preset-active' : ''}`} onClick={() => applyPreset('compact')} title={t('centralToolbar.compact')}>
                {t('centralToolbar.compact')}
              </button>
              <button className={`ct-preset-btn ${activePresetKey === 'standard' ? 'ct-preset-active' : ''}`} onClick={() => applyPreset('standard')} title={t('centralToolbar.standard')}>
                {t('centralToolbar.standard')}
              </button>
              <button className={`ct-preset-btn ${activePresetKey === 'spacious' ? 'ct-preset-active' : ''}`} onClick={() => applyPreset('spacious')} title={t('centralToolbar.spacious')}>
                {t('centralToolbar.spacious')}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={scaleValue}
              onChange={handleScaleChange}
              className="ct-scale-slider"
            />
          </div>
        </div>
      </div>

      <div className="ct-section-divider" />

      {/* ── Inline Formatting (selection-based) ── */}
      <div className={`ct-section ct-formatting ${hasEditableFocus ? '' : 'ct-disabled'}`}>
        <div className="ct-group">
          <button onClick={() => applyFormat(() => toggleInlineTag('strong'))} className={`ct-btn ${isBold ? 'ct-btn--active' : ''}`} disabled={!hasEditableFocus} title={t('toolbar.bold')}>
            <i className="fas fa-bold" />
          </button>
          <button onClick={() => applyFormat(() => toggleInlineTag('em'))} className={`ct-btn ${isItalic ? 'ct-btn--active' : ''}`} disabled={!hasEditableFocus} title={t('toolbar.italic')}>
            <i className="fas fa-italic" />
          </button>
          <button onClick={() => applyFormat(() => toggleInlineTag('u'))} className={`ct-btn ${isUnderline ? 'ct-btn--active' : ''}`} disabled={!hasEditableFocus} title={t('toolbar.underline')}>
            <i className="fas fa-underline" />
          </button>
          <button onClick={() => applyFormat(() => toggleInlineTag('s'))} className="ct-btn" disabled={!hasEditableFocus} title={t('toolbar.strike')}>
            <i className="fas fa-strikethrough" />
          </button>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <label className="ct-color-btn" title={t('toolbar.textColor')} style={{ position: 'relative', display: 'inline-flex' }}>
            <i className="fas fa-font" />
            <input type="color" onChange={handleColor} disabled={!hasEditableFocus} style={colorInputStyle} />
          </label>
          <label className="ct-color-btn" title={t('toolbar.bgColor')} style={{ position: 'relative', display: 'inline-flex' }}>
            <i className="fas fa-highlighter" />
            <input type="color" onChange={handleBgColor} disabled={!hasEditableFocus} style={colorInputStyle} />
          </label>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <button onClick={() => applyFormat(() => setBlockAlignment('left'))} className="ct-btn" disabled={!hasEditableFocus} title={t('toolbar.alignLeft')}>
            <i className="fas fa-align-left" />
          </button>
          <button onClick={() => applyFormat(() => setBlockAlignment('center'))} className="ct-btn" disabled={!hasEditableFocus} title={t('toolbar.alignCenter')}>
            <i className="fas fa-align-center" />
          </button>
          <button onClick={() => applyFormat(() => setBlockAlignment('right'))} className="ct-btn" disabled={!hasEditableFocus} title={t('toolbar.alignRight')}>
            <i className="fas fa-align-right" />
          </button>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <button onClick={() => applyFormat(() => insertList(false))} className="ct-btn" disabled={!hasEditableFocus} title={t('toolbar.unorderedList')}>
            <i className="fas fa-list-ul" />
          </button>
          <button onClick={() => applyFormat(() => insertList(true))} className="ct-btn" disabled={!hasEditableFocus} title={t('toolbar.orderedList')}>
            <i className="fas fa-list-ol" />
          </button>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <button onClick={() => applyFormat(removeFormat)} className="ct-btn" disabled={!hasEditableFocus} title={t('toolbar.removeFormat')}>
            <i className="fas fa-eraser" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CentralToolbar;
