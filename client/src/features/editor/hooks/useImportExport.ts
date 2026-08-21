import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CLSettings,
  CoverLetterData,
  CVData,
  CVSettings,
  VisibleSections,
} from "../../../types";
import { decodeData } from "../../../utils/decodeData";
import {
  buildJsonDownloadFileName,
  buildPdfDownloadFileName,
} from "../../../utils/filenames";
import {
  buildContentExportPayload,
  buildContentWithAppearanceExportPayload,
  getImportedDocumentPayload,
  getCoverLetterAppearanceSettings,
  getResumeAppearanceSettings,
  mergeImportedResumeSections,
  shouldApplyImportedAppearance,
  shouldShowResetFormattingPrompt,
} from "./importPayload";
import {
  getBaseCoverLetterAppearance,
  getBaseResumeAppearanceSettings,
} from "./appearanceReset";

type SaveStatus = "saving" | "saved" | "error" | "";

interface UseImportExportParams {
  data: CVData;
  settings: CVSettings;
  clSettings: CLSettings;
  visibleSections: VisibleSections;
  sidebarOrder: string[];
  profileImage: string | null;
  documentType: "resume" | "cover-letter";
  documentTitle: string;
  coverLetterData: CoverLetterData;
  setData: (data: CVData) => void;
  setSettings: (settings: CVSettings) => void;
  setClSettings: (settings: CLSettings) => void;
  setVisibleSections: (sections: VisibleSections) => void;
  setSidebarOrder: (order: string[]) => void;
  setProfileImage: (value: string | null) => void;
  setCoverLetterData: (data: CoverLetterData) => void;
  migrateData: (data: CVData) => CVData;
  onSaveStatusChange: (status: SaveStatus) => void;
}

export function useImportExport({
  data,
  settings,
  clSettings,
  visibleSections,
  sidebarOrder,
  profileImage,
  documentType,
  documentTitle,
  coverLetterData,
  setData,
  setSettings,
  setClSettings,
  setVisibleSections,
  setSidebarOrder,
  setProfileImage,
  setCoverLetterData,
  migrateData,
  onSaveStatusChange,
}: UseImportExportParams) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showResetFormattingPrompt, setShowResetFormattingPrompt] =
    useState(false);
  const [isResetFormattingPromptPaused, setIsResetFormattingPromptPaused] =
    useState(false);
  const [resetFormattingProgressKey, setResetFormattingProgressKey] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importedAppearanceCanBeResetRef = useRef(false);

  const dismissResetFormattingPrompt = useCallback(() => {
    setIsResetFormattingPromptPaused(false);
    setShowResetFormattingPrompt(false);
  }, []);

  const pauseResetFormattingPrompt = useCallback(() => {
    setIsResetFormattingPromptPaused(true);
    setResetFormattingProgressKey((key) => key + 1);
  }, []);

  const resumeResetFormattingPrompt = useCallback(() => {
    setIsResetFormattingPromptPaused(false);
    setResetFormattingProgressKey((key) => key + 1);
  }, []);

  const handleResetFormatting = useCallback(() => {
    if (documentType === "cover-letter") {
      const baseAppearance = getBaseCoverLetterAppearance(settings);
      setSettings({
        ...settings,
        ...baseAppearance.settings,
      });
      setClSettings({
        ...clSettings,
        ...baseAppearance.clSettings,
      });
    } else {
      setSettings({
        ...settings,
        ...getBaseResumeAppearanceSettings(settings),
      });
    }
    setIsResetFormattingPromptPaused(false);
    setShowResetFormattingPrompt(false);
    importedAppearanceCanBeResetRef.current = false;
  }, [clSettings, documentType, setClSettings, setSettings, settings]);

  const handleExport = (includeStyles = false) => {
    const exportData =
      documentType === "cover-letter"
        ? includeStyles
          ? buildContentWithAppearanceExportPayload({
              documentType,
              coverLetterData,
              settings,
              clSettings,
            })
          : buildContentExportPayload({ documentType, coverLetterData })
        : includeStyles
          ? buildContentWithAppearanceExportPayload({
              documentType,
              data,
              visibleSections,
              profileImage,
              settings,
            })
          : buildContentExportPayload({
              documentType,
              data,
              visibleSections,
              profileImage,
            });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildJsonDownloadFileName(
      documentTitle,
      documentType === "cover-letter" ? "cover-letter" : "cv",
      includeStyles ? "content_and_appearance" : "content",
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setShowExportMenu(false);
    const originalTitle = document.title;
    const printTitle = buildPdfDownloadFileName(
      documentTitle,
      documentType === "cover-letter" ? "cover-letter" : "cv",
    );
    let restored = false;
    let fallbackTimeoutId: number | undefined;

    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = originalTitle;
      window.removeEventListener("afterprint", restoreTitle);
      if (fallbackTimeoutId !== undefined) {
        window.clearTimeout(fallbackTimeoutId);
      }
    };

    document.title = printTitle;
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
    fallbackTimeoutId = window.setTimeout(restoreTitle, 30000);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    if (!showResetFormattingPrompt || isResetFormattingPromptPaused) return;
    const timeoutId = window.setTimeout(() => {
      setIsResetFormattingPromptPaused(false);
      setShowResetFormattingPrompt(false);
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [isResetFormattingPromptPaused, showResetFormattingPrompt]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const importedData = getImportedDocumentPayload(
          JSON.parse(event.target!.result as string),
        );
        const importIncludedAppearance = shouldApplyImportedAppearance(importedData);
        const importedAppearanceCanBeReset =
          importedAppearanceCanBeResetRef.current;
        let importSucceeded = false;

        if (documentType === "cover-letter") {
          if (importedData.coverLetterData) {
            setCoverLetterData(importedData.coverLetterData as CoverLetterData);
            importSucceeded = true;
          }
          if (importIncludedAppearance) {
            if (importedData.settings) {
              setSettings({
                ...settings,
                ...getCoverLetterAppearanceSettings(importedData.settings),
              });
            }
            if (importedData.clSettings) {
              setClSettings({ ...clSettings, ...importedData.clSettings });
            }
          }
        } else if (importedData.data) {
          const decodedData = decodeData(importedData.data) as CVData;
          const migratedData = migrateData(decodedData);
          const mergedSections = mergeImportedResumeSections({
            importedData: migratedData,
            importedVisibleSections: importedData.visibleSections as
              | Partial<VisibleSections>
              | undefined,
            importedSidebarOrder: importedData.sidebarOrder as string[] | undefined,
            currentVisibleSections: visibleSections,
            currentSidebarOrder: sidebarOrder,
          });

          setData(migratedData);
          if (importIncludedAppearance && importedData.settings) {
            setSettings({
              ...settings,
              ...getResumeAppearanceSettings(importedData.settings),
            });
          }
          setVisibleSections(mergedSections.visibleSections);
          setSidebarOrder(mergedSections.sidebarOrder);
          setProfileImage((importedData.profileImage as string | null) || null);
          importSucceeded = true;
        }

        if (importSucceeded) {
          if (
            shouldShowResetFormattingPrompt(
              importedAppearanceCanBeReset,
              importedData,
            )
          ) {
            setIsResetFormattingPromptPaused(false);
            setResetFormattingProgressKey((key) => key + 1);
            setShowResetFormattingPrompt(true);
          } else {
            setIsResetFormattingPromptPaused(false);
            setShowResetFormattingPrompt(false);
          }
          if (importIncludedAppearance) {
            importedAppearanceCanBeResetRef.current = true;
          }
        }

        onSaveStatusChange("saved");
        setTimeout(() => onSaveStatusChange(""), 3000);
      } catch (err) {
        onSaveStatusChange("error");
        setTimeout(() => onSaveStatusChange(""), 3000);
        console.error("Import error:", err);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    showExportMenu,
    setShowExportMenu,
    exportMenuRef,
    fileInputRef,
    handleExport,
    handleExportPdf,
    handleImport,
    showResetFormattingPrompt,
    isResetFormattingPromptPaused,
    resetFormattingProgressKey,
    dismissResetFormattingPrompt,
    pauseResetFormattingPrompt,
    resumeResetFormattingPrompt,
    handleResetFormatting,
  };
}
