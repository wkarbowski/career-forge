import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAppState } from "../contexts/AppStateContext";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../i18n";
import { documentApi } from "../services/api";
import ToolbarDropdown from "./ToolbarDropdown";
import {
  applyEditableFormattingCommand,
  getEditableFormattingState,
  type EditableFormattingCommand,
} from "../utils/editableFormatting";

type EditableCommitElement = HTMLElement & {
  __careerForgeCommit?: () => void;
};

const FONT_OPTIONS_SANS = [
  "Inter",
  "Rubik",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "PT Sans",
  "Source Sans 3",
];
const FONT_OPTIONS_SERIF = ["Playfair Display", "Merriweather", "Lora"];

// Scale presets: [name, sender, subject, body]
const CL_SCALE_PRESETS = {
  compact: {
    nameFontSize: 22,
    senderFontSize: 9,
    subjectFontSize: 12,
    bodyFontSize: 10,
  },
  standard: {
    nameFontSize: 28,
    senderFontSize: 11,
    subjectFontSize: 14,
    bodyFontSize: 12,
  },
  spacious: {
    nameFontSize: 34,
    senderFontSize: 13,
    subjectFontSize: 16,
    bodyFontSize: 14,
  },
};

const getActiveClPresetKey = (
  s: Record<string, unknown> | null | undefined,
) => {
  const cur = {
    nameFontSize: s?.nameFontSize,
    senderFontSize: s?.senderFontSize,
    subjectFontSize: s?.subjectFontSize,
    bodyFontSize: s?.bodyFontSize,
  };
  return (
    Object.entries(CL_SCALE_PRESETS).find(
      ([, p]) =>
        p.nameFontSize === cur.nameFontSize &&
        p.senderFontSize === cur.senderFontSize &&
        p.subjectFontSize === cur.subjectFontSize &&
        p.bodyFontSize === cur.bodyFontSize,
    )?.[0] || null
  );
};

export const getClScaleValue = (bodyFontSize: number): number => {
  const min = CL_SCALE_PRESETS.compact.bodyFontSize;
  const mid = CL_SCALE_PRESETS.standard.bodyFontSize;
  const max = CL_SCALE_PRESETS.spacious.bodyFontSize;

  if (bodyFontSize <= min) return 0;
  if (bodyFontSize >= max) return 1;
  if (bodyFontSize <= mid) return ((bodyFontSize - min) / (mid - min)) * 0.5;

  return 0.5 + ((bodyFontSize - mid) / (max - mid)) * 0.5;
};

export const interpolateClScale = (t: number) => {
  const from = t <= 0.5 ? CL_SCALE_PRESETS.compact : CL_SCALE_PRESETS.standard;
  const to = t <= 0.5 ? CL_SCALE_PRESETS.standard : CL_SCALE_PRESETS.spacious;
  const local = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
  const result: Record<string, number> = {};
  for (const key of Object.keys(from)) {
    const value =
      (from as Record<string, number>)[key] +
      ((to as Record<string, number>)[key] -
        (from as Record<string, number>)[key]) *
        local;
    result[key] = Number(value.toFixed(2));
  }
  return result;
};

const fontGroups = [
  {
    label: "Sans-serif",
    options: FONT_OPTIONS_SANS.map((font) => ({
      label: font,
      value: font,
      style: { fontFamily: font },
    })),
  },
  {
    label: "Serif",
    options: FONT_OPTIONS_SERIF.map((font) => ({
      label: font,
      value: font,
      style: { fontFamily: font },
    })),
  },
];

const FontSelect = ({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  ariaLabel: string;
}) => (
  <ToolbarDropdown
    value={value}
    onChange={onChange}
    groups={fontGroups}
    className="toolbar-dropdown--font"
    ariaLabel={ariaLabel}
    placeholder="Select font"
  />
);

const colorInputStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  border: 0,
  padding: 0,
  margin: 0,
  cursor: "pointer",
};

const CLToolbar = () => {
  const { t } = useTranslation();
  const { clSettings, setClSettings } = useAppState();
  const {
    isAuthenticated,
    documentList,
    currentDocumentId,
    refreshDocumentList,
  } = useAuth();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [hasEditableFocus, setHasEditableFocus] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);

  const detectEditableFocus = useCallback(() => {
    const state = getEditableFormattingState();
    setHasEditableFocus(state.hasEditableFocus);
    setIsBold(state.isBold);
    setIsItalic(state.isItalic);
    setIsUnderline(state.isUnderline);
    setIsStrike(state.isStrike);
  }, []);

  useEffect(() => {
    const handle = () => {
      if (
        toolbarRef.current &&
        toolbarRef.current.contains(document.activeElement as Node)
      )
        return;
      detectEditableFocus();
    };
    document.addEventListener("selectionchange", handle);
    document.addEventListener("focusin", handle);
    document.addEventListener("focusout", handle);
    return () => {
      document.removeEventListener("selectionchange", handle);
      document.removeEventListener("focusin", handle);
      document.removeEventListener("focusout", handle);
    };
  }, [detectEditableFocus]);

  const handleToolbarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    if ((e.target as HTMLElement).closest(".ct-formatting button")) {
      e.preventDefault();
    }
  };

  const restoreSelection = () => {
    const saved = savedRangeRef.current;
    if (!saved) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    if (
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      !toolbarRef.current?.contains(sel.anchorNode as Node)
    )
      return true;
    try {
      if (
        !document.body.contains(saved.startContainer) ||
        !document.body.contains(saved.endContainer)
      )
        return false;
      sel.removeAllRanges();
      sel.addRange(saved);
      return true;
    } catch (_) {
      return false;
    }
  };

  const findEditableEl = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    let el: Element | null =
      node.nodeType === 3 ? node.parentElement : (node as Element);
    while (el && (el as HTMLElement).contentEditable !== "true")
      el = el.parentElement;
    return (el as HTMLElement) || null;
  };

  const getTargetEl = () => {
    const saved = savedRangeRef.current;
    if (saved && document.body.contains(saved.startContainer))
      return findEditableEl(saved.startContainer);
    return findEditableEl(window.getSelection()?.anchorNode ?? null);
  };

  const fireInputEvent = (el: HTMLElement | null) => {
    if (!el) return;
    const commit = (el as EditableCommitElement).__careerForgeCommit;
    if (commit) {
      commit();
      return;
    }
    el.dispatchEvent(new Event("editabletext:commit", { bubbles: true }));
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true }),
    );
  };

  const applyFormat = (fn: () => void) => {
    const targetEl = getTargetEl();
    restoreSelection();
    fn();
    fireInputEvent(targetEl);
    detectEditableFocus();
  };

  const applyCommand = (command: EditableFormattingCommand, value?: string) => {
    applyFormat(() => applyEditableFormattingCommand(command, value));
  };

  const handleColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyCommand("foreColor", e.target.value);
  };

  const handleBgColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyCommand("hiliteColor", e.target.value);
  };

  const set = (key: string, val: string) =>
    setClSettings((prev) => ({ ...prev, [key]: val }));

  const nameFont = clSettings?.nameFont || "Open Sans";
  const senderFont = clSettings?.senderFont || "Open Sans";
  const subjectFont = clSettings?.subjectFont || "Open Sans";
  const bodyFont = clSettings?.bodyFont || "Open Sans";

  const clBodyFontSize = clSettings?.bodyFontSize ?? 12;
  const clScaleValue = getClScaleValue(clBodyFontSize);
  const activeClPresetKey = getActiveClPresetKey(
    clSettings as unknown as Record<string, unknown>,
  );

  const handleClScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sizes = interpolateClScale(parseFloat(e.target.value));
    setClSettings((prev) => ({ ...prev, ...sizes }));
  };

  const applyClPreset = (preset: keyof typeof CL_SCALE_PRESETS) => {
    setClSettings((prev) => ({ ...prev, ...CL_SCALE_PRESETS[preset] }));
  };

  const linkedResumeId = (() => {
    if (!isAuthenticated || !currentDocumentId) return null;
    const doc = (documentList || []).find((d) => d.id === currentDocumentId);
    return doc?.linked_resume_id ?? null;
  })();
  const resumeOptions = isAuthenticated
    ? (documentList || [])
        .filter((document) => document.document_type !== "cover_letter")
        .map((document) => ({
          label: document.title,
          value: String(document.id),
        }))
    : [];

  return (
    <div
      ref={toolbarRef}
      className="central-toolbar"
      data-editor-selection-preserver
      onMouseDown={handleToolbarMouseDown}
      role="toolbar"
      aria-label="Cover letter styles"
    >
      {/* ── Cover Letter Typography ── */}
      <div className="ct-section ct-typography">
        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-signature ct-label-icon" />
            {t("centralToolbar.name")}
          </span>
          <FontSelect
            value={nameFont}
            onChange={(e) => set("nameFont", e.target.value)}
            ariaLabel={t("centralToolbar.name")}
          />
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-address-card ct-label-icon" />
            {t("centralToolbar.sender") || "Sender"}
          </span>
          <FontSelect
            value={senderFont}
            onChange={(e) => set("senderFont", e.target.value)}
            ariaLabel={t("centralToolbar.sender") || "Sender"}
          />
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-heading ct-label-icon" />
            {t("coverLetter.subject") || "Subject"}
          </span>
          <FontSelect
            value={subjectFont}
            onChange={(e) => set("subjectFont", e.target.value)}
            ariaLabel={t("coverLetter.subject") || "Subject"}
          />
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-paragraph ct-label-icon" />
            {t("centralToolbar.body")}
          </span>
          <FontSelect
            value={bodyFont}
            onChange={(e) => set("bodyFont", e.target.value)}
            ariaLabel={t("centralToolbar.body")}
          />
        </div>

        <div className="ct-divider" />

        {/* Scale slider */}
        <div className="ct-group ct-scale-group">
          <span className="ct-label">
            <i className="fas fa-text-height ct-label-icon" />
            {t("centralToolbar.scale")}
          </span>
          <div className="ct-scale-controls">
            <div className="ct-scale-presets">
              <button
                className={`ct-preset-btn ${activeClPresetKey === "compact" ? "ct-preset-active" : ""}`}
                onClick={() => applyClPreset("compact")}
                title={t("centralToolbar.compact")}
              >
                {t("centralToolbar.compact")}
              </button>
              <button
                className={`ct-preset-btn ${activeClPresetKey === "standard" ? "ct-preset-active" : ""}`}
                onClick={() => applyClPreset("standard")}
                title={t("centralToolbar.standard")}
              >
                {t("centralToolbar.standard")}
              </button>
              <button
                className={`ct-preset-btn ${activeClPresetKey === "spacious" ? "ct-preset-active" : ""}`}
                onClick={() => applyClPreset("spacious")}
                title={t("centralToolbar.spacious")}
              >
                {t("centralToolbar.spacious")}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={clScaleValue}
              onChange={handleClScaleChange}
              className="ct-scale-slider"
            />
          </div>
        </div>

        <div className="ct-divider" />

        {/* Resume link dropdown */}
        <div className="ct-group">
          <span className="ct-label">
            <i className="fas fa-link ct-label-icon" />
            {t("coverLetterLink.linkedResume")}
          </span>
          <ToolbarDropdown
            value={linkedResumeId ? String(linkedResumeId) : ""}
            onChange={async (e) => {
              const newId = e.target.value || null;
              try {
                if (newId && currentDocumentId) {
                  await documentApi.linkToResume(
                    String(currentDocumentId),
                    newId,
                  );
                } else if (currentDocumentId) {
                  await documentApi.unlinkFromResume(String(currentDocumentId));
                }
                await refreshDocumentList();
              } catch (err) {
                console.error("Failed to update link:", err);
              }
            }}
            groups={[
              {
                label: "",
                options: [{ label: t("coverLetterLink.noLink"), value: "" }],
              },
              ...(resumeOptions.length > 0
                ? [
                    {
                      label: t("templates.types.resume"),
                      options: resumeOptions,
                    },
                  ]
                : []),
            ]}
            className="toolbar-dropdown--wide"
            ariaLabel={t("coverLetterLink.linkedResume")}
            placeholder={t("coverLetterLink.noLink")}
          />
        </div>
      </div>

      <div className="ct-section-divider" />

      {/* ── Inline Formatting ── */}
      <div
        className={`ct-section ct-formatting ${hasEditableFocus ? "" : "ct-disabled"}`}
      >
        <div className="ct-group">
          <button
            onClick={() => applyCommand("bold")}
            className={`ct-btn ${isBold ? "ct-btn--active" : ""}`}
            disabled={!hasEditableFocus}
            title={t("toolbar.bold")}
          >
            <i className="fas fa-bold" />
          </button>
          <button
            onClick={() => applyCommand("italic")}
            className={`ct-btn ${isItalic ? "ct-btn--active" : ""}`}
            disabled={!hasEditableFocus}
            title={t("toolbar.italic")}
          >
            <i className="fas fa-italic" />
          </button>
          <button
            onClick={() => applyCommand("underline")}
            className={`ct-btn ${isUnderline ? "ct-btn--active" : ""}`}
            disabled={!hasEditableFocus}
            title={t("toolbar.underline")}
          >
            <i className="fas fa-underline" />
          </button>
          <button
            onClick={() => applyCommand("strikeThrough")}
            className={`ct-btn ${isStrike ? "ct-btn--active" : ""}`}
            disabled={!hasEditableFocus}
            title={t("toolbar.strike")}
          >
            <i className="fas fa-strikethrough" />
          </button>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <label
            className="ct-color-btn"
            title={t("toolbar.textColor")}
            style={{ position: "relative", display: "inline-flex" }}
          >
            <i className="fas fa-font" />
            <input
              type="color"
              onChange={handleColor}
              disabled={!hasEditableFocus}
              style={colorInputStyle}
            />
          </label>
          <label
            className="ct-color-btn"
            title={t("toolbar.bgColor")}
            style={{ position: "relative", display: "inline-flex" }}
          >
            <i className="fas fa-highlighter" />
            <input
              type="color"
              onChange={handleBgColor}
              disabled={!hasEditableFocus}
              style={colorInputStyle}
            />
          </label>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <button
            onClick={() => applyCommand("justifyLeft")}
            className="ct-btn"
            disabled={!hasEditableFocus}
            title={t("toolbar.alignLeft")}
          >
            <i className="fas fa-align-left" />
          </button>
          <button
            onClick={() => applyCommand("justifyCenter")}
            className="ct-btn"
            disabled={!hasEditableFocus}
            title={t("toolbar.alignCenter")}
          >
            <i className="fas fa-align-center" />
          </button>
          <button
            onClick={() => applyCommand("justifyRight")}
            className="ct-btn"
            disabled={!hasEditableFocus}
            title={t("toolbar.alignRight")}
          >
            <i className="fas fa-align-right" />
          </button>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <button
            onClick={() => applyCommand("insertUnorderedList")}
            className="ct-btn"
            disabled={!hasEditableFocus}
            title={t("toolbar.unorderedList")}
          >
            <i className="fas fa-list-ul" />
          </button>
          <button
            onClick={() => applyCommand("insertOrderedList")}
            className="ct-btn"
            disabled={!hasEditableFocus}
            title={t("toolbar.orderedList")}
          >
            <i className="fas fa-list-ol" />
          </button>
        </div>

        <div className="ct-divider" />

        <div className="ct-group">
          <button
            onClick={() => applyCommand("removeFormat")}
            className="ct-btn"
            disabled={!hasEditableFocus}
            title={t("toolbar.removeFormat")}
          >
            <i className="fas fa-eraser" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CLToolbar;
