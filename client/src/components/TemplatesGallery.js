import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import { cvTemplates, templateCategories, documentTypes } from '../data/templates';
import './TemplatesGallery.css';

const TemplatesGallery = ({ onSelectTemplate, onBack }) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [hoveredTemplate, setHoveredTemplate] = useState(null);

  const filteredTemplates = cvTemplates.filter(template => {
    const matchesType = selectedType === 'all' || template.type === selectedType;
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesType && matchesCategory;
  });

  const handleSelectTemplate = (template) => {
    onSelectTemplate(template);
  };

  const ResumePreview = ({ template }) => {
    const { settings, visibleSections, sidebarOrder } = template;
    const activeSections = sidebarOrder ? sidebarOrder.filter(s => visibleSections && visibleSections[s]) : [];

    return (
      <div className="template-preview-mini">
        <div 
          className="preview-sidebar"
          style={{ 
            background: `linear-gradient(180deg, ${settings.sidebarColor1} 0%, ${settings.sidebarColor2} 100%)`
          }}
        >
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
        </div>
        <div className="preview-main">
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
        </div>
      </div>
    );
  };

  const CoverLetterPreview = ({ template }) => {
    const { settings } = template;

    return (
      <div className="template-preview-mini cover-letter-preview">
        <div className="cover-letter-header" style={{ borderBottomColor: settings.accentColor }}>
          <div className="preview-name-cl"></div>
          <div className="preview-contact-cl">
            <div className="preview-line short"></div>
            <div className="preview-line short"></div>
          </div>
        </div>
        <div className="cover-letter-body">
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
            <div className="preview-signature" style={{ borderBottomColor: settings.accentColor }}></div>
          </div>
        </div>
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

        {/* Category Filter (secondary) */}
        <div className="category-filters">
          {templateCategories.map(category => (
            <button
              key={category.id}
              className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {t(`templates.categories.${category.id}`)}
            </button>
          ))}
        </div>

        <p className="gallery-subtitle">{t('templates.subtitle')}</p>

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
