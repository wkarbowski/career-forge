import { describe, expect, it } from "vitest";
import { buildJsonDownloadFileName, sanitizeDownloadBaseName } from "./filenames";

describe("download filenames", () => {
  it("uses the document title as the JSON filename", () => {
    expect(buildJsonDownloadFileName("WIKTOR-JAN-KARBOWSKI")).toBe(
      "WIKTOR-JAN-KARBOWSKI.json",
    );
  });

  it("does not append JSON twice", () => {
    expect(buildJsonDownloadFileName("Cover letter.json")).toBe(
      "Cover letter.json",
    );
  });

  it("removes rich-text markup and unsafe filename characters", () => {
    expect(
      sanitizeDownloadBaseName(
        '<span style="text-align: left; display: block"><span>WIKTOR-JAN-KARBOWSKI</span></span> / CV:*?',
      ),
    ).toBe("WIKTOR-JAN-KARBOWSKI CV");
  });

  it("falls back when the title is blank", () => {
    expect(buildJsonDownloadFileName(" ", "cover-letter")).toBe(
      "cover-letter.json",
    );
  });
});
