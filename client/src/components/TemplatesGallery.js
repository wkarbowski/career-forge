import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import { cvTemplates, documentTypes } from '../data/templates';
import './TemplatesGallery.css';

const TemplatesGallery = ({ onSelectTemplate, onBack }) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState('all');
  const [hoveredTemplate, setHoveredTemplate] = useState(null);

  const filteredTemplates = cvTemplates.filter(template => {
    return selectedType === 'all' || template.type === selectedType;
  });

  const handleSelectTemplate = (template) => {
    onSelectTemplate(template);
  };

  const ResumePreview = ({ template }) => {
    const { settings, visibleSections, sidebarOrder } = template;
    const activeSections = sidebarOrder ? sidebarOrder.filter(s => visibleSections && visibleSections[s]) : [];
    const layout = settings.layout || 'sidebar-left';

    const sidebarContent = (
      <>
        <div className="preview-photo"></div>
        <div className="preview-name"></div>
        <div className="preview-title"></div>
        <div className="preview-contact">
          <div className="preview-line short"></div>
          <div className="preview-line short"></div>
          <div className="preview-line short"></div>
        </div>
        {activeSections.slice(0, 3).map((section, idx) => (
          <div key={idx} className="preview-section">
            <div className="preview-section-title" style={{ background: settings.accentColor }}></div>
            <div className="preview-line"></div>
            <div className="preview-line short"></div>
          </div>
        ))}
      </>
    );

    const mainContent = (
      <>
        <div className="preview-main-section">
          <div className="preview-heading" style={{ borderColor: settings.accentColor }}></div>
          <div className="preview-block">
            <div className="preview-line"></div>
            <div className="preview-line"></div>
            <div className="preview-line short"></div>
          </div>
          <div className="preview-block">
            <div className="preview-line"></div>
            <div className="preview-line"></div>
            <div className="preview-line short"></div>
          </div>
        </div>
        <div className="preview-main-section">
          <div className="preview-heading" style={{ borderColor: settings.accentColor }}></div>
          <div className="preview-block">
            <div className="preview-line"></div>
            <div className="preview-line short"></div>
          </div>
        </div>
      </>
    );

    if (layout === 'top-header') {
      return (
        <div className="template-preview-mini preview-layout-top-header">
          <div
            className="preview-top-band"
            style={{
              background: `linear-gradient(135deg, ${settings.sidebarColor1} 0%, ${settings.sidebarColor2} 100%)`,
            }}
          >
            <div className="preview-top-band-right">
              <div className="preview-name"></div>
              <div className="preview-title"></div>
              <div className="preview-contact-row">
                <div className="preview-line short"></div>
                <div className="preview-line short"></div>
              </div>
            </div>
          </div>
          <div className="preview-body-cols">
            <div
              className="preview-sidebar-col"
              style={{
                background: `linear-gradient(180deg, ${settings.sidebarColor2} 0%, ${settings.sidebarColor1} 100%)`,
              }}
            >
              {activeSections.slice(0, 3).map((_, idx) => (
                <div key={idx} className="preview-sidebar-block">
                  <div className="preview-line light short"></div>
                  <div className="preview-line light"></div>
                </div>
              ))}
            </div>
            <div className="preview-main">{mainContent}</div>
          </div>
        </div>
      );
    }

    if (layout === 'minimal') {
      return (
        <div className="template-preview-mini preview-layout-minimal">
          <div className="preview-minimal-accent" style={{ background: settings.accentColor }}></div>
          <div className="preview-minimal-header">
            <div className="preview-name-dark"></div>
            <div className="preview-title-dark" style={{ color: settings.accentColor }}></div>
            <div className="preview-contact-row-dark">
              <div className="preview-line short"></div>
              <div className="preview-line short"></div>
              <div className="preview-line short"></div>
            </div>
          </div>
          <div className="preview-body-cols">
            <div className="preview-sidebar-col preview-sidebar-col-light">
              {activeSections.slice(0, 3).map((_, idx) => (
                <div key={idx} className="preview-section-inline">
                  <div className="preview-heading-inline" style={{ borderColor: settings.accentColor }}></div>
                  <div className="preview-line"></div>
                  <div className="preview-line short"></div>
                </div>
              ))}
            </div>
            <div className="preview-main">{mainContent}</div>
          </div>
        </div>
      );
    }

    if (layout === 'sidebar-right') {
      return (
        <div className="template-preview-mini preview-layout-sidebar-right">
          <div className="preview-main">{mainContent}</div>
          <div
            className="preview-sidebar"
            style={{
              background: `linear-gradient(180deg, ${settings.sidebarColor1} 0%, ${settings.sidebarColor2} 100%)`,
            }}
          >
            {sidebarContent}
          </div>
        </div>
      );
    }

    // Default: sidebar-left
    return (
      <div className="template-preview-mini">
        <div
          className="preview-sidebar"
          style={{
            background: `linear-gradient(180deg, ${settings.sidebarColor1} 0%, ${settings.sidebarColor2} 100%)`,
          }}
        >
          {sidebarContent}
        </div>
        <div className="preview-main">{mainContent}</div>
      </div>
    );
  };

  const CoverLetterPreview = ({ template }) => {
    const { settings } = template;
    const clStyle = settings.clStyle || 'standard';

    const bodyContent = (
      <>
        <div className="preview-date"></div>
        <div className="preview-recipient">
          <div className="preview-line short"></div>
          <div className="preview-line short"></div>
          <div className="preview-line short"></div>
        </div>
        <div className="preview-salutation"></div>
        <div className="preview-paragraph">
          <div className="preview-line"></div>
          <div className="preview-line"></div>
          <div className="preview-line"></div>
          <div className="preview-line short"></div>
        </div>
        <div className="preview-paragraph">
          <div className="preview-line"></div>
          <div className="preview-line"></div>
          <div className="preview-line short"></div>
        </div>
        <div className="preview-paragraph">
          <div className="preview-line"></div>
          <div className="preview-line short"></div>
        </div>
        <div className="preview-closing">
          <div className="preview-line short"></div>
          <div className="preview-signature" style={{ borderBottomColor: settings.accentColor || '#1a1a1a' }}></div>
        </div>
      </>
    );

    // Modern: left accent bar
    if (clStyle === 'modern') {
      return (
        <div className="template-preview-mini cover-letter-preview cl-preview-modern">
          <div
            className="cl-preview-accent-bar"
            style={{
              background: `linear-gradient(180deg, ${settings.sidebarColor1 || '#006666'}, ${settings.sidebarColor2 || '#006666'})`,
            }}
          />
          <div className="cl-preview-inner">
            <div className="cover-letter-header" style={{ borderBottomColor: 'transparent' }}>
              <div className="preview-name-cl" style={{ background: settings.sidebarColor1 || '#006666' }}></div>
              <div className="preview-contact-cl">
                <div className="preview-line short"></div>
                <div className="preview-line short"></div>
              </div>
            </div>
            <div className="cover-letter-body">{bodyContent}</div>
          </div>
        </div>
      );
    }

    // Classic: top gradient band
    if (clStyle === 'classic') {
      return (
        <div className="template-preview-mini cover-letter-preview cl-preview-classic">
          <div
            className="cl-preview-top-band"
            style={{
              background: `linear-gradient(135deg, ${settings.sidebarColor1 || '#0f2847'}, ${settings.sidebarColor2 || '#1e3a5f'})`,
            }}
          >
            <div className="preview-name-cl" style={{ background: 'rgba(255,255,255,0.9)' }}></div>
            <div className="preview-contact-cl">
              <div className="preview-line short" style={{ background: 'rgba(255,255,255,0.5)' }}></div>
              <div className="preview-line short" style={{ background: 'rgba(255,255,255,0.5)' }}></div>
            </div>
          </div>
          <div className="cover-letter-body">{bodyContent}</div>
        </div>
      );
    }

    // Executive: charcoal band + gold rule
    if (clStyle === 'executive') {
      return (
        <div className="template-preview-mini cover-letter-preview cl-preview-executive">
          <div
            className="cl-preview-top-band"
            style={{
              background: `linear-gradient(135deg, ${settings.sidebarColor2 || '#374151'}, ${settings.sidebarColor1 || '#111827'})`,
            }}
          >
            <div className="preview-name-cl" style={{ background: 'rgba(255,255,255,0.85)' }}></div>
            <div className="preview-contact-cl">
              <div className="preview-line short" style={{ background: 'rgba(255,255,255,0.45)' }}></div>
              <div className="preview-line short" style={{ background: 'rgba(255,255,255,0.45)' }}></div>
            </div>
          </div>
          <div className="cl-preview-gold-rule" style={{ background: settings.accentColor || '#7c6f57' }}></div>
          <div className="cover-letter-body">{bodyContent}</div>
        </div>
      );
    }

    // Standard / fallback
    return (
      <div className="template-preview-mini cover-letter-preview">
        <div className="cover-letter-header" style={{ borderBottomColor: settings.accentColor || '#1a1a1a' }}>
          <div className="preview-name-cl"></div>
          <div className="preview-contact-cl">
            <div className="preview-line short"></div>
            <div className="preview-line short"></div>
          </div>
        </div>
        <div className="cover-letter-body">{bodyContent}</div>
      </div>
    );
  };

  const TemplatePreview = ({ template }) => {
    if (template.type === 'cover-letter') {
      return <CoverLetterPreview template={template} />;
    }
    return <ResumePreview template={template} />;
  };

  return (
    <div className="templates-gallery">
      <div className="gallery-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
            {t('templates.back')}
          </button>
          <h1>{t('templates.title')}</h1>
        </div>
      </div>

      <div className="gallery-content">
        {/* Document Type Filter (primary) */}
        <div className="type-filters">
          {documentTypes.map(docType => (
            <button
              key={docType.id}
              className={`type-btn ${selectedType === docType.id ? 'active' : ''}`}
              onClick={() => setSelectedType(docType.id)}
            >
              <i className={`fas ${docType.id === 'resume' ? 'fa-file-alt' : docType.id === 'cover-letter' ? 'fa-envelope' : 'fa-th-large'}`}></i>
              {t(`templates.types.${docType.id}`)}
            </button>
          ))}
        </div>

        <div className="templates-grid">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className={`template-card ${hoveredTemplate === template.id ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
            >
              <div className="template-preview-wrapper">
                <TemplatePreview template={template} />
                <div className="template-overlay">
                  <button 
                    className="use-template-btn"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <i className="fas fa-check"></i>
                    {t('templates.useTemplate')}
                  </button>
                </div>
              </div>
              <div className="template-info">
                <h3>{t(`templates.items.${template.id}.name`, template.name)}</h3>
                <div className={`template-type-badge ${template.type}`}>
                  <i className={`fas ${template.type === 'cover-letter' ? 'fa-envelope' : 'fa-file-alt'}`}></i>
                  {t(`templates.types.${template.type}-singular`, template.type)}
                </div>
                <p>{t(`templates.items.${template.id}.description`, template.description)}</p>
                <div className="template-colors">
                  {template.preview.colors.map((color, idx) => (
                    <span 
                      key={idx} 
                      className="color-dot" 
                      style={{ background: color }}
                      title={color}
                    ></span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplatesGallery;
