import { describe, expect, it } from "vitest";
import { getResumeScaleValue, interpolateScale } from "./CentralToolbar";

describe("resume scale controls", () => {
  it("maps compact, standard, and spacious body sizes to slider positions", () => {
    expect(getResumeScaleValue(11)).toBe(0);
    expect(getResumeScaleValue(13)).toBe(0.5);
    expect(getResumeScaleValue(16)).toBe(1);
  });

  it("keeps intermediate slider values instead of snapping back to presets", () => {
    expect(interpolateScale(0.25)).toEqual({
      nameFontSize: 32,
      headingFontSize: 13,
      subtitleFontSize: 13,
      bodyFontSize: 12,
    });
    expect(interpolateScale(0.35).bodyFontSize).toBe(12.4);
  });
});
