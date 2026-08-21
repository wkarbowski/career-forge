import { cvTemplates } from "../../../data/templates";
import type { CLSettings, CVSettings } from "../../../types";
import {
  getCoverLetterAppearanceSettings,
  getResumeAppearanceSettings,
} from "./importPayload";

const defaultResumeSettings: CVSettings = {
  sidebarColor1: "#312e81",
  sidebarColor2: "#4f46e5",
  accentColor: "#6366f1",
  layout: "sidebar-left",
  nameFont: "Rubik",
  nameFontSize: 36,
  headingFont: "Rubik",
  headingFontSize: 14,
  subtitleFont: "Rubik",
  subtitleFontSize: 14,
  bodyFont: "Inter",
  bodyFontSize: 13,
};

const defaultCoverLetterFontSettings: CLSettings = {
  nameFont: "Open Sans",
  nameFontSize: 28,
  senderFont: "Open Sans",
  senderFontSize: 11,
  subjectFont: "Open Sans",
  subjectFontSize: 13,
  bodyFont: "Open Sans",
  bodyFontSize: 12,
};

export const getBaseResumeAppearanceSettings = (
  currentSettings: CVSettings,
): Partial<CVSettings> => {
  const template = cvTemplates.find(
    (candidate) =>
      candidate.type === "resume" &&
      candidate.settings?.layout === currentSettings.layout,
  );
  const baseSettings = {
    ...defaultResumeSettings,
    ...(template?.settings || {}),
  } as CVSettings;

  return {
    ...getResumeAppearanceSettings(baseSettings),
    titleFont: baseSettings.titleFont,
  };
};

export const getBaseCoverLetterAppearance = (
  currentSettings: CVSettings,
): {
  settings: Partial<CVSettings>;
  clSettings: CLSettings;
} => {
  const currentStyle = currentSettings.clStyle || "standard";
  const template = cvTemplates.find(
    (candidate) =>
      candidate.type === "cover-letter" &&
      (candidate.settings?.clStyle || "standard") === currentStyle,
  );
  const baseSettings = {
    ...defaultResumeSettings,
    ...(template?.settings || {}),
  } as CVSettings;

  return {
    settings: getCoverLetterAppearanceSettings(baseSettings),
    clSettings: {
      ...defaultCoverLetterFontSettings,
      ...(template?.clSettings || {}),
    },
  };
};
