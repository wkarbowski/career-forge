import React, { useRef, useEffect, useCallback } from "react";
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

const EditableText = ({
  value,
  onChange,
  className = "",
  tag: Tag = "span",
  style = {},
  placeholder = "",
}: EditableTextProps) => {
  const ref = useRef<EditableCommitElement>(null);

  const decodeEntities = (str: string) => {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  };

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

    const decoded = decodeEntities(value || "");
    el.innerHTML = sanitizeEditableHtml(decoded);
  }, [value]);

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      contentEditable
      suppressContentEditableWarning
      onPaste={handlePaste}
      onInput={handleInput}
      onKeyUp={handleKeyUp}
      className={`${className} ${!value ? "editable-placeholder" : ""}`.trim()}
      style={style}
      data-placeholder={placeholder || undefined}
    />
  );
};

export default EditableText;
