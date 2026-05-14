import React, { useRef, useState } from 'react';
import { usePages, PAGE_CONFIG } from '../contexts/PageContext';
import { useAppState } from '../contexts/AppStateContext';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import { documentApi } from '../services/api';
import EditableText from './EditableText';
import PageControls from './PageControls';
import './CoverLetterEditor.css';

/**
 * CoverLetterEditor
 *
 * Standard cover letter layout:
 *   Sender → Recipient + Place/Date → Subject → Salutation → Body → Closing → Signature
 */
const CoverLetterEditor = () => {
  const { zoom, setZoom, pages, removePage, userForcedMaxRef } = usePages();
  const { coverLetterData, setCoverLetterData, clSettings, settings } = useAppState();
  const { isAuthenticated, documentList, currentDocumentId, refreshDocumentList } = useAuth();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  const todayFormatted = React.useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat(navigator.language || 'en', {
      day: '2-digit', month: '2-digit', year: '2-digit', timeZone: tz,
    }).format(new Date());
  }, []);

  const set = (field: string, value: unknown) =>
    setCoverLetterData(prev => ({ ...prev, [field]: value }));

  // Filter document list to resumes only for the linking dropdown
  const resumeList = (documentList || []).filter(doc => {
    try { return doc.document_type !== 'cover_letter'; } catch { return true; }
  });

  // Get current linked_resume_id from document metadata (not JSONB)
  const currentDoc = (documentList || []).find(d => d.id === currentDocumentId);
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
      console.error('Failed to update link:', err);
    }
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
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
    const ctx = canvas.getContext('2d')!;
    const pos = getCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    set('signatureImage', canvas.toDataURL('image/png'));
    setDrawMode(false);
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set('signatureImage', ev.target?.result);
    reader.readAsDataURL(file);
    e.target.value = '';
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
      setZoom(prev =>
        e.deltaY < 0 ? Math.min(prev + step, 2) : Math.max(prev - step, 0.5)
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  const d = coverLetterData;

  const clStyle = settings?.clStyle || 'standard';
  const hasHeaderBand = clStyle === 'classic' || clStyle === 'executive';

  const clCssVars = {
    '--accent-color':         settings?.accentColor || '#2563eb',
    '--sidebar-color-1':      settings?.sidebarColor1 || '',
    '--sidebar-color-2':      settings?.sidebarColor2 || '',
    '--cl-name-font':         `'${clSettings?.nameFont    || 'Open Sans'}', sans-serif`,
    '--cl-name-font-size':    `${clSettings?.nameFontSize  ?? 28}px`,
    '--cl-sender-font':       `'${clSettings?.senderFont   || 'Open Sans'}', sans-serif`,
    '--cl-sender-font-size':  `${clSettings?.senderFontSize ?? 11}px`,
    '--cl-subject-font':      `'${clSettings?.subjectFont  || 'Open Sans'}', sans-serif`,
    '--cl-subject-font-size': `${clSettings?.subjectFontSize ?? 13}px`,
    '--cl-body-font':         `'${clSettings?.bodyFont    || 'Open Sans'}', sans-serif`,
    '--cl-body-font-size':    `${clSettings?.bodyFontSize  ?? 12}px`,
  };

  const GAP = 40;
  const canvasNaturalHeight = pages.length * PAGE_CONFIG.height + Math.max(0, pages.length - 1) * GAP;
  const zoomPaddingBottom = Math.ceil(canvasNaturalHeight * Math.max(0, zoom - 1)) + 100;

  return (
    <div className="cl-editor" ref={containerRef} style={{ paddingBottom: zoomPaddingBottom }}>
      {/* ── Linked Resume Selector ── */}
      {isAuthenticated && resumeList.length > 0 && (
        <div className="cl-linked-resume">
          <i className="fas fa-link"></i>
          <label>{t('coverLetterLink.linkedResume')}</label>
          <select
            value={linkedResumeId || ''}
            onChange={handleLinkChange}
          >
            <option value="">{t('coverLetterLink.selectResume')}</option>
            {resumeList.map(r => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </div>
      )}
      <div
        className="cl-canvas"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
      >
        {/* ── Page 1: Structured letter ── */}
        <div className="cv-page-wrapper">
          {pages.length > 1 && (
            <button
              className="cv-page-remove-btn"
              onClick={() => {
                userForcedMaxRef.current = pages.length - 1;
                removePage(0);
              }}
              title={t('pages.removePage')}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          )}
        <div
          className={`cl-page cl-style-${clStyle}`}
          style={{ width: PAGE_CONFIG.width, minHeight: PAGE_CONFIG.height, ...clCssVars }}
        >

          {/* ── Header band (classic / executive variants) ── */}
          {hasHeaderBand && (
            <div className="cl-header-band">
              <div className="cl-sender">
                <EditableText
                  value={d.name}
                  onChange={v => set('name', v)}
                  tag="span"
                  className="cl-sender-name"
                  placeholder={t('coverLetter.name')}
                />
                <EditableText
                  value={d.street}
                  onChange={v => set('street', v)}
                  tag="span"
                  className="cl-sender-line"
                  placeholder={t('coverLetter.street')}
                />
                <EditableText
                  value={d.city}
                  onChange={v => set('city', v)}
                  tag="span"
                  className="cl-sender-line"
                  placeholder={t('coverLetter.city')}
                />
                <div className="cl-sender-contact">
                  <EditableText
                    value={d.phone}
                    onChange={v => set('phone', v)}
                    tag="span"
                    className="cl-sender-contact-item"
                    placeholder={t('coverLetter.phone')}
                  />
                  <span className="cl-contact-sep">·</span>
                  <EditableText
                    value={d.email}
                    onChange={v => set('email', v)}
                    tag="span"
                    className="cl-sender-contact-item"
                    placeholder={t('coverLetter.email')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Gold accent rule (executive only) ── */}
          {clStyle === 'executive' && <div className="cl-header-accent-rule" />}

          {/* ── Absender (shown inline for modern / standard) ── */}
          {!hasHeaderBand && (
          <div className="cl-sender cl-sender-inline">
            <EditableText
              value={d.name}
              onChange={v => set('name', v)}
              tag="span"
              className="cl-sender-name"
              placeholder={t('coverLetter.name')}
            />
            <EditableText
              value={d.street}
              onChange={v => set('street', v)}
              tag="span"
              className="cl-sender-line"
              placeholder={t('coverLetter.street')}
            />
            <EditableText
              value={d.city}
              onChange={v => set('city', v)}
              tag="span"
              className="cl-sender-line"
              placeholder={t('coverLetter.city')}
            />
            <div className="cl-sender-contact">
              <EditableText
                value={d.phone}
                onChange={v => set('phone', v)}
                tag="span"
                className="cl-sender-contact-item"
                placeholder={t('coverLetter.phone')}
              />
              <span className="cl-contact-sep">·</span>
              <EditableText
                value={d.email}
                onChange={v => set('email', v)}
                tag="span"
                className="cl-sender-contact-item"
                placeholder={t('coverLetter.email')}
              />
            </div>
          </div>
          )}

          {/* ── Empfänger + Ort/Datum (two-column row) ── */}
          <div className="cl-meta-row">
            {/* Empfänger — left */}
            <div className="cl-recipient">
              <EditableText
                value={d.recipientCompany}
                onChange={v => set('recipientCompany', v)}
                tag="span"
                className="cl-empf-line cl-empf-company"
                placeholder={t('coverLetter.recipientCompany')}
              />
              <EditableText
                value={d.recipientContact}
                onChange={v => set('recipientContact', v)}
                tag="span"
                className="cl-empf-line"
                placeholder={t('coverLetter.recipientContact')}
              />
              <EditableText
                value={d.recipientStreet}
                onChange={v => set('recipientStreet', v)}
                tag="span"
                className="cl-empf-line"
                placeholder={t('coverLetter.recipientStreet')}
              />
              <EditableText
                value={d.recipientCity}
                onChange={v => set('recipientCity', v)}
                tag="span"
                className="cl-empf-line"
                placeholder={t('coverLetter.recipientCity')}
              />
            </div>

            {/* Ort, Datum — right */}
            <div className="cl-place-date">
              <EditableText
                value={d.place}
                onChange={v => set('place', v)}
                tag="span"
                className="cl-place"
                placeholder={t('coverLetter.place')}
              />
              <span className="cl-date-comma">, </span>
              <EditableText
                value={d.date || todayFormatted}
                onChange={v => set('date', v)}
                tag="span"
                className="cl-date"
                placeholder={t('coverLetter.date')}
              />
            </div>
          </div>

          {/* ── Betreff ── */}
          <div className="cl-subject-row">
            <EditableText
              value={d.subject}
              onChange={v => set('subject', v)}
              tag="span"
              className="cl-subject"
              placeholder={t('coverLetter.subject')}
            />
          </div>

          {/* ── Anrede ── */}
          <div className="cl-salutation-row">
            <EditableText
              value={d.salutation}
              onChange={v => set('salutation', v)}
              tag="span"
              className="cl-salutation"
              placeholder={t('coverLetter.salutation')}
            />
          </div>

          {/* ── Brieftext ── */}
          <div className="cl-body-row">
            <EditableText
              value={d.body}
              onChange={v => set('body', v)}
              tag="div"
              className="cl-body"
              placeholder={t('coverLetter.body')}
            />
          </div>

          {/* ── Grußformel ── */}
          <div className="cl-closing-row">
            <EditableText
              value={d.closing}
              onChange={v => set('closing', v)}
              tag="span"
              className="cl-closing"
              placeholder={t('coverLetter.closing')}
            />
          </div>

          {/* ── Unterschrift ── */}
          <div className="cl-signature-row">

            {/* Signature image / draw / upload area */}
            <div className="cl-sig-area">
              {d.signatureImage ? (
                <div className="cl-sig-preview">
                  <img src={d.signatureImage} alt="Signature" className="cl-sig-img" />
                  <button
                    className="cl-sig-remove"
                    onClick={() => set('signatureImage', null)}
                    title={t('buttons.delete')}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
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
                    <button className="cl-sig-btn-ghost" onClick={clearCanvas}>
                      <i className="fas fa-redo" /> {t('coverLetter.sigClear')}
                    </button>
                    <button className="cl-sig-btn-primary" onClick={saveSignature}>
                      <i className="fas fa-check" /> {t('coverLetter.sigSave')}
                    </button>
                    <button className="cl-sig-btn-ghost" onClick={() => setDrawMode(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cl-sig-controls">
                  <label className="cl-sig-btn-secondary" htmlFor="cl-sig-file">
                    <i className="fas fa-upload" /> {t('coverLetter.sigUpload')}
                  </label>
                  <input
                    id="cl-sig-file"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleSigUpload}
                  />
                  <button className="cl-sig-btn-secondary" onClick={() => setDrawMode(true)}>
                    <i className="fas fa-pen-nib" /> {t('coverLetter.sigDraw')}
                  </button>
                </div>
              )}
            </div>

            <EditableText
              value={d.signature}
              onChange={v => set('signature', v)}
              tag="span"
              className="cl-signature"
              placeholder={t('coverLetter.signature')}
            />
          </div>

        </div>
        </div>

        {/* ── Pages 2+: Continuation sheets ── */}
        {pages.slice(1).map((page, i) => (
          <div key={page.id} className="cv-page-wrapper" style={{ marginTop: 40 }}>
            <button
              className="cv-page-remove-btn"
              onClick={() => {
                userForcedMaxRef.current = pages.length - 1;
                removePage(i + 1);
                set('extraPages', [
                  ...(d.extraPages || []).slice(0, i),
                  ...(d.extraPages || []).slice(i + 1),
                ]);
              }}
              title={t('pages.removePage')}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          <div
            className="cl-page cl-continuation-page"
            style={{ width: PAGE_CONFIG.width, minHeight: PAGE_CONFIG.height, ...clCssVars }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              className="cl-body"
              style={{ minHeight: PAGE_CONFIG.height - 133, outline: 'none' }}
              onInput={e => {
                const html = e.currentTarget.innerHTML;
                set('extraPages', [
                  ...(d.extraPages || []).slice(0, i),
                  html,
                  ...(d.extraPages || []).slice(i + 1),
                ]);
              }}
              dangerouslySetInnerHTML={{ __html: (d.extraPages || [])[i] || '' }}
            />
          </div>
          </div>
        ))}

      </div>

      <PageControls />
    </div>
  );
};

export default CoverLetterEditor;
