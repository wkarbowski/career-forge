import { describe, expect, it } from "vitest";
import { sanitizeEditableHtml } from "./editableHtml";

describe("sanitizeEditableHtml", () => {
  it("preserves inline formatting tags used by the editor toolbar", () => {
    const result = sanitizeEditableHtml(
      "<strong>Bold</strong><em>Italic</em><u>Underline</u><s>Strike</s>",
    );

    expect(result).toContain("<strong>Bold</strong>");
    expect(result).toContain("<em>Italic</em>");
    expect(result).toContain("<u>Underline</u>");
    expect(result).toContain(
      '<span style="text-decoration: line-through">Strike</span>',
    );
  });

  it("preserves toolbar color, highlight, decoration, and alignment styles", () => {
    const result = sanitizeEditableHtml(
      '<span style="color: #ff0000; background-color: #ffff00; font-weight: 700; font-style: italic; text-decoration-line: underline; text-align: center; display: block; position: absolute">Text</span>',
    );

    expect(result).toContain("color: #ff0000");
    expect(result).toContain("background-color: #ffff00");
    expect(result).toContain("font-weight: 700");
    expect(result).toContain("font-style: italic");
    expect(result).toContain("text-decoration: underline");
    expect(result).toContain("text-align: center");
    expect(result).toContain("display: block");
    expect(result).not.toContain("position");
  });

  it("normalizes native browser text-decoration output into saveable decoration styles", () => {
    const result = sanitizeEditableHtml(
      '<span style="text-decoration: line-through solid rgb(0, 0, 0); text-decoration-line: underline line-through">Text</span>',
    );

    expect(result).toContain("text-decoration: line-through");
    expect(result).toContain("text-decoration: underline line-through");
    expect(result).not.toContain("text-decoration-line");
  });

  it("normalizes strike tags into backend-safe text-decoration styles", () => {
    const result = sanitizeEditableHtml(
      "<s>One</s><strike>Two</strike><del>Three</del>",
    );

    expect(result).toContain(
      '<span style="text-decoration: line-through">One</span>',
    );
    expect(result).toContain(
      '<span style="text-decoration: line-through">Two</span>',
    );
    expect(result).toContain(
      '<span style="text-decoration: line-through">Three</span>',
    );
    expect(result).not.toContain("<s>");
    expect(result).not.toContain("<strike>");
    expect(result).not.toContain("<del>");
  });

  it("preserves alignment wrappers and lists", () => {
    const result = sanitizeEditableHtml(
      '<div style="text-align: right; display: block">Aligned</div><ul><li>One</li></ul><ol><li>Two</li></ol>',
    );

    expect(result).toContain('<div style="text-align: right; display: block">');
    expect(result).toContain("<ul><li>One</li></ul>");
    expect(result).toContain("<ol><li>Two</li></ol>");
  });

  it("preserves safe link attributes and editor styles", () => {
    const result = sanitizeEditableHtml(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer" style="color: #0044cc; text-decoration: underline" onclick="bad()">Project</a>',
    );

    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain("color: #0044cc");
    expect(result).toContain("text-decoration: underline");
    expect(result).not.toContain("onclick");
  });

  it("normalizes browser font color output into saveable spans", () => {
    const result = sanitizeEditableHtml('<font color="#00ff00">Green</font>');

    expect(result).toContain("<span");
    expect(result).toContain("color: #00ff00");
    expect(result).toContain(">Green</span>");
  });
});
