import { describe, expect, it } from "vitest";
import type { CVSettings } from "../../../types";
import {
  getBaseCoverLetterAppearance,
  getBaseResumeAppearanceSettings,
} from "./appearanceReset";

const currentSettings: CVSettings = {
  sidebarColor1: "#000000",
  sidebarColor2: "#111111",
  accentColor: "#222222",
  layout: "sidebar-right",
  clStyle: "executive",
  nameFont: "Roboto",
  nameFontSize: 42,
  headingFont: "Roboto",
  headingFontSize: 20,
  subtitleFont: "Roboto",
  subtitleFontSize: 18,
  bodyFont: "Roboto",
  bodyFontSize: 16,
  titleFont: "Roboto",
};

describe("appearance reset helpers", () => {
  it("derives resume appearance defaults from the current layout", () => {
    const resetSettings = getBaseResumeAppearanceSettings(currentSettings);

    expect(resetSettings.sidebarColor1).toBe("#0f2847");
    expect(resetSettings.sidebarColor2).toBe("#1e3a5f");
    expect(resetSettings.accentColor).toBe("#2563eb");
    expect(resetSettings.titleFont).toBe("Inter");
    expect(resetSettings.bodyFontSize).toBe(13);
    expect(resetSettings.layout).toBeUndefined();
  });

  it("derives cover-letter appearance defaults from the current style", () => {
    const resetAppearance = getBaseCoverLetterAppearance(currentSettings);

    expect(resetAppearance.settings.accentColor).toBe("#7c6f57");
    expect(resetAppearance.settings.sidebarColor1).toBe("#111827");
    expect(resetAppearance.settings.sidebarColor2).toBe("#374151");
    expect(resetAppearance.settings.layout).toBeUndefined();
    expect(resetAppearance.clSettings.nameFont).toBe("Playfair Display");
    expect(resetAppearance.clSettings.bodyFont).toBe("Inter");
  });

  it("falls back to default appearance without content or structure fields", () => {
    const resetSettings = getBaseResumeAppearanceSettings({
      ...currentSettings,
      layout: "minimal",
    });

    expect(resetSettings.sidebarColor1).toBe("#312e81");
    expect(resetSettings.accentColor).toBe("#6366f1");
    expect(resetSettings.layout).toBeUndefined();
    expect("data" in resetSettings).toBe(false);
    expect("visibleSections" in resetSettings).toBe(false);
    expect("sidebarOrder" in resetSettings).toBe(false);
  });
});
