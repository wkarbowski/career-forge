import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TemplatesGallery from "../components/TemplatesGallery.jsx";
import { useTranslation } from "../i18n";
import { useAppState } from "../contexts/AppStateContext";
import { useAuth } from "../contexts/AuthContext";
import { usePages } from "../contexts/PageContext";
import { initialCoverLetterData, initialData } from "../data/initialData";
import type { CVSettings, CVTemplate, VisibleSections } from "../types";

export default function TemplatesGalleryWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    setSettings,
    setClSettings,
    setVisibleSections,
    setSidebarOrder,
    setData,
    setProfileImage,
    setDocumentType,
    setCoverLetterData,
  } = useAppState();
  const { isAuthenticated, isGuest, setCurrentDocumentId, documentList } =
    useAuth();
  const { resetPages } = usePages();
  const [showBanner, setShowBanner] = useState(!!location.state?.fromEditor);

  const handleSelectTemplate = (template: CVTemplate) => {
    resetPages();

    if (template.type === "cover-letter") {
      setCoverLetterData({ ...initialCoverLetterData });
      setDocumentType("cover-letter");
      if (template.settings)
        setSettings((prev) => ({ ...prev, ...template.settings }));
      if (template.clSettings)
        setClSettings((prev) => ({ ...prev, ...template.clSettings }));
      setCurrentDocumentId("template");
      sessionStorage.setItem("isTemplate", "true");
      sessionStorage.setItem("selectedTemplateId", template.id);
      if (isAuthenticated || isGuest) {
        navigate("/editor");
      } else {
        navigate("/");
      }
      return;
    }

    if (template.type === "resume") {
      setData({ ...initialData });
      setProfileImage(null); // Clear any existing profile image
      setDocumentType("resume");

      if (template.settings) setSettings(template.settings as CVSettings);
      setCurrentDocumentId("template");
      sessionStorage.setItem("isTemplate", "true");
      sessionStorage.setItem("selectedTemplateId", template.id);
      if (template.visibleSections)
        setVisibleSections({
          ...({} as VisibleSections),
          ...template.visibleSections,
        } as VisibleSections);
      if (template.sidebarOrder) setSidebarOrder(template.sidebarOrder);

      if (isAuthenticated || isGuest) {
        navigate("/editor");
      } else {
        navigate("/");
      }
    }
  };

  const handleBack = () => {
    if (
      (isAuthenticated || isGuest) &&
      documentList &&
      documentList.length > 0
    ) {
      navigate("/editor");
    } else {
      navigate("/");
    }
  };

  return (
    <>
      {showBanner && (
        <div className="templates-start-banner" role="status">
          <i className="fas fa-info-circle"></i>
          <span>{t("templates.chooseToStart")}</span>
          <button
            className="templates-banner-close"
            onClick={() => setShowBanner(false)}
            aria-label="Dismiss"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      <TemplatesGallery
        onSelectTemplate={handleSelectTemplate}
        onBack={handleBack}
      />
    </>
  );
}
