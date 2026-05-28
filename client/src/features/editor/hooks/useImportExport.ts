import { useEffect, useRef, useState } from "react";
import { defaultSettings } from "../../../contexts/AppStateContext";
import type { CoverLetterData, CVData, CVSettings, VisibleSections } from "../../../types";

type SaveStatus = "saving" | "saved" | "error" | "";

interface UseImportExportParams {
  data: CVData;
  settings: CVSettings;
  visibleSections: VisibleSections;
  sidebarOrder: string[];
  profileImage: string | null;
  documentType: "resume" | "cover-letter";
  coverLetterData: CoverLetterData;
  setData: (data: CVData) => void;
  setSettings: (settings: CVSettings) => void;
  setVisibleSections: (sections: VisibleSections) => void;
  setSidebarOrder: (order: string[]) => void;
  setProfileImage: (value: string | null) => void;
  setDocumentType: (type: "resume" | "cover-letter") => void;
  setCoverLetterData: (data: CoverLetterData) => void;
  migrateData: (data: CVData) => CVData;
  onSaveStatusChange: (status: SaveStatus) => void;
}

export function useImportExport({
  data,
  settings,
  visibleSections,
  sidebarOrder,
  profileImage,
  documentType,
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
}: UseImportExportParams) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const exportData = {
      data,
      settings,
      visibleSections,
      sidebarOrder,
      profileImage,
      documentType,
      coverLetterData,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = data?.name
      ? `${data.name.replace(/\s+/g, "-")}-cv-${new Date().toISOString().split("T")[0]}.json`
      : `cv-export-${new Date().toISOString().split("T")[0]}.json`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setShowExportMenu(false);
    window.print();
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const importedData = JSON.parse(event.target!.result as string);

        if (importedData.data) setData(migrateData(importedData.data as CVData));
        if (importedData.settings) setSettings({ ...defaultSettings, ...importedData.settings });
        if (importedData.visibleSections) setVisibleSections(importedData.visibleSections);
        if (importedData.sidebarOrder) setSidebarOrder(importedData.sidebarOrder);
        setProfileImage(importedData.profileImage || null);
        if (importedData.documentType) setDocumentType(importedData.documentType);
        if (importedData.coverLetterData) setCoverLetterData(importedData.coverLetterData);

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
  };
}
