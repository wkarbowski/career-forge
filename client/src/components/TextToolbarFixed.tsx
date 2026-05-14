import React, { useState, useRef, useEffect } from 'react';
import { usePages } from '../contexts/PageContext';
import { useTranslation } from '../i18n';
import ToolbarDropdown from './ToolbarDropdown';

const FONT_GROUPS = [
  {
    label: 'Sans-serif',
    options: [
      'Inter', 'Rubik', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito',
      'Raleway', 'Oswald', 'PT Sans', 'Source Sans 3', 'Josefin Sans'
    ].map((font) => ({ label: font, value: font, style: { fontFamily: font } })),
  },
  {
    label: 'Serif',
    options: ['Merriweather', 'Playfair Display', 'Lora', 'Georgia', 'Times New Roman']
      .map((font) => ({ label: font, value: font, style: { fontFamily: font } })),
  },
  {
    label: 'Monospace',
    options: [{ label: 'Courier New', value: 'Courier New', style: { fontFamily: 'Courier New' } }],
  },
  {
    label: 'System',
    options: ['Arial', 'Verdana', 'Trebuchet MS', 'Tahoma']
      .map((font) => ({ label: font, value: font, style: { fontFamily: font } })),
  },
];

const FONT_SIZE_OPTIONS = [8,9,10,11,12,13,14,15,16,17,18,20,22,24,26,28,30,32,36,40,48,60,72];

interface TextToolbarPosition {
  top: number;
  left: number;
}

interface TextToolbarProps {
  position: TextToolbarPosition | null;
  onClose: () => void;
}

const TextToolbar = ({ position, onClose }: TextToolbarProps) => {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState('16');
  const [fontFamily, setFontFamily] = useState('Rubik');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [adjPosition, setAdjPosition] = useState<TextToolbarPosition>(position || { top: 0, left: 0 });
  const { zoom } = usePages();
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const detectCurrentStyles = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      // Use the focus node (end of selection) for better accuracy when
      // dragging a selection across text with different styles
      let node: Node | null = selection.focusNode || selection.anchorNode;
      if (node && node.nodeType === 3) {
        node = (node as Text).parentElement;
      }

      if (node && node.nodeType === 1) {
        try {
          const computed = window.getComputedStyle(node as Element);

                  const findInlineFontSize = (el: Node | null): string | null => {
                    let cur = el;
                    while (cur && cur.nodeType === 1) {
                      if ((cur as HTMLElement).style && (cur as HTMLElement).style.fontSize) return (cur as HTMLElement).style.fontSize;
                      cur = (cur as HTMLElement).parentElement;
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
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          onClose();
          return;
        }

        let node: Node | null = selection.anchorNode;
        let isContentEditable = false;
        while (node) {
          if (node.nodeType === 1 && (node as HTMLElement).contentEditable === 'true') {
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleToolbarMouseDown = (_e: React.MouseEvent) => {
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

  const execCommand = (command: string, value: string | null = null) => {
    restoreSelection();
    document.execCommand(command, false, value ?? undefined);
    // Dispatch input event so React state picks up the formatting change
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let editableEl: Node | null = sel.anchorNode;
      if (editableEl && editableEl.nodeType === 3) editableEl = (editableEl as Text).parentElement;
      while (editableEl && (editableEl as HTMLElement).contentEditable !== 'true') {
        editableEl = (editableEl as HTMLElement).parentElement;
      }
      if (editableEl) {
        editableEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  const applyStyleToSelection = (prop: string, value: string) => {
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
          const computed = window.getComputedStyle(startNode as Element);
          const preserve = ['color', 'backgroundColor', 'fontFamily', 'fontSize'];
          preserve.forEach((p) => {
            if (p !== prop && computed[p as keyof CSSStyleDeclaration]) (span.style as unknown as Record<string, string>)[p] = computed[p as keyof CSSStyleDeclaration] as string;
          });
        }
      } catch (err) {
      }

      (span.style as unknown as Record<string, string>)[prop] = value;
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      let editableEl: HTMLElement | null = span;
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
    const isBlockElement = (el: Node | null): el is HTMLElement => {
      if (!el || el.nodeType !== 1) return false;
      const display = window.getComputedStyle(el as Element).display;
      if (display === 'block' || display === 'list-item' || display === 'table' || display === 'flex') return true;
      const blockTags = ['P','DIV','LI','UL','OL','H1','H2','H3','H4','H5','H6','PRE'];
      return blockTags.includes((el as Element).tagName);
    };

    try {
      const common = range.commonAncestorContainer.nodeType === 3 ? (range.commonAncestorContainer as Text).parentElement! : range.commonAncestorContainer as HTMLElement;
      const walker = document.createTreeWalker(common, NodeFilter.SHOW_ELEMENT, null);
      const blocks = new Set<HTMLElement>();
      let node: Node | null = walker.currentNode;
      if (isBlockElement(common) && range.intersectsNode(common) && common.contentEditable !== 'true') blocks.add(common);
      while ((node = walker.nextNode())) {
        if (isBlockElement(node) && range.intersectsNode(node) && (node as HTMLElement).contentEditable !== 'true') {
          blocks.add(node as HTMLElement);
        }
      }
      if (blocks.size > 0) {
        blocks.forEach((blk) => {
          try { (blk.style as unknown as Record<string, string>)[prop] = value; } catch (e) { /* ignore */ }
        });

        let editableEl: HTMLElement | null = common;
        while (editableEl && editableEl.contentEditable !== 'true') editableEl = editableEl.parentElement;
        if (editableEl) editableEl.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    } catch (err) {
    }

    const content = range.extractContents();
    const wrapper = document.createElement('span');

    const findInlineStyle = (node: Node, styleProp: string): string | null => {
      let el: HTMLElement | null = node.nodeType === 3 ? (node as Text).parentElement : node as HTMLElement;
      while (el) {
        if (el.style && (el.style as unknown as Record<string, string>)[styleProp]) return (el.style as unknown as Record<string, string>)[styleProp];
        el = el.parentElement;
      }
      return null;
    };

    // Preserve previous inline styles when possible
    try {
      const startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
      if (startNode && startNode.nodeType === 1) {
        const computed = window.getComputedStyle(startNode as Element);
        const preserve = ['color', 'backgroundColor', 'fontFamily', 'fontSize'];
        preserve.forEach((p) => {
          if (p === prop) return;
          const inlineVal = findInlineStyle(startNode, p);
          const useVal = inlineVal || (computed[p as keyof CSSStyleDeclaration] as string);
          if (useVal) (wrapper.style as unknown as Record<string, string>)[p] = useVal;
        });
      }
    } catch (err) {
    }

    (wrapper.style as unknown as Record<string, string>)[prop] = value;
    wrapper.appendChild(content);
    range.insertNode(wrapper);

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.addRange(newRange);

    let editableEl: HTMLElement | null = wrapper;
    while (editableEl && editableEl.contentEditable !== 'true') {
      editableEl = editableEl.parentElement;
    }
    if (editableEl) {
      editableEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const handleFontSize = (e: { target: { value: string } }) => {
    const size = e.target.value;
    setFontSize(size);
    const numeric = parseFloat(size) || 0;
    if (numeric > 0) {
      // Store exactly what the user typed — zoom is visual-only, not part of the font size.
      applyStyleToSelection('fontSize', numeric + 'px');
    }
  };

  const handleFontFamily = (e: { target: { value: string } }) => {
    const family = e.target.value;
    setFontFamily(family);
    applyStyleToSelection('fontFamily', family);
  };

  const handleColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyStyleToSelection('color', e.target.value);
  };

  const handleBackgroundColor = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <ToolbarDropdown
        value={fontFamily}
        onChange={handleFontFamily}
        groups={FONT_GROUPS}
        className="toolbar-dropdown--font"
        ariaLabel={t('toolbar.fontFamily') || 'Font family'}
        placeholder="Select font"
      />

      <ToolbarDropdown
        value={fontSize}
        onChange={handleFontSize}
        groups={[
          {
            label: 'Size',
            options: [
              ...(!FONT_SIZE_OPTIONS.includes(Number(fontSize)) ? [{ label: String(fontSize), value: String(fontSize) }] : []),
              ...FONT_SIZE_OPTIONS.map((size) => ({ label: String(size), value: String(size) })),
            ],
          },
        ]}
        className="toolbar-dropdown--size"
        ariaLabel={t('toolbar.fontSize') || 'Font size'}
        placeholder="Size"
      />

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
