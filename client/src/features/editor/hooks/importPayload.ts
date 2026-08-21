import type {
  CLSettings,
  CoverLetterData,
  CVData,
  CVSettings,
  DocumentData,
  VisibleSections,
} from "../../../types";

const BUILT_IN_CONTENT_SECTIONS = [
  "summary",
  "coreCompetencies",
  "languages",
  "skills",
  "achievements",
  "experience",
  "education",
  "projects",
] as const;

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, " ");

const hasMeaningfulValue = (value: unknown): boolean => {
  if (typeof value === "string") return stripHtml(value).trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean" || value == null) return false;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === "object") {
    return Object.entries(value).some(
      ([key, nestedValue]) =>
        key !== "id" && key !== "type" && hasMeaningfulValue(nestedValue),
    );
  }
  return false;
};

interface MergeImportedResumeSectionsParams {
  importedData: CVData;
  importedVisibleSections?: Partial<VisibleSections>;
  importedSidebarOrder?: string[];
  currentVisibleSections: VisibleSections;
  currentSidebarOrder: string[];
}

type ImportedDocumentPayload = DocumentData & {
  exportType?: "content" | "content-with-appearance" | "styled-content";
  exportedAt?: string;
  exported_at?: string;
};

const hideBuiltInSection = (
  data: CVData,
  section: (typeof BUILT_IN_CONTENT_SECTIONS)[number],
) => {
  switch (section) {
    case "summary":
      data.summary = "";
      break;
    case "coreCompetencies":
      data.coreCompetencies = [];
      break;
    case "languages":
      data.languages = [];
      break;
    case "skills":
      data.skills = [];
      break;
    case "achievements":
      data.achievements = [];
      break;
    case "experience":
      data.experience = [];
      break;
    case "education":
      data.education = [];
      break;
    case "projects":
      data.projects = [];
      break;
  }
};

export const getVisibleResumeData = (
  data: CVData,
  visibleSections: VisibleSections,
): CVData => {
  const visibleData: CVData = {
    ...data,
    customSections: (data.customSections || []).filter(
      (section) => visibleSections[section.id] !== false,
    ),
  };

  BUILT_IN_CONTENT_SECTIONS.forEach((section) => {
    if (visibleSections[section] === false) {
      hideBuiltInSection(visibleData, section);
    }
  });

  return visibleData;
};

const RESUME_APPEARANCE_KEYS = [
  "sidebarColor1",
  "sidebarColor2",
  "accentColor",
  "nameFont",
  "nameFontSize",
  "headingFont",
  "headingFontSize",
  "subtitleFont",
  "subtitleFontSize",
  "bodyFont",
  "bodyFontSize",
  "titleFont",
] as const;

const COVER_LETTER_APPEARANCE_KEYS = [
  "accentColor",
  "sidebarColor1",
  "sidebarColor2",
] as const;

export const getResumeAppearanceSettings = (
  settings: Partial<CVSettings>,
): Partial<CVSettings> =>
  RESUME_APPEARANCE_KEYS.reduce<Partial<CVSettings>>((picked, key) => {
    if (settings[key] !== undefined) {
      picked[key] = settings[key] as never;
    }
    return picked;
  }, {});

export const getCoverLetterAppearanceSettings = (
  settings: Partial<CVSettings>,
): Partial<CVSettings> =>
  COVER_LETTER_APPEARANCE_KEYS.reduce<Partial<CVSettings>>((picked, key) => {
    if (settings[key] !== undefined) {
      picked[key] = settings[key] as never;
    }
    return picked;
  }, {});

export const buildContentExportPayload = (
  params:
    | {
        documentType: "resume";
        data: CVData;
        visibleSections: VisibleSections;
        profileImage: string | null;
      }
    | {
        documentType: "cover-letter";
        coverLetterData: CoverLetterData;
      },
): ImportedDocumentPayload => {
  if (params.documentType === "cover-letter") {
    return {
      exportType: "content",
      coverLetterData: params.coverLetterData,
    };
  }

  return {
    exportType: "content",
    data: getVisibleResumeData(params.data, params.visibleSections),
    profileImage: params.profileImage,
  };
};

export const buildContentWithAppearanceExportPayload = (
  params:
    | {
        documentType: "resume";
        data: CVData;
        visibleSections: VisibleSections;
        profileImage: string | null;
        settings: CVSettings;
      }
    | {
        documentType: "cover-letter";
        coverLetterData: CoverLetterData;
        settings: CVSettings;
        clSettings: CLSettings;
      },
): ImportedDocumentPayload => {
  if (params.documentType === "cover-letter") {
    return {
      exportType: "content-with-appearance",
      coverLetterData: params.coverLetterData,
      settings: getCoverLetterAppearanceSettings(params.settings) as CVSettings,
      clSettings: params.clSettings,
    };
  }

  return {
    exportType: "content-with-appearance",
    data: getVisibleResumeData(params.data, params.visibleSections),
    profileImage: params.profileImage,
    settings: getResumeAppearanceSettings(params.settings) as CVSettings,
  };
};

export const shouldApplyImportedAppearance = (
  importedData: ImportedDocumentPayload,
): boolean =>
  importedData.exportType === "content-with-appearance" ||
  importedData.exportType === "styled-content";

export const shouldShowResetFormattingPrompt = (
  importedAppearanceCanBeReset: boolean,
  importedData: ImportedDocumentPayload,
): boolean =>
  importedAppearanceCanBeReset && !shouldApplyImportedAppearance(importedData);

export const getImportedDocumentPayload = (
  importedData: unknown,
): ImportedDocumentPayload => {
  const root =
    importedData && typeof importedData === "object"
      ? (importedData as Record<string, unknown>)
      : {};
  const nestedData = root.data;

  if (
    nestedData &&
    typeof nestedData === "object" &&
    ("data" in nestedData ||
      "settings" in nestedData ||
      "coverLetterData" in nestedData)
  ) {
    return nestedData as ImportedDocumentPayload;
  }

  return root as ImportedDocumentPayload;
};

export const mergeImportedResumeSections = ({
  importedData,
  importedVisibleSections,
  importedSidebarOrder,
  currentVisibleSections,
  currentSidebarOrder,
}: MergeImportedResumeSectionsParams) => {
  const importedCustomSections = importedData.customSections || [];
  const importedCustomIds = new Set(
    importedCustomSections.map((section) => section.id),
  );
  const sidebarCustomIds = new Set(
    importedCustomSections
      .filter((section) => section.position === "sidebar")
      .map((section) => section.id),
  );

  const visibleSections = { ...currentVisibleSections };

  BUILT_IN_CONTENT_SECTIONS.forEach((section) => {
    visibleSections[section] =
      importedVisibleSections?.[section] !== false &&
      hasMeaningfulValue(importedData[section]);
  });

  importedCustomIds.forEach((id) => {
    if (!(id in visibleSections)) {
      visibleSections[id] = importedVisibleSections?.[id] ?? true;
    }
  });

  const orderedImportedSidebarIds = [
    ...(importedSidebarOrder || []).filter((id) => sidebarCustomIds.has(id)),
    ...Array.from(sidebarCustomIds).filter(
      (id) => !(importedSidebarOrder || []).includes(id),
    ),
  ];

  const sidebarOrder = [...currentSidebarOrder];
  orderedImportedSidebarIds.forEach((id) => {
    if (!sidebarOrder.includes(id)) {
      sidebarOrder.push(id);
    }
  });

  return { visibleSections, sidebarOrder };
};
