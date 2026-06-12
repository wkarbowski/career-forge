import React, { useRef, useState } from "react";
import { usePages, PAGE_CONFIG } from "../contexts/PageContext";
import { useAppState } from "../contexts/AppStateContext";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../i18n";
import { documentApi } from "../services/api";
import EditableText from "./EditableText";
import PageControls from "./PageControls";
import DocumentPage from "./DocumentPage";
import "./CoverLetterEditor.css";

const BACKGROUND_FREE_CL_FIELDS = [
  "name",
  "street",
  "city",
  "phone",
  "email",
  "recipientCompany",
  "recipientContact",
  "recipientStreet",
  "recipientCity",
  "place",
  "date",
  "subject",
  "salutation",
];

const stripInlineBackgroundStyles = (value: unknown) => {
  if (typeof value !== "string" || !/background(?:-color)?\s*:/i.test(value))
    return value;

  if (typeof document === "undefined") {
    return value.replace(/\s*background(?:-color)?\s*:\s*[^;"]+;?/gi, "");
  }

  const container = document.createElement("div");
  container.innerHTML = value;
  container.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    el.style.removeProperty("background");
    el.style.removeProperty("background-color");
    if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
  });
  return container.innerHTML;
};

const stripCoverLetterFieldBackground = (field: string, value: unknown) =>
  BACKGROUND_FREE_CL_FIELDS.includes(field)
    ? stripInlineBackgroundStyles(value)
    : value;

const hasEditableText = (value: unknown) => {
  if (typeof value !== "string") return false;

  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = value;
    return Boolean(container.textContent?.replace(/\u00a0/g, " ").trim());
  }

  let text = "";
  let insideTag = false;
  for (const char of value) {
    if (char === "<") {
      insideTag = true;
      continue;
    }
    if (char === ">") {
      insideTag = false;
      continue;
    }
    if (!insideTag) text += char;
  }

  return Boolean(text.replace(/&nbsp;/gi, " ").trim());
};

const BASE_RECIPIENT_FIELDS = [
  {
    key: "recipientCompany",
    className: "cl-recipient-line cl-recipient-company",
    placeholderKey: "coverLetter.recipientCompany",
  },
  {
    key: "recipientContact",
    className: "cl-recipient-line cl-recipient-contact",
    placeholderKey: "coverLetter.recipientContact",
  },
  {
    key: "recipientStreet",
    className: "cl-recipient-line",
    placeholderKey: "coverLetter.recipientStreet",
  },
  {
    key: "recipientCity",
    className: "cl-recipient-line",
    placeholderKey: "coverLetter.recipientCity",
  },
] as const;

type BaseRecipientFieldKey = (typeof BASE_RECIPIENT_FIELDS)[number]["key"];

/**
 * CoverLetterEditor
 *
 * Standard cover letter layout:
 *   Sender → Recipient + Place/Date → Subject → Salutation → Body → Closing → Signature
 */
const CoverLetterEditor = () => {
  const { zoom, setZoom, pages, removePage } = usePages();
  const { coverLetterData, setCoverLetterData, clSettings, settings } =
    useAppState();
  const {
    isAuthenticated,
    documentList,
    currentDocumentId,
    refreshDocumentList,
  } = useAuth();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const signatureResizeRef = useRef<{
    startX: number;
    startY: number;
    startSize: number;
  } | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  const todayFormatted = React.useMemo(() => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }, []);

  const set = (field: string, value: unknown) =>
    setCoverLetterData((prev) => ({
      ...prev,
      [field]: stripCoverLetterFieldBackground(field, value),
    }));

  React.useEffect(() => {
    setCoverLetterData((prev) => {
      let changed = false;
      const next = { ...prev };
      const nextRecord = next as unknown as Record<string, unknown>;

      BACKGROUND_FREE_CL_FIELDS.forEach((field) => {
        const cleaned = stripInlineBackgroundStyles(nextRecord[field]);
        if (cleaned !== nextRecord[field]) {
          nextRecord[field] = cleaned;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [setCoverLetterData]);

  // Filter document list to resumes only for the linking dropdown
  const resumeList = (documentList || []).filter((doc) => {
    try {
      return doc.document_type !== "cover_letter";
    } catch {
      return true;
    }
  });

  // Get current linked_resume_id from document metadata (not JSONB)
  const currentDoc = (documentList || []).find(
    (d) => d.id === currentDocumentId,
  );
  const linkedResumeId = currentDoc?.linked_resume_id ?? null;

  const handleLinkChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newResumeId = e.target.value || null;
    try {
      if (newResumeId && currentDocumentId) {
        await documentApi.linkToResume(String(currentDocumentId), newResumeId);
      } else if (currentDocumentId) {
        await documentApi.unlinkFromResume(String(currentDocumentId));
      }
      await refreshDocumentList();
    } catch (err) {
      console.error("Failed to update link:", err);
    }
  };

  const getCanvasPos = (
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement,
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getCanvasPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pos = getCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    set("signatureImage", canvas.toDataURL("image/png"));
    setDrawMode(false);
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("signatureImage", ev.target?.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startSignatureResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    signatureResizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startSize: signatureImageSize,
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";

    const handleMove = (event: PointerEvent) => {
      const resize = signatureResizeRef.current;
      if (!resize) return;
      const deltaX = (event.clientX - resize.startX) / zoom;
      const deltaY = (event.clientY - resize.startY) / zoom;
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      const nextSize = Math.min(
        120,
        Math.max(32, Math.round(resize.startSize + delta)),
      );
      set("signatureImageSize", nextSize);
    };

    const handleUp = () => {
      signatureResizeRef.current = null;
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  // Ctrl/Meta + wheel → zoom
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const step = 0.1;
      setZoom((prev) =>
        e.deltaY < 0 ? Math.min(prev + step, 2) : Math.max(prev - step, 0.5),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  const d = coverLetterData;
  const hasRecipientContact = hasEditableText(d.recipientContact);
  const rawSignatureImageSize = Number(d.signatureImageSize);
  const signatureImageSize = Number.isFinite(rawSignatureImageSize)
    ? Math.min(120, Math.max(32, rawSignatureImageSize))
    : 56;

  const clStyle = settings?.clStyle || "standard";
  const hasHeaderBand = clStyle === "classic" || clStyle === "executive";

  const clCssVars = {
    "--accent-color": settings?.accentColor || "#2563eb",
    "--cl-text-color": "#1a1a1a",
    "--sidebar-color-1": settings?.sidebarColor1 || "",
    "--sidebar-color-2": settings?.sidebarColor2 || "",
    "--cl-name-font": `'${clSettings?.nameFont || "Open Sans"}', sans-serif`,
    "--cl-name-font-size": `${clSettings?.nameFontSize ?? 28}px`,
    "--cl-sender-font": `'${clSettings?.senderFont || "Open Sans"}', sans-serif`,
    "--cl-sender-font-size": `${clSettings?.senderFontSize ?? 11}px`,
    "--cl-subject-font": `'${clSettings?.subjectFont || "Open Sans"}', sans-serif`,
    "--cl-subject-font-size": `${clSettings?.subjectFontSize ?? 13}px`,
    "--cl-body-font": `'${clSettings?.bodyFont || "Open Sans"}', sans-serif`,
    "--cl-body-font-size": `${clSettings?.bodyFontSize ?? 12}px`,
  } as React.CSSProperties;

  const GAP = 40;
  const canvasNaturalHeight =
    pages.length * PAGE_CONFIG.height + Math.max(0, pages.length - 1) * GAP;
  const scaledCanvasHeight = Math.ceil(canvasNaturalHeight * zoom);
  const scaledCanvasWidth = Math.ceil(PAGE_CONFIG.width * zoom);
  const extraRecipientLines = d.extraRecipientLines || [];
  const defaultRecipientLineOrder = [
    ...BASE_RECIPIENT_FIELDS.map((field) => field.key),
    ...extraRecipientLines.map((_, index) => `extra:${index}`),
  ];
  const validRecipientLineKeys = new Set(defaultRecipientLineOrder);
  const recipientLineOrder = [
    ...(d.recipientLineOrder || []).filter(
      (key, index, order) =>
        validRecipientLineKeys.has(key) && order.indexOf(key) === index,
    ),
    ...defaultRecipientLineOrder.filter(
      (key) => !(d.recipientLineOrder || []).includes(key),
    ),
  ];

  const handleRemovePage = (pageIndex: number) => {
    removePage(pageIndex);
    if (pageIndex > 0) {
      const extraIndex = pageIndex - 1;
      set("extraPages", [
        ...(d.extraPages || []).slice(0, extraIndex),
        ...(d.extraPages || []).slice(extraIndex + 1),
      ]);
    }
  };

  const updateExtraRecipientLine = (index: number, value: string) => {
    const next = [...extraRecipientLines];
    next[index] = value;
    set("extraRecipientLines", next);
  };

  const addExtraRecipientLine = () => {
    setCoverLetterData((prev) => {
      const nextLines = [...(prev.extraRecipientLines || []), ""];
      const nextKey = `extra:${nextLines.length - 1}`;
      const currentOrder = recipientLineOrder.filter((key) =>
        key.startsWith("extra:")
          ? Number(key.slice(6)) < nextLines.length - 1
          : true,
      );

      return {
        ...prev,
        extraRecipientLines: nextLines,
        recipientLineOrder: [...currentOrder, nextKey],
      };
    });
  };

  const removeExtraRecipientLine = (index: number) => {
    setCoverLetterData((prev) => {
      const nextLines = (prev.extraRecipientLines || []).filter(
        (_, i) => i !== index,
      );
      const nextOrder = recipientLineOrder
        .map((key) => {
          if (!key.startsWith("extra:")) return key;
          const extraIndex = Number(key.slice(6));
          if (extraIndex === index) return null;
          return extraIndex > index ? `extra:${extraIndex - 1}` : key;
        })
        .filter((key): key is string => Boolean(key));

      return {
        ...prev,
        extraRecipientLines: nextLines,
        recipientLineOrder: nextOrder,
      };
    });
  };

  const moveExtraRecipientLine = (index: number, direction: -1 | 1) => {
    const key = `extra:${index}`;
    const currentIndex = recipientLineOrder.indexOf(key);
    const targetIndex = currentIndex + direction;
    if (
      currentIndex === -1 ||
      targetIndex < 0 ||
      targetIndex >= recipientLineOrder.length
    ) {
      return;
    }

    const nextOrder = [...recipientLineOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];
    set("recipientLineOrder", nextOrder);
  };

  return (
    <div className="cl-editor" ref={containerRef}>
      {/* ── Linked Resume Selector ── */}
      {isAuthenticated && resumeList.length > 0 && (
        <div className="cl-linked-resume">
          <i className="fas fa-link"></i>
          <label>{t("coverLetterLink.linkedResume")}</label>
          <select value={linkedResumeId || ""} onChange={handleLinkChange}>
            <option value="">{t("coverLetterLink.selectResume")}</option>
            {resumeList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div
        className="cl-canvas-frame"
        style={{ height: scaledCanvasHeight, width: scaledCanvasWidth }}
      >
        <div
          className="cl-canvas"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          {/* ── Page 1: Structured letter ── */}
          <div className="cv-page-wrapper">
            <DocumentPage
              className={`cl-page cl-style-${clStyle}`}
              active
              pageIndex={0}
              style={{ ...clCssVars }}
            >
              {/* ── Header band (classic / executive variants) ── */}
              {hasHeaderBand && (
                <div className="cl-header-band">
                  <div className="cl-sender">
                    <EditableText
                      value={d.name}
                      onChange={(v) => set("name", v)}
                      tag="span"
                      className="cl-sender-name"
                      placeholder={t("coverLetter.name")}
                    />
                    <EditableText
                      value={d.street}
                      onChange={(v) => set("street", v)}
                      tag="span"
                      className="cl-sender-line"
                      placeholder={t("coverLetter.street")}
                    />
                    <EditableText
                      value={d.city}
                      onChange={(v) => set("city", v)}
                      tag="span"
                      className="cl-sender-line"
                      placeholder={t("coverLetter.city")}
                    />
                    <div className="cl-sender-contact">
                      <EditableText
                        value={d.phone}
                        onChange={(v) => set("phone", v)}
                        tag="span"
                        className="cl-sender-contact-item"
                        placeholder={t("coverLetter.phone")}
                      />
                      <span className="cl-contact-sep">·</span>
                      <EditableText
                        value={d.email}
                        onChange={(v) => set("email", v)}
                        tag="span"
                        className="cl-sender-contact-item"
                        placeholder={t("coverLetter.email")}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Gold accent rule (executive only) ── */}
              {clStyle === "executive" && (
                <div className="cl-header-accent-rule" />
              )}

              {/* ── Sender (shown inline for modern / standard) ── */}
              {!hasHeaderBand && (
                <div className="cl-sender cl-sender-inline">
                  <EditableText
                    value={d.name}
                    onChange={(v) => set("name", v)}
                    tag="span"
                    className="cl-sender-name"
                    placeholder={t("coverLetter.name")}
                  />
                  <EditableText
                    value={d.street}
                    onChange={(v) => set("street", v)}
                    tag="span"
                    className="cl-sender-line"
                    placeholder={t("coverLetter.street")}
                  />
                  <EditableText
                    value={d.city}
                    onChange={(v) => set("city", v)}
                    tag="span"
                    className="cl-sender-line"
                    placeholder={t("coverLetter.city")}
                  />
                  <div className="cl-sender-contact">
                    <EditableText
                      value={d.phone}
                      onChange={(v) => set("phone", v)}
                      tag="span"
                      className="cl-sender-contact-item"
                      placeholder={t("coverLetter.phone")}
                    />
                    <span className="cl-contact-sep">·</span>
                    <EditableText
                      value={d.email}
                      onChange={(v) => set("email", v)}
                      tag="span"
                      className="cl-sender-contact-item"
                      placeholder={t("coverLetter.email")}
                    />
                  </div>
                </div>
              )}

              {/* ── Recipient + place/date (two-column row) ── */}
              <div className="cl-meta-row">
                {/* Recipient — left */}
                <div className="cl-recipient">
                  {recipientLineOrder.map((key, displayIndex) => {
                    if (key.startsWith("extra:")) {
                      const index = Number(key.slice(6));
                      const line = extraRecipientLines[index] || "";

                      return (
                        <div
                          className={`cl-extra-recipient-line${
                            hasEditableText(line) ? "" : " cl-empty-on-print"
                          }`}
                          key={key}
                        >
                          <EditableText
                            value={line}
                            onChange={(v) => updateExtraRecipientLine(index, v)}
                            tag="span"
                            className="cl-recipient-line"
                            placeholder={t("coverLetter.extraRecipientLine")}
                          />
                          <div className="cl-extra-recipient-controls hide-on-print">
                            <button
                              type="button"
                              className="move-btn"
                              aria-label={t(
                                "coverLetter.moveExtraRecipientLineUp",
                              )}
                              title={t("coverLetter.moveExtraRecipientLineUp")}
                              disabled={displayIndex === 0}
                              onClick={() =>
                                moveExtraRecipientLine(index, -1)
                              }
                            >
                              <i
                                className="fas fa-arrow-up"
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              type="button"
                              className="move-btn"
                              aria-label={t(
                                "coverLetter.moveExtraRecipientLineDown",
                              )}
                              title={t(
                                "coverLetter.moveExtraRecipientLineDown",
                              )}
                              disabled={
                                displayIndex === recipientLineOrder.length - 1
                              }
                              onClick={() => moveExtraRecipientLine(index, 1)}
                            >
                              <i
                                className="fas fa-arrow-down"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="social-link-remove-field hide-on-print"
                            aria-label={t(
                              "coverLetter.removeExtraRecipientLine",
                            )}
                            title={t("coverLetter.removeExtraRecipientLine")}
                            onClick={() => removeExtraRecipientLine(index)}
                          >
                            <i className="fas fa-times" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    }

                    const field = BASE_RECIPIENT_FIELDS.find(
                      (item) => item.key === key,
                    );
                    if (!field) return null;

                    return (
                      <EditableText
                        key={field.key}
                        value={d[field.key as BaseRecipientFieldKey]}
                        onChange={(v) => set(field.key, v)}
                        tag="span"
                        className={`${field.className}${
                          field.key === "recipientContact" &&
                          !hasRecipientContact
                            ? " cl-empty-on-print"
                            : ""
                        }`}
                        placeholder={t(field.placeholderKey)}
                      />
                    );
                  })}
                  <button
                    type="button"
                    className="add-link-btn hide-on-print cl-add-recipient-line"
                    title={t("coverLetter.addExtraRecipientLine")}
                    aria-label={t("coverLetter.addExtraRecipientLine")}
                    onClick={addExtraRecipientLine}
                  >
                    <i className="fas fa-plus" aria-hidden="true" />
                  </button>
                </div>

                {/* Place, date — right */}
                <div className="cl-place-date-wrapper">
                  <button
                    className="cl-today-btn"
                    onClick={() => set("date", todayFormatted)}
                    title={t("coverLetter.setToday")}
                  >
                    <i className="fas fa-calendar-check" />
                    {t("coverLetter.today")}
                  </button>
                  <div className="cl-place-date">
                    <EditableText
                      value={d.place}
                      onChange={(v) => set("place", v)}
                      tag="span"
                      className="cl-place"
                      placeholder={t("coverLetter.place")}
                    />
                    <span className="cl-date-comma">, </span>
                    <EditableText
                      value={d.date}
                      onChange={(v) => set("date", v)}
                      tag="span"
                      className="cl-date"
                      placeholder={t("coverLetter.date")}
                    />
                  </div>
                </div>
              </div>

              {/* ── Subject ── */}
              <div className="cl-subject-row">
                <EditableText
                  value={d.subject}
                  onChange={(v) => set("subject", v)}
                  tag="span"
                  className="cl-subject"
                  placeholder={t("coverLetter.subject")}
                />
              </div>

              {/* ── Salutation ── */}
              <div className="cl-salutation-row">
                <EditableText
                  value={d.salutation}
                  onChange={(v) => set("salutation", v)}
                  tag="span"
                  className="cl-salutation"
                  placeholder={t("coverLetter.salutation")}
                />
              </div>

              {/* ── Letter body ── */}
              <div className="cl-body-row">
                <EditableText
                  value={d.body}
                  onChange={(v) => set("body", v)}
                  tag="div"
                  className="cl-body"
                  placeholder={t("coverLetter.body")}
                />
              </div>

              {/* ── Closing ── */}
              <div className="cl-closing-row">
                <EditableText
                  value={d.closing}
                  onChange={(v) => set("closing", v)}
                  tag="span"
                  className="cl-closing"
                  placeholder={t("coverLetter.closing")}
                />
              </div>

              {/* ── Signature ── */}
              <div className="cl-signature-row">
                {/* Signature image / draw / upload area */}
                <div className="cl-sig-area">
                  {d.signatureImage ? (
                    <div className="cl-sig-preview">
                      <div className="cl-sig-image-wrap">
                        <img
                          src={d.signatureImage}
                          alt="Signature"
                          className="cl-sig-img"
                          style={
                            {
                              "--cl-signature-image-height": `${signatureImageSize}px`,
                            } as React.CSSProperties
                          }
                        />
                        <button
                          className="cl-sig-remove"
                          onClick={() => set("signatureImage", null)}
                          title={t("buttons.delete")}
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
                      </div>
                      <button
                        type="button"
                        className="cl-sig-resize"
                        onPointerDown={startSignatureResize}
                        title={t("coverLetter.signatureSize")}
                        aria-label={t("coverLetter.signatureSize")}
                      />
                    </div>
                  ) : drawMode ? (
                    <div className="cl-sig-draw-wrapper">
                      <canvas
                        ref={canvasRef}
                        className="cl-sig-canvas"
                        width={400}
                        height={110}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={endDraw}
                      />
                      <div className="cl-sig-draw-actions">
                        <button
                          className="cl-sig-btn-ghost"
                          onClick={clearCanvas}
                        >
                          <i className="fas fa-redo" />{" "}
                          {t("coverLetter.sigClear")}
                        </button>
                        <button
                          className="cl-sig-btn-primary"
                          onClick={saveSignature}
                        >
                          <i className="fas fa-check" />{" "}
                          {t("coverLetter.sigSave")}
                        </button>
                        <button
                          className="cl-sig-btn-ghost"
                          onClick={() => setDrawMode(false)}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cl-sig-controls">
                      <label
                        className="cl-sig-btn-secondary"
                        htmlFor="cl-sig-file"
                      >
                        <i className="fas fa-upload" />{" "}
                        {t("coverLetter.sigUpload")}
                      </label>
                      <input
                        id="cl-sig-file"
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        style={{ display: "none" }}
                        onChange={handleSigUpload}
                      />
                      <button
                        className="cl-sig-btn-secondary"
                        onClick={() => setDrawMode(true)}
                      >
                        <i className="fas fa-pen-nib" />{" "}
                        {t("coverLetter.sigDraw")}
                      </button>
                    </div>
                  )}
                </div>

                <EditableText
                  value={d.signature}
                  onChange={(v) => set("signature", v)}
                  tag="span"
                  className="cl-signature"
                  placeholder={t("coverLetter.signature")}
                />
              </div>
            </DocumentPage>
          </div>

          {/* ── Pages 2+: Continuation sheets ── */}
          {pages.slice(1).map((page, i) => (
            <div key={page.id} className="cv-page-wrapper">
              <DocumentPage
                className="cl-page cl-continuation-page"
                pageIndex={i + 1}
                style={{ ...clCssVars }}
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="cl-body"
                  style={{
                    minHeight: PAGE_CONFIG.height - 133,
                    outline: "none",
                  }}
                  onInput={(e) => {
                    const html = e.currentTarget.innerHTML;
                    set("extraPages", [
                      ...(d.extraPages || []).slice(0, i),
                      html,
                      ...(d.extraPages || []).slice(i + 1),
                    ]);
                  }}
                  dangerouslySetInnerHTML={{
                    __html: (d.extraPages || [])[i] || "",
                  }}
                />
              </DocumentPage>
            </div>
          ))}
        </div>
      </div>

      <PageControls onRemovePage={handleRemovePage} />
    </div>
  );
};

export default CoverLetterEditor;
