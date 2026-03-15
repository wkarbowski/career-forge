import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { useAppState } from '../contexts/AppStateContext';

const VerticalMenu = ({ settings, updateSettings, visibleSections, toggleSection }) => {
  const { t } = useTranslation();
  const app = useAppState();

  const _settings = settings ?? app?.settings ?? { sidebarColor1: '#312e81', sidebarColor2: '#4f46e5', accentColor: '#6366f1' };
  const _visibleSections = visibleSections ?? app?.visibleSections ?? {};
  const _updateSettings = updateSettings ?? ((key, val) => app?.setSettings(prev => ({ ...(prev || {}), [key]: val })));
  const _toggleSection = toggleSection ?? ((key) => app?.setVisibleSections(prev => ({ ...(prev || {}), [key]: !prev?.[key] })));
  const [openPanel, setOpenPanel] = useState(null); // 'colors' | 'sections' | null
  const panelRef = useRef(null);
  const colorsBtnRef = useRef(null);
  const sectionsBtnRef = useRef(null);
  const [panelPos, setPanelPos] = useState(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          !colorsBtnRef.current.contains(e.target) && !sectionsBtnRef.current.contains(e.target)) {
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

    const anchor = openPanel === 'colors' ? colorsBtnRef.current : sectionsBtnRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    // Position panel to the right of the button, top-aligned with the button
    const left = rect.right + 12;
    let top = rect.top; // Align top of panel with top of button

    // Make sure panel doesn't go off screen
    const id = setTimeout(() => {
      if (!panelRef.current) {
        setPanelPos({ left, top });
        return;
      }
      const panelRect = panelRef.current.getBoundingClientRect();
      let adjustedTop = rect.top;
      
      // Keep panel within viewport
      if (adjustedTop + panelRect.height > window.innerHeight - 8) {
        adjustedTop = Math.max(8, window.innerHeight - panelRect.height - 8);
      }
      if (adjustedTop < 8) adjustedTop = 8;
      
      setPanelPos({ left, top: adjustedTop });
    }, 0);

    return () => clearTimeout(id);
  }, [openPanel]);

  const toggle = (panel) => {
    setOpenPanel(openPanel === panel ? null : panel);
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

      <button
        ref={sectionsBtnRef}
        className={`vm-btn ${openPanel === 'sections' ? 'active' : ''}`}
        title={t('settings.visibleSections')}
        onClick={() => toggle('sections')}
      >
        <i className="fas fa-eye"></i>
      </button>

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
              <div className="color-row">
                <label>{t('settings.sidebarColor1')}</label>
                <input type="color" value={_settings.sidebarColor1} onChange={(e) => _updateSettings('sidebarColor1', e.target.value)} />
              </div>
              <div className="color-row">
                <label>{t('settings.sidebarColor2')}</label>
                <input type="color" value={_settings.sidebarColor2} onChange={(e) => _updateSettings('sidebarColor2', e.target.value)} />
              </div>
              <div className="color-row">
                <label>{t('settings.accentColor')}</label>
                <input type="color" value={_settings.accentColor} onChange={(e) => _updateSettings('accentColor', e.target.value)} />
              </div>
            </div>
          )}

          {openPanel === 'sections' && (
            <div className="panel-inner">
              <h4>{t('settings.visibleSections')}</h4>
              <div className="sections-list">
                {Object.keys(_visibleSections).map((key) => (
                  <label key={key} className="section-toggle">
                    <input type="checkbox" checked={!!_visibleSections[key]} onChange={() => _toggleSection(key)} />
                    <span>{t(`sections.${key}`) || key}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerticalMenu;
