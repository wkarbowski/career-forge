import { describe, expect, it } from "vitest";
import { getClScaleValue, interpolateClScale } from "./CLToolbar";

describe("cover letter scale controls", () => {
  it("maps compact, standard, and spacious body sizes to slider positions", () => {
    expect(getClScaleValue(10)).toBe(0);
    expect(getClScaleValue(12)).toBe(0.5);
    expect(getClScaleValue(14)).toBe(1);
  });

  it("keeps intermediate slider values instead of snapping back to presets", () => {
    expect(interpolateClScale(0.25)).toEqual({
      nameFontSize: 25,
      senderFontSize: 10,
      subjectFontSize: 13,
      bodyFontSize: 11,
    });
    expect(interpolateClScale(0.35).bodyFontSize).toBe(11.4);
  });
});
