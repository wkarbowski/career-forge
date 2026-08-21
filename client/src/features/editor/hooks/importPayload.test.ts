import { describe, expect, it } from "vitest";
import type { CLSettings, CVData, CVSettings, VisibleSections } from "../../../types";
import {
  buildContentExportPayload,
  buildContentWithAppearanceExportPayload,
  getImportedDocumentPayload,
  getVisibleResumeData,
  mergeImportedResumeSections,
  shouldApplyImportedAppearance,
  shouldShowResetFormattingPrompt,
} from "./importPayload";

const baseVisibleSections: VisibleSections = {
  summary: true,
  coreCompetencies: false,
  languages: true,
  skills: true,
  achievements: false,
  experience: true,
  education: true,
  projects: false,
};

const baseResumeData: CVData = {
  name: "Imported Person",
  position: "Developer",
  contact: {
    phone: "",
    email: "",
    links: [],
    location: "",
  },
  summary: "",
  coreCompetencies: [],
  languages: [],
  skills: [],
  achievements: [],
  experience: [],
  education: [],
  projects: [],
  customSections: [],
};

const baseSettings: CVSettings = {
  sidebarColor1: "#111111",
  sidebarColor2: "#222222",
  accentColor: "#333333",
  layout: "sidebar-right",
  nameFont: "Rubik",
  nameFontSize: 36,
  headingFont: "Rubik",
  headingFontSize: 14,
  subtitleFont: "Rubik",
  subtitleFontSize: 14,
  bodyFont: "Inter",
  bodyFontSize: 13,
};

const baseClSettings: CLSettings = {
  nameFont: "Open Sans",
  nameFontSize: 28,
  senderFont: "Open Sans",
  senderFontSize: 11,
  subjectFont: "Open Sans",
  subjectFontSize: 13,
  bodyFont: "Open Sans",
  bodyFontSize: 12,
};

describe("getVisibleResumeData", () => {
  it("removes hidden built-in section content before export", () => {
    const visibleData = getVisibleResumeData(
      {
        ...baseResumeData,
        projects: [{ id: 1, name: "Hidden project", description: "Draft" }],
      },
      { ...baseVisibleSections, projects: false },
    );

    expect(visibleData.projects).toEqual([]);
  });

  it("removes hidden custom sections before export", () => {
    const visibleData = getVisibleResumeData(
      {
        ...baseResumeData,
        customSections: [
          {
            id: "custom_visible",
            title: "Visible",
            type: "custom",
            position: "main",
            items: [],
          },
          {
            id: "custom_hidden",
            title: "Hidden",
            type: "custom",
            position: "sidebar",
            items: [],
          },
        ],
      },
      {
        ...baseVisibleSections,
        custom_visible: true,
        custom_hidden: false,
      },
    );

    expect(visibleData.customSections.map((section) => section.id)).toEqual([
      "custom_visible",
    ]);
  });
});

describe("export payload builders", () => {
  it("builds content-only resume exports without style settings", () => {
    const payload = buildContentExportPayload({
      documentType: "resume",
      data: {
        ...baseResumeData,
        projects: [{ id: 1, name: "Hidden project", description: "" }],
      },
      visibleSections: { ...baseVisibleSections, projects: false },
      profileImage: "profile.png",
    });

    expect(payload.exportType).toBe("content");
    expect(payload.data?.projects).toEqual([]);
    expect(payload.settings).toBeUndefined();
  });

  it("builds appearance resume exports with style settings but no layout clone", () => {
    const payload = buildContentWithAppearanceExportPayload({
      documentType: "resume",
      data: baseResumeData,
      visibleSections: baseVisibleSections,
      profileImage: null,
      settings: {
        ...baseSettings,
        layout: "top-header",
        sidebarColor1: "#aaaaaa",
      },
    });

    expect(payload.exportType).toBe("content-with-appearance");
    expect(payload.settings?.sidebarColor1).toBe("#aaaaaa");
    expect(payload.settings?.bodyFontSize).toBe(13);
    expect(payload.settings?.layout).toBeUndefined();
  });

  it("builds appearance cover-letter exports with cover styles", () => {
    const payload = buildContentWithAppearanceExportPayload({
      documentType: "cover-letter",
      coverLetterData: {
        name: "Applicant",
        street: "",
        city: "",
        phone: "",
        email: "",
        place: "",
        date: "",
        recipientCompany: "",
        recipientContact: "",
        recipientStreet: "",
        recipientCity: "",
        subject: "",
        salutation: "",
        body: "",
        closing: "",
        signature: "",
        signatureImage: null,
        extraPages: [],
      },
      settings: baseSettings,
      clSettings: baseClSettings,
    });

    expect(payload.exportType).toBe("content-with-appearance");
    expect(payload.settings?.accentColor).toBe("#333333");
    expect(payload.settings?.layout).toBeUndefined();
    expect(payload.clSettings?.bodyFontSize).toBe(12);
  });
});

describe("shouldApplyImportedAppearance", () => {
  it("applies appearance for current and temporary legacy appearance exports", () => {
    expect(shouldApplyImportedAppearance({ exportType: "content-with-appearance" })).toBe(
      true,
    );
    expect(shouldApplyImportedAppearance({ exportType: "styled-content" })).toBe(true);
    expect(shouldApplyImportedAppearance({ exportType: "content" })).toBe(false);
    expect(shouldApplyImportedAppearance({})).toBe(false);
  });
});

describe("shouldShowResetFormattingPrompt", () => {
  it("shows after an appearance import is followed by a content-only import", () => {
    expect(
      shouldShowResetFormattingPrompt(true, { exportType: "content" }),
    ).toBe(true);
    expect(shouldShowResetFormattingPrompt(true, {})).toBe(true);
  });

  it("keeps showing for repeated content-only imports until formatting is reset", () => {
    expect(
      shouldShowResetFormattingPrompt(true, { exportType: "content" }),
    ).toBe(true);
    expect(
      shouldShowResetFormattingPrompt(true, { exportType: "content" }),
    ).toBe(true);
  });

  it("does not show without a previous appearance import", () => {
    expect(
      shouldShowResetFormattingPrompt(false, { exportType: "content" }),
    ).toBe(false);
  });

  it("does not show when the current import includes appearance", () => {
    expect(
      shouldShowResetFormattingPrompt(true, {
        exportType: "content-with-appearance",
      }),
    ).toBe(false);
  });
});

describe("mergeImportedResumeSections", () => {
  it("uses imported content to show or hide built-in sections while preserving sidebar order", () => {
    const result = mergeImportedResumeSections({
      importedData: {
        ...baseResumeData,
        summary: "Imported summary",
        skills: [{ id: 1, name: "TypeScript" }],
        achievements: [],
        projects: [{ id: 1, name: "Portfolio", description: "" }],
      },
      importedVisibleSections: {
        ...baseVisibleSections,
        projects: true,
      },
      importedSidebarOrder: ["skills", "summary"],
      currentVisibleSections: baseVisibleSections,
      currentSidebarOrder: ["summary", "skills", "languages"],
    });

    expect(result.visibleSections.summary).toBe(true);
    expect(result.visibleSections.skills).toBe(true);
    expect(result.visibleSections.achievements).toBe(false);
    expect(result.visibleSections.projects).toBe(true);
    expect(result.sidebarOrder).toEqual(["summary", "skills", "languages"]);
  });

  it("keeps an imported section hidden when the exported document hid it", () => {
    const result = mergeImportedResumeSections({
      importedData: {
        ...baseResumeData,
        achievements: [
          {
            id: 1,
            title: "Visible content",
            description: "But hidden in source document",
          },
        ],
      },
      importedVisibleSections: {
        achievements: false,
      },
      currentVisibleSections: {
        ...baseVisibleSections,
        achievements: true,
      },
      currentSidebarOrder: ["summary", "achievements"],
    });

    expect(result.visibleSections.achievements).toBe(false);
    expect(result.sidebarOrder).toEqual(["summary", "achievements"]);
  });

  it("adds imported custom sections without replacing destination section setup", () => {
    const result = mergeImportedResumeSections({
      importedData: {
        ...baseResumeData,
        customSections: [
          {
            id: "custom_main",
            title: "Awards",
            type: "custom",
            position: "main",
            items: [],
          },
          {
            id: "custom_sidebar",
            title: "Certifications",
            type: "custom",
            position: "sidebar",
            items: [],
          },
        ],
      },
      importedVisibleSections: {
        custom_main: false,
        custom_sidebar: true,
      },
      importedSidebarOrder: ["custom_sidebar", "skills"],
      currentVisibleSections: baseVisibleSections,
      currentSidebarOrder: ["summary", "skills"],
    });

    expect(result.visibleSections.custom_main).toBe(false);
    expect(result.visibleSections.custom_sidebar).toBe(true);
    expect(result.sidebarOrder).toEqual(["summary", "skills", "custom_sidebar"]);
  });
});

describe("getImportedDocumentPayload", () => {
  it("accepts content-only editor exports where CV data is stored at the root data key", () => {
    const payload = getImportedDocumentPayload({
      data: baseResumeData,
    });

    expect(payload.data).toBe(baseResumeData);
  });

  it("unwraps API exports where document state is stored under data", () => {
    const payload = getImportedDocumentPayload({
      title: "Exported Resume",
      document_type: "resume",
      data: {
        data: baseResumeData,
        settings: { bodyFontSize: 11 },
      },
    });

    expect(payload.data).toBe(baseResumeData);
    expect(payload.settings?.bodyFontSize).toBe(11);
  });
});
