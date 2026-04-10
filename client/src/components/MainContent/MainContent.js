// ...existing code...
import React from 'react';
import { useTranslation } from '../../i18n';
import EditableText from './EditableText';
// ...existing code...
import SocialLinkEditor from './SocialLinkEditor';
import { useAppState } from '../../contexts/AppStateContext';

const MainContent = ({ data, updateField, updateArrayItem, deleteArrayItem, addArrayItem, settings, visibleSections, showHeader = true, headerOnly = false }) => {
  const { t } = useTranslation();
  const appState = useAppState();

  const _data = data ?? appState.data;
  // Defensive: ensure experience and education are arrays
  const experienceArr = Array.isArray(_data.experience) ? _data.experience : [];
  const educationArr = Array.isArray(_data.education) ? _data.education : [];
  const _settings = settings ?? appState.settings;
  const _visibleSections = visibleSections ?? appState.visibleSections;
  const _updateField = updateField ?? ((field, value) => appState.setData(prev => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      return { ...prev, [parent]: { ...prev[parent], [child]: value } };
    }
    return { ...prev, [field]: value };
  }));
  const _updateArrayItem = updateArrayItem ?? ((arrayName, id, key, value) => appState.setData(prev => ({
    ...prev,
    [arrayName]: prev[arrayName].map(item => (item.id === id ? { ...item, [key]: value } : item))
  })));
  const _deleteArrayItem = deleteArrayItem ?? ((arrayName, id) => appState.setData(prev => ({
    ...prev,
    [arrayName]: prev[arrayName].filter(item => item.id !== id)
  })));
  const _addArrayItem = addArrayItem ?? ((arrayName, item) => appState.setData(prev => ({
    ...prev,
    [arrayName]: [...prev[arrayName], { ...item, id: Date.now() }]
  })));

  const isCoursesSection = (section) => {
    const normalizedTitle = (section?.title || '').trim().toLowerCase();
    return section?.type === 'courses' || normalizedTitle === 'courses' || normalizedTitle === 'kurse';
  };

  return (
    <div className="main-content">
      {/* Header */}
      {showHeader && (
      <div className="header">
        <EditableText
          value={_data.name}
          onChange={(val) => _updateField('name', val)}
          tag="h1"
          placeholder={t('placeholders.name')}
        />
        <EditableText
          value={_data.position}
          onChange={(val) => _updateField('position', val)}
          tag="p"
          style={{ color: _settings.accentColor }}
          placeholder={t('placeholders.position')}
        />
        <div className="contact-info">
          <span className="contact-item" onClick={(e) => { if (!e.target.isContentEditable) { const ed = e.currentTarget.querySelector('[contenteditable]'); if (ed) ed.focus(); } }}>
            <i className="fas fa-phone"></i>
            <EditableText
              value={_data.contact.phone}
              onChange={(val) => _updateField('contact.phone', val)}
              placeholder={t('placeholders.phone')}
            />
          </span>
          <span className="contact-item" onClick={(e) => { if (!e.target.isContentEditable) { const ed = e.currentTarget.querySelector('[contenteditable]'); if (ed) ed.focus(); } }}>
            <i className="fas fa-envelope"></i>
            <EditableText
              value={_data.contact.email}
              onChange={(val) => _updateField('contact.email', val)}
              placeholder={t('placeholders.email')}
            />
          </span>
          <SocialLinkEditor
            icon={_data.contact.websiteIcon || 'fas fa-globe'}
            url={_data.contact.website}
            onIconChange={(cls) => _updateField('contact.websiteIcon', cls)}
            onUrlChange={(val) => _updateField('contact.website', val)}
            t={t}
          />
          <span className="contact-item" onClick={(e) => { if (!e.target.isContentEditable) { const ed = e.currentTarget.querySelector('[contenteditable]'); if (ed) ed.focus(); } }}>
            <i className="fas fa-map-marker-alt"></i>
            <EditableText
              value={_data.contact.location}
              onChange={(val) => _updateField('contact.location', val)}
              placeholder={t('placeholders.location')}
            />
          </span>
          {_data.contact.linkedin && (
          <span className="contact-item" onClick={(e) => { if (!e.target.isContentEditable) { const ed = e.currentTarget.querySelector('[contenteditable]'); if (ed) ed.focus(); } }}>
            <i className="fab fa-linkedin"></i>
            <EditableText
              value={_data.contact.linkedin}
              onChange={(val) => _updateField('contact.linkedin', val)}
              placeholder={t('placeholders.linkedin')}
            />
          </span>
          )}
          {_data.contact.github && (
          <span className="contact-item" onClick={(e) => { if (!e.target.isContentEditable) { const ed = e.currentTarget.querySelector('[contenteditable]'); if (ed) ed.focus(); } }}>
            <i className="fab fa-github"></i>
            <EditableText
              value={_data.contact.github}
              onChange={(val) => _updateField('contact.github', val)}
              placeholder={t('placeholders.github')}
            />
          </span>
          )}
        </div>
      </div>
      )}

      {!headerOnly && (
      <>
      {/* Experience Section */}
      {_visibleSections.experience && (
        <div className="section">
          <h2 className="section-title">{t('sections.experience')}</h2>
          {experienceArr.map(exp => (
            <div key={exp.id} className="experience-item">
              <div className="experience-header">
                <div className="experience-top">
                  <EditableText
                    value={exp.title}
                    onChange={(val) => _updateArrayItem('experience', exp.id, 'title', val)}
                    tag="h3"
                    style={{ color: _settings.accentColor }}
                    placeholder={t('placeholders.title')}
                  />
                    <EditableText
                      value={exp.period}
                      onChange={(val) => _updateArrayItem('experience', exp.id, 'period', val)}
                      tag="span"
                      className="text-muted-inline"
                      placeholder={t('placeholders.period')}
                    />
                </div>

                <div className="experience-bottom">
                  <EditableText
                    value={exp.company}
                    onChange={(val) => _updateArrayItem('experience', exp.id, 'company', val)}
                    tag="p"
                    className="experience-subtitle"
                    style={{ color: _settings.accentColor }}
                    placeholder={t('placeholders.company')}
                  />
                    <EditableText
                      value={exp.location || ''}
                      onChange={(val) => _updateArrayItem('experience', exp.id, 'location', val)}
                      tag="span"
                      className="text-muted-inline"
                      placeholder={t('placeholders.location')}
                    />
                </div>
              </div>
              <div className="experience-description">
                <EditableText
                  value={exp.description || ''}
                  onChange={(val) => _updateArrayItem('experience', exp.id, 'description', val)}
                  tag="p"
                  placeholder={t('placeholders.description')}
                />
              </div>
              <button
                className="delete-btn"
                onClick={() => _deleteArrayItem('experience', exp.id)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
          <button
            className="add-btn"
            onClick={() => _addArrayItem('experience', {
              title: t('placeholders.title'),
              company: t('placeholders.company'),
              period: t('placeholders.period'),
              location: t('placeholders.location'),
              description: t('placeholders.description'),
              achievements: []
            })}
          >
            <i className="fas fa-plus"></i> {t('buttons.add')} {t('sections.experience')}
          </button>
        </div>
      )}

      {/* Education Section */}
      {_visibleSections.education && (
        <div className="section">
          <h2 className="section-title">{t('sections.education')}</h2>
          {educationArr.map(edu => (
            <div key={edu.id} className="experience-item education-degree">
              <div className="experience-header">
                <div className="experience-top">
                  <EditableText
                    value={edu.degree}
                    onChange={(val) => _updateArrayItem('education', edu.id, 'degree', val)}
                    tag="h3"
                    style={{ color: _settings.accentColor }}
                    placeholder={t('placeholders.degree')}
                  />
                  <EditableText
                    value={edu.period}
                    onChange={(val) => _updateArrayItem('education', edu.id, 'period', val)}
                    tag="span"
                    className="text-muted-inline"
                    placeholder={t('placeholders.period')}
                  />
                </div>
                <div className="experience-bottom">
                  <EditableText
                    value={edu.school}
                    onChange={(val) => _updateArrayItem('education', edu.id, 'school', val)}
                    tag="p"
                    className="experience-subtitle"
                    style={{ color: _settings.accentColor }}
                    placeholder={t('placeholders.school')}
                  />
                  <EditableText
                    value={edu.location || ''}
                    onChange={(val) => _updateArrayItem('education', edu.id, 'location', val)}
                    tag="span"
                    className="text-muted-inline"
                    placeholder={t('placeholders.location')}
                  />
                </div>
     
              </div>
              <button
                className="delete-btn"
                onClick={() => _deleteArrayItem('education', edu.id)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
          <button
            className="add-btn"
            onClick={() => _addArrayItem('education', {
              type: 'education',
              degree: '',
              school: '',
              period: '',
              location: '',
              description: ''
            })}
          >
            <i className="fas fa-plus"></i> {t('education.addEducation')}
          </button>
        </div>
      )}

      {/* Custom Sections (main position) */}
      {(_data.customSections || []).filter(s => s.position === 'main').map(section => (
        _visibleSections[section.id] !== false && (
          <div className="section" key={section.id}>
            <div className="section-title-row">
              <EditableText
                value={section.title}
                onChange={(val) => {
                  const updated = (_data.customSections || []).map(s =>
                    s.id === section.id ? { ...s, title: val } : s
                  );
                  _updateField('customSections', updated);
                }}
                tag="h2"
                className="section-title"
                placeholder={t('placeholders.sectionTitle')}
              />
              <button
                className="delete-section-btn"
                title={t('buttons.deleteSection') || 'Delete section'}
                onClick={() => appState?.removeCustomSection && appState.removeCustomSection(section.id)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            {section.items.map(item => (
              <div key={item.id} className="experience-item">
                {(() => {
                  const coursesSection = isCoursesSection(section);
                  return (
                    <>
                <div className="experience-header">
                  <div className="experience-top">
                    <EditableText
                      value={item.title}
                      onChange={(val) => {
                        const updated = (_data.customSections || []).map(s =>
                          s.id === section.id ? {
                            ...s,
                            items: s.items.map(i => i.id === item.id ? { ...i, title: val } : i)
                          } : s
                        );
                        _updateField('customSections', updated);
                      }}
                      tag="h3"
                      style={{ color: _settings.accentColor }}
                      placeholder={coursesSection ? t('placeholders.itemTitle') : t('placeholders.itemTitle')}
                    />
                    {item.period && (
                      <EditableText
                        value={item.period}
                        onChange={(val) => {
                          const updated = (_data.customSections || []).map(s =>
                            s.id === section.id ? {
                              ...s,
                              items: s.items.map(i => i.id === item.id ? { ...i, period: val } : i)
                            } : s
                          );
                          _updateField('customSections', updated);
                        }}
                        tag="span"
                        className="text-muted-inline"
                        placeholder={t('placeholders.period')}
                      />
                    )}
                  </div>

                  {item.subtitle !== undefined && (
                    <div className="experience-bottom">
                      <EditableText
                        value={item.subtitle}
                        onChange={(val) => {
                          const updated = (_data.customSections || []).map(s =>
                            s.id === section.id ? {
                              ...s,
                              items: s.items.map(i => i.id === item.id ? { ...i, subtitle: val } : i)
                            } : s
                          );
                          _updateField('customSections', updated);
                        }}
                        tag="p"
                        className="experience-subtitle"
                        style={{ color: _settings.accentColor }}
                        placeholder={coursesSection ? t('placeholders.institution') : t('placeholders.itemDescription')}
                      />
                    </div>
                  )}
                </div>
                {item.description && (
                  <div className="experience-description">
                    <EditableText
                      value={item.description}
                      onChange={(val) => {
                        const updated = (_data.customSections || []).map(s =>
                          s.id === section.id ? {
                            ...s,
                            items: s.items.map(i => i.id === item.id ? { ...i, description: val } : i)
                          } : s
                        );
                        _updateField('customSections', updated);
                      }}
                      tag="p"
                      placeholder={t('placeholders.description')}
                    />
                  </div>
                )}
                    </>
                  );
                })()}
                <button
                  className="delete-btn"
                  onClick={() => {
                    const updated = (_data.customSections || []).map(s =>
                      s.id === section.id ? {
                        ...s,
                        items: s.items.filter(i => i.id !== item.id)
                      } : s
                    );
                    _updateField('customSections', updated);
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
            <button
              className="add-btn"
              onClick={() => {
                const updated = (_data.customSections || []).map(s =>
                  s.id === section.id ? {
                    ...s,
                    items: [...s.items, { id: Date.now(), title: '', subtitle: '', period: '', description: '' }]
                  } : s
                );
                _updateField('customSections', updated);
              }}
            >
              <i className="fas fa-plus"></i> {t('buttons.addItem')}
            </button>
          </div>
        )
      ))}
      </>
      )}
    </div>
  );
};

export default MainContent;
