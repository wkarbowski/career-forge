import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useLayoutEffect,
} from "react";
import { sanitizeEditableHtml } from "../utils/editableHtml";

type EditableTag =
  | "span"
  | "div"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

interface EditableTextProps {
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  tag?: EditableTag;
  style?: React.CSSProperties;
  placeholder?: string;
  autoFocus?: boolean;
}

type EditableCommitElement = HTMLElement & {
  __careerForgeCommit?: () => void;
};

const EDITOR_SELECTION_PRESERVER_SELECTOR = "[data-editor-selection-preserver]";
const EDITABLE_SELECTOR = '[contenteditable="true"]';

let editableBlurListenerCount = 0;
const clearEditingCallbacks = new Set<() => void>();

const findEditable = (node: EventTarget | null) =>
  node instanceof Element ? node.closest<HTMLElement>(EDITABLE_SELECTOR) : null;

const findPreserver = (node: EventTarget | null) =>
  node instanceof Element
    ? node.closest<HTMLElement>(EDITOR_SELECTION_PRESERVER_SELECTOR)
    : null;

const clearSelection = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  selection.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange"));
};

const clearEditorInteractionState = () => {
  const activeEditable = findEditable(document.activeElement);
  activeEditable?.blur();
  clearEditingCallbacks.forEach((clearEditing) => clearEditing());
  clearSelection();
};

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (findEditable(event.target) || findPreserver(event.target)) return;
  clearEditorInteractionState();
};

const registerEditableBlurHandler = () => {
  if (editableBlurListenerCount === 0) {
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
  }
  editableBlurListenerCount += 1;

  return () => {
    editableBlurListenerCount -= 1;
    if (editableBlurListenerCount === 0) {
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown,
        true,
      );
    }
  };
};

const placeCaretAtEnd = (el: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const getCaretRangeFromPoint = (x: number, y: number) => {
  const pointDocument = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const position = pointDocument.caretPositionFromPoint?.(x, y);
  if (position) {
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  const range = pointDocument.caretRangeFromPoint?.(x, y) ?? null;
  range?.collapse(true);
  return range;
};

const placeCaretFromPoint = (el: HTMLElement, x: number, y: number) => {
  const selection = window.getSelection();
  const range = getCaretRangeFromPoint(x, y);

  if (!selection || !range || !el.contains(range.startContainer)) {
    placeCaretAtEnd(el);
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
};

const EditableText = ({
  value,
  onChange,
  className = "",
  tag: Tag = "span",
  style = {},
  placeholder = "",
}: EditableTextProps) => {
  const ref = useRef<EditableCommitElement>(null);
  const pendingFocusPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Treat content that is only whitespace / <br> tags as empty so the
  // CSS placeholder can show.
  const isContentEmpty = (el: HTMLElement | null) => {
    if (!el) return true;
    const text = el.innerText || "";
    return !text.replace(/\n/g, "").trim();
  };

  const commitValue = useCallback(
    (el: HTMLElement) => {
      if (!onChange) return;
      const html = el.innerHTML;
      onChange(isContentEmpty(el) ? "" : sanitizeEditableHtml(html));
    },
    [onChange],
  );

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();

    const clipboard = e.clipboardData;
    const html = clipboard.getData("text/html");
    const text = clipboard.getData("text/plain");
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = document.createDocumentFragment();

    if (html) {
      const sanitizedHtml = sanitizeEditableHtml(html);

      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitizedHtml, "text/html");

      Array.from(doc.body.childNodes).forEach((n) => {
        fragment.appendChild(document.importNode(n, true));
      });
    } else if (text) {
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        fragment.appendChild(document.createTextNode(line));
        if (index < lines.length - 1)
          fragment.appendChild(document.createElement("br"));
      });
    }

    range.insertNode(fragment);
    range.collapse(false);
    selection!.removeAllRanges();
    selection!.addRange(range);

    setTimeout(() => document.dispatchEvent(new Event("selectionchange")), 0);

    if (ref.current) commitValue(ref.current);
  };

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    commitValue(e.currentTarget);
  };

  const activateFromPointer = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (isEditing) return;

    e.preventDefault();
    e.stopPropagation();
    pendingFocusPointRef.current = { x: e.clientX, y: e.clientY };
    clearEditingCallbacks.forEach((clearEditing) => clearEditing());
    setIsEditing(true);
  };

  const handleFocus = () => {
    clearEditingCallbacks.forEach((clearEditing) => clearEditing());
    setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    commitValue(e.currentTarget);

    window.setTimeout(() => {
      if (
        findEditable(document.activeElement) ||
        findPreserver(document.activeElement)
      ) {
        return;
      }
      setIsEditing(false);
      clearSelection();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (Tag !== "span") return;
    if (e.key !== "Enter" && e.key !== "Escape") return;

    e.preventDefault();
    if (e.key === "Escape") {
      e.currentTarget.innerHTML = sanitizeEditableHtml(value || "");
    } else {
      commitValue(e.currentTarget);
    }
    e.currentTarget.blur();
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      commitValue(e.currentTarget);
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.__careerForgeCommit = () => commitValue(el);
    const handleCommit = () => commitValue(el);
    el.addEventListener("editabletext:commit", handleCommit);
    return () => {
      delete el.__careerForgeCommit;
      el.removeEventListener("editabletext:commit", handleCommit);
    };
  }, [commitValue]);

  useEffect(() => registerEditableBlurHandler(), []);

  useEffect(() => {
    const clearEditing = () => setIsEditing(false);
    clearEditingCallbacks.add(clearEditing);
    return () => {
      clearEditingCallbacks.delete(clearEditing);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;

    // Don't replace innerHTML while the toolbar is acting on a selection inside this element.
    // Clicking a toolbar button moves focus to that button, but the selection still lives here.
    // Replacing innerHTML would destroy the selection and hide the toolbar.
    const sel = window.getSelection();
    const hasActiveSelection =
      sel &&
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      el.contains(sel.anchorNode);
    if (hasActiveSelection) return;

    el.innerHTML = sanitizeEditableHtml(value || "");
  }, [value]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !isEditing) return;

    const focusPoint = pendingFocusPointRef.current;
    pendingFocusPointRef.current = null;
    el.focus();

    if (focusPoint) {
      placeCaretFromPoint(el, focusPoint.x, focusPoint.y);
    } else {
      placeCaretAtEnd(el);
    }

    document.dispatchEvent(new Event("selectionchange"));
  }, [isEditing]);

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      contentEditable={isEditing}
      suppressContentEditableWarning
      data-editable-field
      data-editing={isEditing ? "true" : undefined}
      onPointerDown={isEditing ? undefined : activateFromPointer}
      onFocus={handleFocus}
      onPaste={handlePaste}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={`${className} ${!value ? "editable-placeholder" : ""}`.trim()}
      style={style}
      data-placeholder={placeholder || undefined}
    />
  );
};

export default EditableText;
