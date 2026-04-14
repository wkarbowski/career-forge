import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { useAppState } from '../contexts/AppStateContext';
import { cvTemplates, CL_COLOR_PRESETS } from '../data/templates';
import type { CVSettings, VisibleSections, ColorPreset } from '../types';

// Derive a lighter tint from a hex color for sidebarColor2
const deriveLighter = (hex: string, amount = 40) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

const SECTION_ICONS: Record<string, string> = {
  summary: 'align-left',
  experience: 'briefcase',
  education: 'graduation-cap',
  skills: 'tools',
  languages: 'globe',
  coreCompetencies: 'star',
  achievements: 'trophy',
  contact: 'address-card',
  headings: 'heading',
};

// Legacy keys that no longer exist in the data model
const LEGACY_KEYS = new Set(['strengths', 'courses']);
const NON_TOGGLABLE_KEYS = new Set(['experience', 'education']);

interface VerticalMenuProps {
  settings?: CVSettings;
  updateSettings?: (key: string, val: string) => void;
  visibleSections?: VisibleSections;
  toggleSection?: (key: string) => void;
}

const VerticalMenu = ({ settings, updateSettings, visibleSections, toggleSection }: VerticalMenuProps) => {
  const { t } = useTranslation();
  const app = useAppState();

  const _settings = settings ?? app?.settings ?? { sidebarColor1: '#312e81', sidebarColor2: '#4f46e5', accentColor: '#6366f1' } as CVSettings;
  const _visibleSections = visibleSections ?? app?.visibleSections ?? {} as VisibleSections;
  const _updateSettings = updateSettings ?? ((key: string, val: string) => app?.setSettings(prev => ({ ...(prev || {} as CVSettings), [key]: val })));
  const _toggleSection = (key: string) => {
    if (NON_TOGGLABLE_KEYS.has(key)) return;
    if (toggleSection) {
      toggleSection(key);
      return;
    }
    app?.setVisibleSections(prev => ({ ...(prev || {}), [key]: !prev?.[key] }));
  };

  const documentType = app?.documentType || 'resume';

  const colorPresets = useMemo(() => {
    if (documentType === 'cover-letter') {
      const clStyle = _settings?.clStyle || 'standard';
      return CL_COLOR_PRESETS[clStyle as keyof typeof CL_COLOR_PRESETS] || [];
    }
    const layout = _settings?.layout || 'sidebar-left';
    const template = cvTemplates.find(t => t.type === 'resume' && t.settings?.layout === layout);
    return template?.colorPresets || [];
  }, [_settings?.layout, _settings?.clStyle, documentType]);

  const [openPanel, setOpenPanel] = useState<'colors' | 'sections' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const colorsBtnRef = useRef<HTMLButtonElement>(null);
  const sectionsBtnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          !colorsBtnRef.current?.contains(e.target as Node) &&
          !sectionsBtnRef.current?.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Recompute panel position when opening a panel
  useEffect(() => {
    if (!openPanel) {
      setPanelPos(null);
      return;
    }

    const anchorMap: Record<string, React.RefObject<HTMLButtonElement | null>> = { colors: colorsBtnRef, sections: sectionsBtnRef };
    const anchor = anchorMap[openPanel]?.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const left = rect.right + 12;

    const id = setTimeout(() => {
      if (!panelRef.current) {
        setPanelPos({ left, top: rect.top });
        return;
      }
      const panelRect = panelRef.current.getBoundingClientRect();
      let adjustedTop = rect.top;
      
      if (adjustedTop + panelRect.height > window.innerHeight - 8) {
        adjustedTop = Math.max(8, window.innerHeight - panelRect.height - 8);
      }
      if (adjustedTop < 8) adjustedTop = 8;
      
      setPanelPos({ left, top: adjustedTop });
    }, 0);

    return () => clearTimeout(id);
  }, [openPanel]);

  const toggle = (panel: 'colors' | 'sections') => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  const handleAddCustomSection = () => {
    if (app?.addCustomSection) {
      app.addCustomSection({
        name: t('sections.customSection') || 'Custom Section',
        type: 'custom',
        position: 'main',
        items: [{ id: `item_${Date.now()}`, title: '', description: '' }],
      });
    }
    setOpenPanel(null);
  };

  const handleAddCoursesSidebarSection = () => {
    if (app?.addCustomSection) {
      app.addCustomSection({
        name: t('sections.courses') || 'Courses',
        type: 'courses',
        position: 'sidebar',
        items: [{ id: `item_${Date.now()}`, title: '', description: '' }],
      });
    }
    setOpenPanel(null);
  };

  // Simplified single sidebar color handler — auto-derives sidebarColor2
  const handleSidebarColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    _updateSettings('sidebarColor1', color);
    _updateSettings('sidebarColor2', deriveLighter(color));
  };

  return (
    <div className="vertical-menu">
      <button
        ref={colorsBtnRef}
        className={`vm-btn ${openPanel === 'colors' ? 'active' : ''}`}
        title={t('settings.title')}
        onClick={() => toggle('colors')}
      >
        <i className="fas fa-palette"></i>
      </button>

      {documentType !== 'cover-letter' && (
        <>
          <button
            ref={sectionsBtnRef}
            className={`vm-btn ${openPanel === 'sections' ? 'active' : ''}`}
            title={t('settings.sections')}
            onClick={() => toggle('sections')}
          >
            <i className="fas fa-layer-group"></i>
          </button>
        </>
      )}

      {openPanel && panelPos && (
        <div
          className="vertical-panel"
          ref={panelRef}
          role="dialog"
          aria-hidden={openPanel ? 'false' : 'true'}
          style={{ position: 'fixed', left: `${panelPos.left}px`, top: `${panelPos.top}px` }}
        >
          {openPanel === 'colors' && (
            <div className="panel-inner">
              <h4>{t('settings.title')}</h4>

              {colorPresets.length > 0 && (
                <div className="preset-section">
                  <label className="preset-label">{t('settings.colorPreset')}</label>
                  <div className="preset-swatches">
                    {colorPresets.map((preset: ColorPreset) => {
                      const isCoverLetter = !preset.sidebarColor1;
                      const isActive = isCoverLetter
                        ? _settings.accentColor === preset.accentColor
                        : _settings.sidebarColor1 === preset.sidebarColor1 &&
                          _settings.accentColor === preset.accentColor;
                      return (
                        <button
                          key={preset.id}
                          className={`preset-swatch${isActive ? ' preset-swatch--active' : ''}${isCoverLetter ? ' preset-swatch--single' : ''}`}
                          title={t(preset.nameKey)}
                          onClick={() => {
                            const update: Partial<CVSettings> = { accentColor: preset.accentColor };
                            if (preset.sidebarColor1) {
                              update.sidebarColor1 = preset.sidebarColor1;
                              update.sidebarColor2 = preset.sidebarColor2 || deriveLighter(preset.sidebarColor1);
                            }
                            app?.setSettings(prev => ({ ...prev, ...update }));
                          }}
                        >
                          {isCoverLetter ? (
                            <span
                              className="swatch-full"
                              style={{ backgroundColor: preset.accentColor }}
                            />
                          ) : (
                            <>
                              <span
                                className="swatch-half swatch-left"
                                style={{ backgroundColor: preset.sidebarColor1 }}
                              />
                              <span
                                className="swatch-half swatch-right"
                                style={{ backgroundColor: preset.accentColor }}
                              />
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="color-row">
                <label>{t('settings.accentColor')}</label>
                <input type="color" value={_settings.accentColor} onChange={(e) => _updateSettings('accentColor', e.target.value)} />
              </div>
              {documentType !== 'cover-letter' && (
                <div className="color-row">
                  <label>{t('settings.sidebarColor')}</label>
                  <input type="color" value={_settings.sidebarColor1} onChange={handleSidebarColorChange} />
                </div>
              )}
            </div>
          )}

          {openPanel === 'sections' && (
            <div className="panel-inner">
              <h4>{t('settings.sections')}</h4>

              <p className="panel-sub-label">{t('settings.visibility')}</p>
              <div className="sections-list">
                {Object.keys(_visibleSections)
                  .filter(key => !LEGACY_KEYS.has(key) && !NON_TOGGLABLE_KEYS.has(key))
                  .map((key) => {
                    const isCustom = key.startsWith('custom_');
                    const icon = SECTION_ICONS[key] || (isCustom ? 'puzzle-piece' : 'circle');
                    const label = isCustom
                      ? (app?.data?.customSections?.find(s => s.id === key)?.title || t('sections.customSection') || 'Custom')
                      : (t(`sections.${key}`) || key);
                    return (
                      <div key={key} className="section-toggle" onClick={() => _toggleSection(key)}>
                        <span className="section-toggle-icon">
                          <i className={`fas fa-${icon}`}></i>
                        </span>
                        <span className="section-toggle-label">{label}</span>
                        <span className={`toggle-switch${_visibleSections[key] ? ' on' : ''}`} />
                      </div>
                    );
                  })
                }
              </div>

              <div className="panel-divider" />

              <p className="panel-sub-label">{t('settings.addSection')}</p>
              <button className="add-custom-section-btn" onClick={handleAddCustomSection}>
                <i className="fas fa-plus"></i>
                <span>{t('sections.customSection')}</span>
              </button>
              <button className="add-custom-section-btn" onClick={handleAddCoursesSidebarSection}>
                <i className="fas fa-graduation-cap"></i>
                <span>{t('sections.courses')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerticalMenu;
