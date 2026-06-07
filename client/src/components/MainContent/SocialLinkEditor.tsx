import { useState } from "react";
import SocialIconPicker from "./SocialIconPicker";

const stripHtml = (html: string): string =>
  html ? html.replace(/<[^>]+>/g, "").trim() : "";

const formatUrlForDisplay = (value: string): string => {
  const cleaned = stripHtml(value);
  if (!cleaned) return "";

  try {
    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    return cleaned
      .replace(/^[a-z][a-z\d+.-]*:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/[?#].*$/, "")
      .replace(/\/$/, "");
  }
};

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
  const [draftUrl, setDraftUrl] = useState("");

  const startEditing = () => {
    setDraftUrl(stripHtml(url));
    setEditing(true);
  };

  const confirmEdit = () => {
    onUrlChange(draftUrl.trim());
    setEditing(false);
  };

  const cancelEdit = () => {
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
          className="social-link-url-shell"
          onClick={startEditing}
          style={{
            position: "relative",
            display: "inline-block",
            maxWidth: "100%",
            minWidth: 180,
            minHeight: 18,
            cursor: "text",
          }}
        >
          {url ? (
            <span
              className="platform-url"
              style={{
                display: "inline",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                transition: "opacity 0.18s",
              }}
            >
              {formatUrlForDisplay(url)}
            </span>
          ) : (
            <span
              className="platform-url-placeholder hide-on-print"
              style={{
                color: "#bbb",
                fontSize: "inherit",
                display: "inline-block",
                minWidth: 180,
                transition: "opacity 0.18s",
              }}
            >
              {t("placeholders.website")}
            </span>
          )}
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
              onClick={(event) => {
                event.stopPropagation();
                startEditing();
              }}
              tabIndex={-1}
              style={{
                ...btnBase,
                color: "var(--accent-color)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Edit
            </button>
            {url && (
              <button
                type="button"
                aria-label="Delete URL"
                title="Delete URL"
                onClick={(event) => {
                  event.stopPropagation();
                  onUrlChange("");
                }}
                tabIndex={-1}
                style={{
                  ...btnBase,
                  color: "#c0392b",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            )}
          </span>
        </span>
      )}

      {!editing && onDelete && (
        <button
          type="button"
          className="social-link-remove-field hide-on-print"
          aria-label="Remove URL field"
          title="Remove URL field"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      )}

      {editing && (
        <>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              maxWidth: "100%",
              minWidth: 220,
              minHeight: 22,
            }}
          >
            <input
              type="text"
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmEdit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEdit();
                }
              }}
              placeholder={t("placeholders.website")}
              style={{
                display: "block",
                width: "min(360px, 42vw)",
                minWidth: 220,
                maxWidth: "100%",
                border: "none",
                background: "transparent",
                color: "inherit",
                font: "inherit",
                outline: "none",
                padding: 0,
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
            style={{
              ...btnBase,
              marginLeft: 6,
              color: "var(--accent-color)",
            }}
          >
            <i className="fas fa-check" style={{ fontSize: "12px" }} />
          </button>
          <button
            type="button"
            aria-label="Cancel"
            className="contact-url-cancel-btn hide-on-print"
            onMouseDown={(e) => {
              e.preventDefault();
              cancelEdit();
            }}
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
