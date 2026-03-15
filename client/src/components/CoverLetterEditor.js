import React, { useRef, useState } from 'react';
import { usePages, PAGE_CONFIG } from '../contexts/PageContext';
import { useAppState } from '../contexts/AppStateContext';
import { useTranslation } from '../i18n';
import EditableText from './EditableText';
import PageControls from './PageControls';
import './CoverLetterEditor.css';

/**
 * CoverLetterEditor
 *
 * Follows the modern German Anschreiben layout (DIN 5008):
 *   Absender → Empfänger + Ort/Datum → Betreff → Anrede → Brieftext → Grußformel → Unterschrift
 */
const CoverLetterEditor = () => {
  const { zoom, setZoom } = usePages();
  const { coverLetterData, setCoverLetterData } = useAppState();
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const [drawMode, setDrawMode] = useState(false);

  const set = (field, value) =>
    setCoverLetterData(prev => ({ ...prev, [field]: value }));

  const getCanvasPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getCanvasPos(e, canvas);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
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
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    set('signatureImage', canvas.toDataURL('image/png'));
    setDrawMode(false);
  };

  const handleSigUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set('signatureImage', ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Ctrl/Meta + wheel → zoom
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const step = 0.1;
      setZoom(prev =>
        e.deltaY < 0 ? Math.min(prev + step, 2) : Math.max(prev - step, 0.5)
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel, { passive: false });
  }, [setZoom]);

  const d = coverLetterData;

  return (
    <div className="cl-editor" ref={containerRef}>
      <div
        className="cl-canvas"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
      >
        <div
          className="cl-page"
          style={{ width: PAGE_CONFIG.width, minHeight: PAGE_CONFIG.height }}
        >

          {/* ── Absender ── */}
          <div className="cl-absender">
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

          {/* ── Empfänger + Ort/Datum (two-column row) ── */}
          <div className="cl-meta-row">
            {/* Empfänger — left */}
            <div className="cl-empfaenger">
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
            <div className="cl-ort-datum">
              <EditableText
                value={d.place}
                onChange={v => set('place', v)}
                tag="span"
                className="cl-ort"
                placeholder={t('coverLetter.place')}
              />
              <span className="cl-datum-comma">, </span>
              <EditableText
                value={d.date}
                onChange={v => set('date', v)}
                tag="span"
                className="cl-datum"
                placeholder={t('coverLetter.date')}
              />
            </div>
          </div>

          {/* ── Betreff ── */}
          <div className="cl-betreff-row">
            <EditableText
              value={d.subject}
              onChange={v => set('subject', v)}
              tag="span"
              className="cl-betreff"
              placeholder={t('coverLetter.subject')}
            />
          </div>

          {/* ── Anrede ── */}
          <div className="cl-anrede-row">
            <EditableText
              value={d.salutation}
              onChange={v => set('salutation', v)}
              tag="span"
              className="cl-anrede"
              placeholder={t('coverLetter.salutation')}
            />
          </div>

          {/* ── Brieftext ── */}
          <div className="cl-brieftext-row">
            <EditableText
              value={d.body}
              onChange={v => set('body', v)}
              tag="div"
              className="cl-brieftext"
              placeholder={t('coverLetter.body')}
            />
          </div>

          {/* ── Grußformel ── */}
          <div className="cl-gruss-row">
            <EditableText
              value={d.closing}
              onChange={v => set('closing', v)}
              tag="span"
              className="cl-gruss"
              placeholder={t('coverLetter.closing')}
            />
          </div>

          {/* ── Unterschrift ── */}
          <div className="cl-unterschrift-row">

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
                    <i className="fas fa-times" />
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
              className="cl-unterschrift"
              placeholder={t('coverLetter.signature')}
            />
          </div>

        </div>
      </div>

      <PageControls />
    </div>
  );
};

export default CoverLetterEditor;

