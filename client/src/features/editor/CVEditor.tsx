import React, { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import VerticalMenu from "../../components/VerticalMenu";
import CentralToolbar from "../../components/CentralToolbar";
import CLToolbar from "../../components/CLToolbar";
import CVPagesEditor from "../../components/CVPagesEditor";
import CoverLetterEditor from "../../components/CoverLetterEditor";
import ImageCropperModal from "../../components/ImageCropperModal";
import VersionHistory from "../../components/VersionHistory";
import KeywordMatcher from "../../components/KeywordMatcher";
import ProfileCompleteness from "../../components/ProfileCompleteness";
import { useTranslation } from "../../i18n";
import { useAppState } from "../../contexts/AppStateContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePages } from "../../contexts/PageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { decodeData } from "../../utils/decodeData";
import type { CVData, CVSettings, Document as AppDocument, VisibleSections } from "../../types";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { useEditorDocumentLifecycle } from "./hooks/useEditorDocumentLifecycle";
import { useImportExport } from "./hooks/useImportExport";
import { useProfileImageHandlers } from "./hooks/useProfileImageHandlers";
import { useResumeText } from "./hooks/useResumeText";

interface CVEditorProps {
  onSaveStatusChange: (status: "saving" | "saved" | "error" | "") => void;
}

export default function CVEditor({ onSaveStatusChange }: CVEditorProps) {
  const {
    data,
    setData,
    settings,
    setSettings,
    clSettings,
    setClSettings,
    profileImage,
    setProfileImage,
    visibleSections,
    setVisibleSections,
    sidebarOrder,
    setSidebarOrder,
    documentType,
    setDocumentType,
    coverLetterData,
    setCoverLetterData,
    documentTitle,
    setDocumentTitle,
    migrateData,
  } = useAppState();
  // Defensive: ensure profileImage is always string or null
  React.useEffect(() => {
    if (profileImage && typeof profileImage !== "string") {
      setProfileImage(null);
    }
  }, [profileImage, setProfileImage]);
  const navigate = useNavigate();
  const { cvId } = useParams();
  const location = useLocation();
  const { pages, setPages, setUserForcedMax } = usePages();
  const {
    isAuthenticated,
    isGuest,
    saveDocument,
    currentDocumentId,
    setCurrentDocumentId,
    user,
    updatePreferences,
  } = useAuth();
  const { t, lang } = useTranslation();
  const { theme } = useTheme();

  const [activePanel, setActivePanel] = useState<string | null>(null); // 'versions' | 'keywords' | null
  const {
    cropperOpen,
    cropperImage,
    setCropperOpen,
    setCropperImage,
    handleImageUpload,
    handleImageRemove,
    handleCropComplete,
  } = useProfileImageHandlers({
    isAuthenticated,
    currentDocumentId,
    setProfileImage,
    onSaveStatusChange,
  });

  useEditorDocumentLifecycle({
    data,
    setData,
    settings,
    setSettings,
    clSettings,
    setClSettings,
    profileImage,
    setProfileImage,
    visibleSections,
    setVisibleSections,
    sidebarOrder,
    setSidebarOrder,
    documentType,
    setDocumentType,
    coverLetterData,
    setCoverLetterData,
    documentTitle,
    setDocumentTitle,
    migrateData,
    pages,
    setPages,
    setUserForcedMax,
    isAuthenticated,
    isGuest,
    saveDocument,
    currentDocumentId,
    setCurrentDocumentId,
    user,
    updatePreferences,
    theme,
    lang,
    cvId,
    locationSearch: location.search,
    navigate,
    onSaveStatusChange,
  });

  const {
    isEditingTitle,
    editingTitleValue,
    titleInputRef,
    setEditingTitleValue,
    setIsEditingTitle,
    handleTitleEdit,
    handleTitleSave,
    handleTitleKeyDown,
  } = useDocumentTitle({
    documentTitle,
    setDocumentTitle,
    isAuthenticated,
    currentDocumentId,
  });

  const {
    showExportMenu,
    setShowExportMenu,
    exportMenuRef,
    fileInputRef,
    handleExport,
    handleExportPdf,
    handleImport,
  } = useImportExport({
    data,
    settings,
    visibleSections,
    sidebarOrder,
    profileImage,
    documentType,
    documentTitle,
    coverLetterData,
    setData,
    setSettings,
    setVisibleSections,
    setSidebarOrder,
    setProfileImage,
    setDocumentType,
    setCoverLetterData,
    migrateData,
    onSaveStatusChange,
  });

  const togglePanel = (panel: string) =>
    setActivePanel((prev) => (prev === panel ? null : panel));

  const handleVersionRestore = (doc: AppDocument) => {
    if (!doc) return;
    try {
      const docData = doc.data;
      if (docData) {
        const decoded = decodeData(docData) as Record<string, unknown>;
        if (decoded.data) setData(migrateData(decoded.data as CVData));
        if (decoded.settings) setSettings(decoded.settings as CVSettings);
        if (decoded.visibleSections)
          setVisibleSections(decoded.visibleSections as VisibleSections);
        if (decoded.sidebarOrder)
          setSidebarOrder(decoded.sidebarOrder as string[]);
        setProfileImage((decoded.profileImage as string | null) || null);
      }
      setActivePanel(null);
    } catch (err) {
      console.error("Version restore failed:", err);
    }
  };

  const resumeText = useResumeText(data);

  return (
    <>
      {cropperOpen && cropperImage && (
        <ImageCropperModal
          imageSrc={cropperImage}
          onCancel={() => {
            setCropperOpen(false);
            setCropperImage(null);
          }}
          onCropComplete={handleCropComplete}
          aspect={1}
        />
      )}
      {/* Editor-specific toolbar for print/export/import */}
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Document actions"
      >
        <div className="document-title-wrapper">
          {isEditingTitle ? (
            <div className="title-edit-container">
              <input
                ref={titleInputRef}
                type="text"
                className="document-title-input"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                aria-label={t("editor.documentTitle") || "Document title"}
              />
              <button
                className="title-action-btn save"
                onClick={handleTitleSave}
                title={t("common.save")}
                aria-label={t("common.save")}
              >
                <i className="fas fa-check"></i>
              </button>
              <button
                className="title-action-btn cancel"
                onClick={() => setIsEditingTitle(false)}
                title={t("common.cancel")}
                aria-label={t("common.cancel")}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <button
              className="document-title"
              onClick={handleTitleEdit}
              aria-label={t("editor.editTitle") || "Edit document title"}
            >
              <i className="fas fa-file-alt"></i>
              <span>
                {documentTitle ||
                  t("editor.untitledDocument") ||
                  "Untitled Document"}
              </span>
              <i className="fas fa-pen edit-icon"></i>
            </button>
          )}
        </div>
        <div className="toolbar-buttons">
          <div className="export-dropdown" ref={exportMenuRef}>
            <button
              className="secondary"
              onClick={() => setShowExportMenu((prev) => !prev)}
              aria-expanded={showExportMenu}
              aria-haspopup="true"
            >
              <i className="fas fa-download"></i> {t("toolbar.export")}
              <i
                className={`fas fa-chevron-${showExportMenu ? "up" : "down"} export-chevron`}
              ></i>
            </button>
            {showExportMenu && (
              <div className="export-dropdown-menu" role="menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    handleExport();
                    setShowExportMenu(false);
                  }}
                >
                  <i className="fas fa-file-code"></i> {t("toolbar.exportJson")}
                </button>
                <button role="menuitem" onClick={handleExportPdf}>
                  <i className="fas fa-file-pdf"></i> {t("toolbar.exportPdf")}
                </button>
              </div>
            )}
          </div>
          <label className="secondary toolbar-import-btn">
            <i className="fas fa-upload"></i> {t("toolbar.import")}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImport}
              aria-label={t("toolbar.import")}
            />
          </label>
          {documentType !== "cover-letter" &&
            isAuthenticated &&
            currentDocumentId && (
              <>
                <button
                  className={`secondary${activePanel === "versions" ? " active" : ""}`}
                  onClick={() => togglePanel("versions")}
                  title={t("versions.title")}
                >
                  <i className="fas fa-history"></i> {t("versions.title")}
                </button>
                <button
                  className={`secondary${activePanel === "keywords" ? " active" : ""}`}
                  onClick={() => togglePanel("keywords")}
                  title={t("keywords.title")}
                >
                  <i className="fas fa-search"></i> {t("keywords.title")}
                </button>
              </>
            )}
        </div>
      </div>

      {documentType === "cover-letter" ? <CLToolbar /> : <CentralToolbar />}

      <div className="editor-layout">
        <VerticalMenu />
        {documentType === "cover-letter" ? (
          <CoverLetterEditor />
        ) : (
          <CVPagesEditor
            profileImage={profileImage}
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
          />
        )}
        {activePanel && documentType !== "cover-letter" && (
          <div className="editor-side-panel">
            <button
              className="side-panel-close"
              onClick={() => setActivePanel(null)}
              title={t("common.close") || "Close"}
            >
              <i className="fas fa-times"></i>
            </button>
            {activePanel === "versions" && (
              <VersionHistory
                documentId={currentDocumentId}
                onRestore={handleVersionRestore}
              />
            )}
            {activePanel === "keywords" && (
              <KeywordMatcher resumeText={resumeText} />
            )}
          </div>
        )}
      </div>
      {documentType !== "cover-letter" && (
        <div className="editor-completeness-bar hide-on-print">
          <ProfileCompleteness data={data} />
        </div>
      )}
    </>
  );
}
