import React from 'react';
import { useTranslation } from '../../i18n';
import EditableText from './EditableText';
import LanguageLevel from './LanguageLevel';
import { useAppState } from '../../contexts/AppStateContext';
import { initialData } from '../../data/initialData';


const Sidebar = ({ data, updateField, updateArrayItem, deleteArrayItem, addArrayItem, settings, visibleSections, profileImage, onImageUpload, onImageRemove, sidebarOrder, onMoveSectionUp, onMoveSectionDown }) => {
  const { t } = useTranslation();
  const appState = useAppState();

  const fallbackSettings = {
    sidebarColor1: '#312e81',
    sidebarColor2: '#4f46e5',
    accentColor: '#6366f1'
  };

  const fallbackVisible = {
    summary: true,
    strengths: true,
    languages: true,
    skills: true,
    achievements: true,
    experience: true,
    education: true,
    courses: true,
  };

  const fallbackOrder = [
    'summary',
    'skills',
    'languages',
    'courses',
    'strengths',
    'achievements',
  ];

  const safeApp = appState ?? {
    data: initialData,
    settings: fallbackSettings,
    visibleSections: fallbackVisible,
    sidebarOrder: fallbackOrder,
    setData: () => {},
    setSidebarOrder: () => {},
    setProfileImage: () => {}
  };

  const _data = data ?? safeApp.data;
  const _visibleSections = visibleSections ?? safeApp.visibleSections;
  const _sidebarOrder = sidebarOrder ?? safeApp.sidebarOrder;

  const _updateField = updateField ?? ((field, value) => safeApp.setData(prev => ({ ...prev, [field]: value })));
  const _updateArrayItem = updateArrayItem ?? ((arrayName, id, key, value) => safeApp.setData(prev => ({
    ...prev,
    [arrayName]: prev[arrayName].map(item => (item.id === id ? { ...item, [key]: value } : item))
  })));
  const _deleteArrayItem = deleteArrayItem ?? ((arrayName, id) => safeApp.setData(prev => ({
    ...prev,
    [arrayName]: prev[arrayName].filter(item => item.id !== id)
  })));
  const _addArrayItem = addArrayItem ?? ((arrayName, item) => safeApp.setData(prev => ({
    ...prev,
    [arrayName]: [...prev[arrayName], { ...item, id: Date.now() }]
  })));
  const _onMoveSectionUp = onMoveSectionUp ?? ((name) => {
    const idx = safeApp.sidebarOrder.indexOf(name);
    if (idx > 0) {
      const arr = [...safeApp.sidebarOrder];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      safeApp.setSidebarOrder(arr);
    }
  });
  const _onMoveSectionDown = onMoveSectionDown ?? ((name) => {
    const idx = safeApp.sidebarOrder.indexOf(name);
    if (idx >= 0 && idx < safeApp.sidebarOrder.length - 1) {
      const arr = [...safeApp.sidebarOrder];
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      safeApp.setSidebarOrder(arr);
    }
  });

  const sections = {
    summary: (
      <div className="sidebar-section" key="summary">
        <div className="section-header-with-controls">
          <h2>{t('sections.summary')}</h2>
          <div className="section-controls">
            <button onClick={() => _onMoveSectionUp('summary')} className="move-btn" title={t('buttons.moveUp')}>
              <i className="fas fa-arrow-up"></i>
            </button>
            <button onClick={() => _onMoveSectionDown('summary')} className="move-btn" title={t('buttons.moveDown')}>
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
              <EditableText
                value={_data.summary}
                onChange={(val) => _updateField('summary', val)}
                tag="p"
                style={{ fontSize: '12px', lineHeight: '1.6', opacity: 0.95 }}
                placeholder={t('placeholders.summary')}
              />
      </div>
    ),
    strengths: (
      <div className="sidebar-section" key="strengths">
        <div className="section-header-with-controls">
          <h2>{t('sections.strengths')}</h2>
            <div className="section-controls">
            <button onClick={() => _onMoveSectionUp('strengths')} className="move-btn" title={t('buttons.moveUp')}>
              <i className="fas fa-arrow-up"></i>
            </button>
            <button onClick={() => _onMoveSectionDown('strengths')} className="move-btn" title={t('buttons.moveDown')}>
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.strengths.map(strength => (
          <div key={strength.id} className="sidebar-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={strength.title}
                onChange={(val) => _updateArrayItem('strengths', strength.id, 'title', val)}
                tag="h3"
                placeholder={t('placeholders.strengthTitle')}
              />
              <EditableText
                value={strength.description}
                onChange={(val) => _updateArrayItem('strengths', strength.id, 'description', val)}
                tag="p"
                placeholder={t('placeholders.strengthDescription')}
              />
            </div>
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem('strengths', strength.id)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
        <button
          className="add-btn"
          onClick={() => _addArrayItem('strengths', {
            title: t('placeholders.strengthTitle'),
            description: t('placeholders.strengthDescription')
          })}
        >
          <i className="fas fa-plus"></i> {t('buttons.add')} {t('sections.strengths')}
        </button>
      </div>
    ),
    languages: (
      <div className="sidebar-section" key="languages">
        <div className="section-header-with-controls">
          <h2>{t('sections.languages')}</h2>
            <div className="section-controls">
            <button onClick={() => _onMoveSectionUp('languages')} className="move-btn" title={t('buttons.moveUp')}>
              <i className="fas fa-arrow-up"></i>
            </button>
            <button onClick={() => _onMoveSectionDown('languages')} className="move-btn" title={t('buttons.moveDown')}>
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.languages.map(language => (
          <div key={language.id} className="sidebar-item language-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={language.name}
                onChange={(val) => _updateArrayItem('languages', language.id, 'name', val)}
                tag="h3"
                placeholder={t('placeholders.languageName')}
              />
            </div>
              <LanguageLevel
                level={language.level}
                onChange={(val) => _updateArrayItem('languages', language.id, 'level', val)}
              />
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem('languages', language.id)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
        <button
          className="add-btn"
          onClick={() => _addArrayItem('languages', {
            name: t('placeholders.languageName'),
            level: 3,
            proficiency: t('placeholders.proficiency')
          })}
        >
          <i className="fas fa-plus"></i> {t('buttons.add')} {t('sections.languages')}
        </button>
      </div>
    ),
    skills: (
      <div className="sidebar-section" key="skills">
        <div className="section-header-with-controls">
          <h2>{t('sections.skills')}</h2>
            <div className="section-controls">
            <button onClick={() => _onMoveSectionUp('skills')} className="move-btn" title={t('buttons.moveUp')}>
              <i className="fas fa-arrow-up"></i>
            </button>
            <button onClick={() => _onMoveSectionDown('skills')} className="move-btn" title={t('buttons.moveDown')}>
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.skills.map(skill => (
          <div key={skill.id} className="sidebar-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={skill.name}
                onChange={(val) => _updateArrayItem('skills', skill.id, 'name', val)}
                tag="h3"
                placeholder={t('placeholders.skillName')}
              />
            </div>
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem('skills', skill.id)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
        <button
          className="add-btn"
          onClick={() => _addArrayItem('skills', {
            name: t('placeholders.skillName')
          })}
        >
          <i className="fas fa-plus"></i> {t('buttons.add')} {t('sections.skills')}
        </button>
      </div>
    ),
    achievements: (
      <div className="sidebar-section" key="achievements">
        <div className="section-header-with-controls">
          <h2>{t('sections.achievements')}</h2>
            <div className="section-controls">
            <button onClick={() => _onMoveSectionUp('achievements')} className="move-btn" title={t('buttons.moveUp')}>
              <i className="fas fa-arrow-up"></i>
            </button>
            <button onClick={() => _onMoveSectionDown('achievements')} className="move-btn" title={t('buttons.moveDown')}>
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.achievements.map(achievement => (
          <div key={achievement.id} className="sidebar-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={achievement.title}
                onChange={(val) => _updateArrayItem('achievements', achievement.id, 'title', val)}
                tag="h3"
                placeholder={t('placeholders.achievementTitle')}
              />
              <EditableText
                value={achievement.description}
                onChange={(val) => _updateArrayItem('achievements', achievement.id, 'description', val)}
                tag="p"
                placeholder={t('placeholders.achievementDescription')}
              />
            </div>
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem('achievements', achievement.id)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
        <button
          className="add-btn"
          onClick={() => _addArrayItem('achievements', {
            title: t('placeholders.achievementTitle'),
            description: t('placeholders.achievementDescription')
          })}
        >
          <i className="fas fa-plus"></i> {t('buttons.add')} {t('sections.achievements')}
        </button>
      </div>
    ),
    courses: (
      <div className="sidebar-section" key="courses">
        <div className="section-header-with-controls">
          <h2>{t('sections.courses')}</h2>
            <div className="section-controls">
            <button onClick={() => _onMoveSectionUp('courses')} className="move-btn" title={t('buttons.moveUp')}>
              <i className="fas fa-arrow-up"></i>
            </button>
            <button onClick={() => _onMoveSectionDown('courses')} className="move-btn" title={t('buttons.moveDown')}>
              <i className="fas fa-arrow-down"></i>
            </button>
          </div>
        </div>
        {_data.courses.map(course => (
          <div key={course.id} className="sidebar-item course-item">
            <div className="sidebar-item-content" style={{ flex: 1 }}>
              <EditableText
                value={course.title}
                onChange={(val) => _updateArrayItem('courses', course.id, 'title', val)}
                tag="h3"
                placeholder={t('placeholders.courseTitle')}
              />
              <EditableText
                value={course.description || ''}
                onChange={(val) => _updateArrayItem('courses', course.id, 'description', val)}
                tag="p"
                className="course-desc"
                placeholder={t('placeholders.institution')}
              />
            </div>
            <button
              className="delete-btn"
              onClick={() => _deleteArrayItem('courses', course.id)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
        <button
          className="add-btn"
          onClick={() => _addArrayItem('courses', {
            title: t('placeholders.courseTitle'),
            description: t('placeholders.institution')
          })}
        >
          <i className="fas fa-plus"></i> {t('buttons.add')} {t('sections.courses')}
        </button>
      </div>
    )
  };

  return (
    <div className="sidebar">
      <div className="profile-image-container">
        {profileImage ? (
          <div className="profile-image" style={{ backgroundImage: `url(${profileImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ) : (
          <label className="profile-image profile-image-upload" htmlFor="profile-upload">
            <i className="fas fa-camera"></i>
            <span className="upload-text">{t('profile.upload')}</span>
            <input
              id="profile-upload"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={onImageUpload}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>

        {_sidebarOrder.map(sectionName =>
          _visibleSections[sectionName] && sections[sectionName]
        )}
    </div>
  );
};

export default Sidebar;
