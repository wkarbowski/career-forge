import React from 'react';
import { PAGE_CONFIG } from '../contexts/PageContext';
import './DocumentPage.css';

interface DocumentPageProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  pageIndex?: number;
}

const DocumentPage = React.forwardRef<HTMLDivElement, DocumentPageProps>(
  ({ active = false, className = '', pageIndex, style, children, ...props }, ref) => (
    <div
      ref={ref}
      className={`document-page ${active ? 'document-page-active' : ''} ${className}`.trim()}
      data-page-index={pageIndex}
      style={{
        width: PAGE_CONFIG.width,
        height: PAGE_CONFIG.height,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  ),
);

DocumentPage.displayName = 'DocumentPage';

export default DocumentPage;
