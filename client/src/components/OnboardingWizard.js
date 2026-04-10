import React, { useState } from 'react';
import { useTranslation } from '../i18n';

const STEPS = ['template', 'basics', 'sections'];

const OnboardingWizard = ({ templates, onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [basics, setBasics] = useState({ fullName: '', jobTitle: '', email: '', phone: '' });
  const [selectedSections, setSelectedSections] = useState(['experience', 'education', 'skills', 'languages']);

  const sectionOptions = [
    { id: 'experience', label: t('onboarding.sectionExperience') },
    { id: 'education', label: t('onboarding.sectionEducation') },
    { id: 'skills', label: t('onboarding.sectionSkills') },
    { id: 'languages', label: t('onboarding.sectionLanguages') },
    { id: 'coreCompetencies', label: t('onboarding.sectionCompetencies') },
    { id: 'summary', label: t('onboarding.sectionSummary') },
  ];

  const toggleSection = (id) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const canNext = () => {
    if (step === 0) return selectedTemplate !== null;
    if (step === 1) return basics.fullName.trim().length > 0;
    return true;
  };

  const handleFinish = () => {
    onComplete({
      templateId: selectedTemplate,
      basics,
      visibleSections: selectedSections,
    });
  };

  return (
    <div className="onboarding-wizard">
      <div className="onboarding-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`onboarding-step-dot ${i <= step ? 'active' : ''}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="onboarding-panel">
          <h2>{t('onboarding.pickTemplate')}</h2>
          <p className="onboarding-hint">{t('onboarding.templateHint')}</p>
          <div className="onboarding-templates">
            {(templates || []).map((tmpl) => (
              <button
                key={tmpl.id}
                className={`onboarding-template-card ${selectedTemplate === tmpl.id ? 'selected' : ''}`}
                onClick={() => setSelectedTemplate(tmpl.id)}
              >
                <span className="template-card-name">{tmpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-panel">
          <h2>{t('onboarding.basicInfo')}</h2>
          <p className="onboarding-hint">{t('onboarding.basicInfoHint')}</p>
          <div className="onboarding-form">
            <input
              placeholder={t('onboarding.fullName')}
              value={basics.fullName}
              onChange={(e) => setBasics({ ...basics, fullName: e.target.value })}
            />
            <input
              placeholder={t('onboarding.jobTitle')}
              value={basics.jobTitle}
              onChange={(e) => setBasics({ ...basics, jobTitle: e.target.value })}
            />
            <input
              type="email"
              placeholder={t('onboarding.email')}
              value={basics.email}
              onChange={(e) => setBasics({ ...basics, email: e.target.value })}
            />
            <input
              type="tel"
              placeholder={t('onboarding.phone')}
              value={basics.phone}
              onChange={(e) => setBasics({ ...basics, phone: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-panel">
          <h2>{t('onboarding.chooseSections')}</h2>
          <p className="onboarding-hint">{t('onboarding.sectionsHint')}</p>
          <div className="onboarding-sections">
            {sectionOptions.map((sec) => (
              <label key={sec.id} className="onboarding-section-toggle">
                <input
                  type="checkbox"
                  checked={selectedSections.includes(sec.id)}
                  onChange={() => toggleSection(sec.id)}
                />
                <span>{sec.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="onboarding-nav">
        {step > 0 && (
          <button className="onboarding-back" onClick={() => setStep(step - 1)}>
            <i className="fas fa-arrow-left"></i> {t('onboarding.back')}
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="onboarding-next" onClick={() => setStep(step + 1)} disabled={!canNext()}>
            {t('onboarding.next')} <i className="fas fa-arrow-right"></i>
          </button>
        ) : (
          <button className="onboarding-finish" onClick={handleFinish}>
            {t('onboarding.finish')} <i className="fas fa-check"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
