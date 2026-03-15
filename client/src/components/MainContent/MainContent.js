import React from 'react';
import { useTranslation } from '../../i18n';
import EditableText from './EditableText';
import SocialIconPicker from './SocialIconPicker';
import { useAppState } from '../../contexts/AppStateContext';

const MainContent = ({ data, updateField, updateArrayItem, deleteArrayItem, addArrayItem, settings, visibleSections }) => {
  const { t } = useTranslation();
  const appState = useAppState();

  const _data = data ?? appState.data;
  const _settings = settings ?? appState.settings;
  const _visibleSections = visibleSections ?? appState.visibleSections;
  const _updateField = updateField ?? ((field, value) => appState.setData(prev => ({ ...prev, [field]: value })));
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

  return (
    <div className="main-content">
      {/* Header */}
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
          <span>
            <i className="fas fa-phone"></i>{' '}
            <EditableText
              value={_data.contact.phone}
              onChange={(val) => _updateField('contact.phone', val)}
              placeholder={t('placeholders.phone')}
            />
          </span>
          <span>
            <i className="fas fa-envelope"></i>{' '}
            <EditableText
              value={_data.contact.email}
              onChange={(val) => _updateField('contact.email', val)}
              placeholder={t('placeholders.email')}
            />
          </span>
          <span>
            <SocialIconPicker
              value={_data.contact.websiteIcon || 'fas fa-globe'}
              onChange={(cls) => _updateField('contact.websiteIcon', cls)}
            />{' '}
            <EditableText
              value={_data.contact.website}
              onChange={(val) => _updateField('contact.website', val)}
              placeholder={t('placeholders.website')}
            />
          </span>
          <span>
            <i className="fas fa-map-marker-alt"></i>{' '}
            <EditableText
              value={_data.contact.location}
              onChange={(val) => _updateField('contact.location', val)}
              placeholder={t('placeholders.location')}
            />
          </span>
        </div>
      </div>

      {/* Experience Section */}
      {_visibleSections.experience && (
        <div className="section">
          <h2 className="section-title">{t('sections.experience')}</h2>
          {_data.experience.map(exp => (
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
                      style={{ fontSize: '13px', color: '#6b7280' }}
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
                      style={{ fontSize: '13px', color: '#6b7280' }}
                      placeholder={t('placeholders.location')}
                    />
                </div>
              </div>
              {exp.description && (
                <div className="experience-description">
                  <EditableText
                    value={exp.description}
                    onChange={(val) => _updateArrayItem('experience', exp.id, 'description', val)}
                    tag="p"
                    placeholder={t('placeholders.description')}
                  />
                </div>
              )}
              <button
                className="delete-btn"
                onClick={() => _deleteArrayItem('experience', exp.id)}
              >
                <i className="fas fa-times"></i>
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
          {_data.education.map(edu => (
            <div key={edu.id} className="experience-item">
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
                    style={{ fontSize: '13px', color: '#6b7280' }}
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
                    style={{ fontSize: '13px', color: '#6b7280' }}
                    placeholder={t('placeholders.location')}
                  />
                </div>
     
              </div>
              <button
                className="delete-btn"
                onClick={() => _deleteArrayItem('education', edu.id)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ))}
          <button
            className="add-btn"
            onClick={() => _addArrayItem('education', {
              degree: t('placeholders.degree'),
              school: t('placeholders.school'),
              period: t('placeholders.period'),
              location: t('placeholders.location'),
              description: t('placeholders.description')
            })}
          >
            <i className="fas fa-plus"></i> {t('buttons.add')} {t('sections.education')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MainContent;
