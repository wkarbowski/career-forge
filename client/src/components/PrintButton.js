import React, { useState } from 'react';
import './PrintButton.css';

/**
 * PrintButton — OSS browser-print PDF export.
 *
 * Calls window.print(), which opens the browser's native print dialog.
 * Users select "Save as PDF" to get a PDF file.
 *
 * Extended builds replace this with <PdfExportButton> (server-side WeasyPrint)
 * via the GlobalHeader `pdfButton` prop slot — no changes to this file needed.
 *
 * The @media print rules in App.css hide all editor UI so only
 * the document pages are printed.
 */
const PrintButton = () => {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    // Small delay allows the browser to re-render with the printing state class
    // before the print dialog opens (e.g. to hide the button itself).
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  return (
    <button
      className={`print-btn ${printing ? 'print-btn--active' : ''}`}
      onClick={handlePrint}
      title="Save as PDF (browser print dialog)"
      aria-label="Save as PDF"
    >
      <i className="fas fa-download"></i>
      <span>Save PDF</span>
    </button>
  );
};

export default PrintButton;
