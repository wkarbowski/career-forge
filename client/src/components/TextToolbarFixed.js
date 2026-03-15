import React, { useState, useRef, useEffect } from 'react';
import { usePages } from '../contexts/PageContext';
import { useTranslation } from '../i18n';

const TextToolbar = ({ position, onClose }) => {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState('16');
  const [fontFamily, setFontFamily] = useState('Rubik');
  const toolbarRef = useRef(null);
  const [adjPosition, setAdjPosition] = useState(position || { top: 0, left: 0 });
  const { zoom } = usePages();
  const savedRangeRef = useRef(null);

  useEffect(() => {
    const detectCurrentStyles = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      // Use the focus node (end of selection) for better accuracy when
      // dragging a selection across text with different styles
      let node = selection.focusNode || selection.anchorNode;
      if (node && node.nodeType === 3) {
        node = node.parentElement;
      }
      
      if (node && node.nodeType === 1) {
        try {
          const computed = window.getComputedStyle(node);
          
                  // Prefer inline style font-size so the toolbar shows the
                  // actual CSS value (unaffected by browser zoom).
                  const findInlineFontSize = (el) => {
                    let cur = el;
                    while (cur && cur.nodeType === 1) {
                      if (cur.style && cur.style.fontSize) return cur.style.fontSize;
                      cur = cur.parentElement;
                    }
                    return null;
                  };

                  const inlineSize = findInlineFontSize(node);
                  if (inlineSize) {
                    const sizeNum = Math.round(parseFloat(inlineSize));
                    if (!isNaN(sizeNum)) setFontSize(String(sizeNum));
                  } else {
                    const currentSize = computed.fontSize;
                    if (currentSize) {
                      const sizeNum = Math.round(parseFloat(currentSize));
                      if (!isNaN(sizeNum)) setFontSize(String(sizeNum));
                    }
                  }
          
          const currentFamily = computed.fontFamily;
          if (currentFamily) {
            const firstFamily = currentFamily.split(',')[0].replace(/['"]/g, '').trim();
            setFontFamily(firstFamily);
          }
        } catch (err) {
        }
      }
    };
    
    // Skip detection while user interacts with toolbar itself
    const handleSelectionChange = () => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
      detectCurrentStyles();
    };
    detectCurrentStyles();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [position, zoom]); // Re-detect when position or zoom changes (new selection)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          onClose();
          return;
        }

        let node = selection.anchorNode;
        let isContentEditable = false;
        while (node) {
          if (node.nodeType === 1 && node.contentEditable === 'true') {
            isContentEditable = true;
            break;
          }
          node = node.parentNode;
        }

        if (!isContentEditable) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Reposition toolbar above the provided position so it doesn't cover the edited text
  useEffect(() => {
    const updatePosition = () => {
      if (!toolbarRef.current) return;
      let pos = position;
      // if provided position looks like a default/invalid value, try deriving from current selection
      const invalidPos = !pos || (typeof pos.left !== 'number') || (typeof pos.top !== 'number') || (pos.left === 0 && pos.top === 0);
      if (invalidPos) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const r = sel.getRangeAt(0);
          let rect = r.getBoundingClientRect();
          if ((!rect || (rect.width === 0 && rect.height === 0)) && r.getClientRects().length) rect = r.getClientRects()[0];
          if (rect && typeof rect.left === 'number') {
            pos = { left: rect.left + window.scrollX, top: rect.top + window.scrollY };
          }
        }
      }
      if (!pos) return;
      const tb = toolbarRef.current;
      const tbRect = tb.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      let left = pos.left;

      if (left + tbRect.width > viewportWidth - 8) {
        left = Math.max(8, viewportWidth - tbRect.width - 8);
      }

      const calculatedTop = pos.top - tbRect.height - 12;
      const top = Math.max(70, calculatedTop); // ensure toolbar stays below the header bar

      setAdjPosition({ top, left });
    };

    const id = setTimeout(updatePosition, 0);
    window.addEventListener('resize', updatePosition);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', updatePosition);
    };
  }, [position]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
    const hasMeaningfulSelection =
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      !toolbarRef.current?.contains(sel.anchorNode);
    if (hasMeaningfulSelection) return true; // already fine
    sel.removeAllRanges();
    sel.addRange(saved);
    return true;
  };

  const execCommand = (command, value = null) => {
    restoreSelection();
    document.execCommand(command, false, value);
    // Dispatch input event so React state picks up the formatting change
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let editableEl = sel.anchorNode;
      if (editableEl && editableEl.nodeType === 3) editableEl = editableEl.parentElement;
      while (editableEl && editableEl.contentEditable !== 'true') {
        editableEl = editableEl.parentElement;
      }
      if (editableEl) {
        editableEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  const applyStyleToSelection = (prop, value) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (selection.isCollapsed) {
      const span = document.createElement('span');
      // preserve computed styles from surrounding node so applying color doesn't
      // inadvertently change font-size or font-family
      try {
        const startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
        if (startNode && startNode.nodeType === 1) {
          const computed = window.getComputedStyle(startNode);
          const preserve = ['color', 'backgroundColor', 'fontFamily', 'fontSize'];
          preserve.forEach((p) => {
            if (p !== prop && computed[p]) span.style[p] = computed[p];
          });
        }
      } catch (err) {
      }

      span.style[prop] = value;
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      let editableEl = span;
      while (editableEl && editableEl.contentEditable !== 'true') {
        editableEl = editableEl.parentElement;
      }
      if (editableEl) {
        editableEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // If selection spans block-level elements, apply style to blocks
    // directly instead of extracting and wrapping inline.
    const isBlockElement = (el) => {
      if (!el || el.nodeType !== 1) return false;
      const display = window.getComputedStyle(el).display;
      if (display === 'block' || display === 'list-item' || display === 'table' || display === 'flex') return true;
      const blockTags = ['P','DIV','LI','UL','OL','H1','H2','H3','H4','H5','H6','PRE'];
      return blockTags.includes(el.tagName);
    };

    try {
      const common = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
      const walker = document.createTreeWalker(common, NodeFilter.SHOW_ELEMENT, null);
      const blocks = new Set();
      let node = walker.currentNode;
      if (isBlockElement(common) && range.intersectsNode(common)) blocks.add(common);
      while ((node = walker.nextNode())) {
        if (isBlockElement(node) && range.intersectsNode(node)) {
          blocks.add(node);
        }
      }
      if (blocks.size > 0) {
        blocks.forEach((blk) => {
          try { blk.style[prop] = value; } catch (e) { /* ignore */ }
        });

        let editableEl = common;
        while (editableEl && editableEl.contentEditable !== 'true') editableEl = editableEl.parentElement;
        if (editableEl) editableEl.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    } catch (err) {
    }

    const content = range.extractContents();
    const wrapper = document.createElement('span');

    const findInlineStyle = (node, styleProp) => {
      let el = node.nodeType === 3 ? node.parentElement : node;
      while (el) {
        if (el.style && el.style[styleProp]) return el.style[styleProp];
        el = el.parentElement;
      }
      return null;
    };

    // Preserve previous inline styles when possible
    try {
      const startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
      if (startNode && startNode.nodeType === 1) {
        const computed = window.getComputedStyle(startNode);
        const preserve = ['color', 'backgroundColor', 'fontFamily', 'fontSize'];
        preserve.forEach((p) => {
          if (p === prop) return;
          const inlineVal = findInlineStyle(startNode, p);
          const useVal = inlineVal || computed[p];
          if (useVal) wrapper.style[p] = useVal;
        });
      }
    } catch (err) {
    }

    wrapper.style[prop] = value;
    wrapper.appendChild(content);
    range.insertNode(wrapper);

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.addRange(newRange);

    let editableEl = wrapper;
    while (editableEl && editableEl.contentEditable !== 'true') {
      editableEl = editableEl.parentElement;
    }
    if (editableEl) {
      editableEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const handleFontSize = (e) => {
    const size = e.target.value;
    setFontSize(size);
    const numeric = parseFloat(size) || 0;
    if (numeric > 0) {
      // Store exactly what the user typed — zoom is visual-only, not part of the font size.
      applyStyleToSelection('fontSize', numeric + 'px');
    }
  };

  const handleFontFamily = (e) => {
    const family = e.target.value;
    setFontFamily(family);
    applyStyleToSelection('fontFamily', family);
  };

  const handleColor = (e) => {
    applyStyleToSelection('color', e.target.value);
  };

  const handleBackgroundColor = (e) => {
    applyStyleToSelection('backgroundColor', e.target.value);
  };

  return (
    <div
      ref={toolbarRef}
      className="text-toolbar"
      onMouseDown={handleToolbarMouseDown}
      style={{
        position: 'absolute',
        top: `${adjPosition.top}px`,
        left: `${adjPosition.left}px`,
        zIndex: 1600
      }}
    >
      <select value={fontFamily} onChange={handleFontFamily} className="toolbar-select">
        <optgroup label="Sans-serif">
          <option value="Inter">Inter</option>
          <option value="Rubik">Rubik</option>
          <option value="Roboto">Roboto</option>
          <option value="Open Sans">Open Sans</option>
          <option value="Lato">Lato</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Poppins">Poppins</option>
          <option value="Nunito">Nunito</option>
          <option value="Raleway">Raleway</option>
          <option value="Oswald">Oswald</option>
          <option value="PT Sans">PT Sans</option>
          <option value="Source Sans 3">Source Sans 3</option>
          <option value="Josefin Sans">Josefin Sans</option>
        </optgroup>
        <optgroup label="Serif">
          <option value="Merriweather">Merriweather</option>
          <option value="Playfair Display">Playfair Display</option>
          <option value="Lora">Lora</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
        </optgroup>
        <optgroup label="Monospace">
          <option value="Courier New">Courier New</option>
        </optgroup>
        <optgroup label="System">
          <option value="Arial">Arial</option>
          <option value="Verdana">Verdana</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Tahoma">Tahoma</option>
        </optgroup>
      </select>

      <select value={fontSize} onChange={handleFontSize} className="toolbar-select">
        {![8,9,10,11,12,13,14,15,16,17,18,20,22,24,26,28,30,32,36,40,48,60,72].includes(Number(fontSize)) && (
          <option value={fontSize}>{fontSize}</option>
        )}
        <option value="8">8</option>
        <option value="9">9</option>
        <option value="10">10</option>
        <option value="11">11</option>
        <option value="12">12</option>
        <option value="13">13</option>
        <option value="14">14</option>
        <option value="15">15</option>
        <option value="16">16</option>
        <option value="17">17</option>
        <option value="18">18</option>
        <option value="20">20</option>
        <option value="22">22</option>
        <option value="24">24</option>
        <option value="26">26</option>
        <option value="28">28</option>
        <option value="30">30</option>
        <option value="32">32</option>
        <option value="36">36</option>
        <option value="40">40</option>
        <option value="48">48</option>
        <option value="60">60</option>
        <option value="72">72</option>
      </select>

      <button onClick={() => execCommand('bold')} className="toolbar-btn" title={t('toolbar.bold')}>
        <i className="fas fa-bold"></i>
      </button>

      <button onClick={() => execCommand('italic')} className="toolbar-btn" title={t('toolbar.italic')}>
        <i className="fas fa-italic"></i>
      </button>

      <button onClick={() => execCommand('underline')} className="toolbar-btn" title={t('toolbar.underline')}>
        <i className="fas fa-underline"></i>
      </button>

      <button onClick={() => execCommand('strikeThrough')} className="toolbar-btn" title={t('toolbar.strike')}>
        <i className="fas fa-strikethrough"></i>
      </button>

      <div className="toolbar-separator"></div>

      <label className="toolbar-color-btn" title={t('toolbar.textColor')} style={{ position: 'relative', display: 'inline-block' }}>
        <i className="fas fa-font"></i>
        <input
          type="color"
          onChange={handleColor}
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, border: 0, padding: 0, margin: 0 }}
        />
      </label>

      <label className="toolbar-color-btn" title={t('toolbar.bgColor')} style={{ position: 'relative', display: 'inline-block' }}>
        <i className="fas fa-highlighter"></i>
        <input
          type="color"
          onChange={handleBackgroundColor}
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, border: 0, padding: 0, margin: 0 }}
        />
      </label>

      <div className="toolbar-separator"></div>

      <button onClick={() => execCommand('justifyLeft')} className="toolbar-btn" title={t('toolbar.alignLeft')}>
        <i className="fas fa-align-left"></i>
      </button>

      <button onClick={() => execCommand('justifyCenter')} className="toolbar-btn" title={t('toolbar.alignCenter')}>
        <i className="fas fa-align-center"></i>
      </button>

      <button onClick={() => execCommand('justifyRight')} className="toolbar-btn" title={t('toolbar.alignRight')}>
        <i className="fas fa-align-right"></i>
      </button>

      <div className="toolbar-separator"></div>

      <button onClick={() => execCommand('insertUnorderedList')} className="toolbar-btn" title={t('toolbar.unorderedList')}>
        <i className="fas fa-list-ul"></i>
      </button>

      <button onClick={() => execCommand('insertOrderedList')} className="toolbar-btn" title={t('toolbar.orderedList')}>
        <i className="fas fa-list-ol"></i>
      </button>

      <div className="toolbar-separator"></div>

      <button onClick={() => execCommand('removeFormat')} className="toolbar-btn" title={t('toolbar.removeFormat')}>
        <i className="fas fa-eraser"></i>
      </button>
    </div>
  );
};

export default TextToolbar;
