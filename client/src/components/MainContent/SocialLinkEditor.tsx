import React, { useState } from "react";
import SocialIconPicker from "./SocialIconPicker";
import EditableText from "./EditableText";

const stripHtml = (html: string): string =>
  html ? html.replace(/<[^>]+>/g, "").trim() : "";

const btnBase = {
  background: "none",
  border: "none",
  padding: "0 2px",
  cursor: "pointer",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
};

interface SocialLinkEditorProps {
  icon: string;
  url: string;
  onIconChange: (iconClass: string) => void;
  onUrlChange: (url: string) => void;
  onDelete?: () => void;
  t: (key: string) => string;
}

const SocialLinkEditor = ({
  icon,
  url,
  onIconChange,
  onUrlChange,
  onDelete,
  t,
}: SocialLinkEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [originalUrl, setOriginalUrl] = useState("");

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
    <span
      className="contact-item social-link-item"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <SocialIconPicker value={icon} onChange={onIconChange} />

      {!editing && (
        <span
          style={{
            position: "relative",
            display: "inline-block",
            width: 120,
            flexShrink: 0,
          }}
        >
          {url ? (
            <span
              className="platform-url"
              onClick={startEditing}
              style={{
                display: "inline-block",
                width: "100%",
                overflow: "hidden",
                whiteSpace: "nowrap",
                cursor: "text",
                transition: "opacity 0.18s",
              }}
            >
              {stripHtml(url).replace(/^https?:\/\/(www\.)?/, "")}
            </span>
          ) : (
            <span
              className="platform-url-placeholder hide-on-print"
              onClick={startEditing}
              style={{
                color: "#bbb",
                cursor: "text",
                fontSize: "inherit",
                display: "inline-block",
                width: "100%",
                overflow: "hidden",
                whiteSpace: "nowrap",
                transition: "opacity 0.18s",
              }}
            >
              {t("placeholders.website")}
            </span>
          )}
          {/* Buttons overlay inside the same 120px slot — no layout impact */}
          <span
            className="social-link-actions hide-on-print"
            style={{
              position: "absolute",
              inset: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: 0,
              pointerEvents: "none",
              transition: "opacity 0.18s",
            }}
          >
            <button
              type="button"
              aria-label="Edit URL"
              onClick={startEditing}
              tabIndex={-1}
              style={{ ...btnBase, color: "var(--accent-color)" }}
            >
              <i className="fas fa-pen" style={{ fontSize: "11px" }} />
            </button>
            {onDelete && (
              <button
                type="button"
                aria-label="Remove link"
                onClick={onDelete}
                tabIndex={-1}
                style={{ ...btnBase, color: "#c0392b" }}
              >
                <i className="fas fa-times" style={{ fontSize: "11px" }} />
              </button>
            )}
          </span>
        </span>
      )}

      {editing && (
        <>
          <span style={{ display: "inline-block" }}>
            <EditableText
              value={url}
              onChange={onUrlChange}
              placeholder={t("placeholders.website")}
              style={{
                display: "inline-block",
                width: 120,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
              autoFocus
            />
          </span>
          <button
            type="button"
            aria-label="Save"
            className="hide-on-print"
            onMouseDown={(e) => {
              e.preventDefault();
              confirmEdit();
            }}
            style={{ ...btnBase, marginLeft: 4, color: "var(--accent-color)" }}
          >
            <i className="fas fa-check" style={{ fontSize: "12px" }} />
          </button>
          <button
            type="button"
            aria-label="Cancel"
            className="hide-on-print"
            onMouseDown={(e) => {
              e.preventDefault();
              cancelEdit();
            }}
            style={{ ...btnBase, marginLeft: 2, color: "#999" }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 1L9 9M9 1L1 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </>
      )}
    </span>
  );
};

export default SocialLinkEditor;
