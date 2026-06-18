import { describe, expect, it, vi } from "vitest";
import {
  applyEditableFormattingCommand,
  getEditableFormattingState,
} from "./editableFormatting";
import { sanitizeEditableHtml } from "./editableHtml";

const selectText = (editable: HTMLElement, text: string) => {
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const index = node.textContent?.indexOf(text) ?? -1;
    if (index !== -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    node = walker.nextNode();
  }
  throw new Error(`Could not find text "${text}"`);
};

const createEditable = (html = "Alpha Beta Gamma") => {
  const editable = document.createElement("div");
  editable.contentEditable = "true";
  editable.innerHTML = html;
  document.body.appendChild(editable);
  return editable;
};

describe("applyEditableFormattingCommand", () => {
  it("applies inline text styles to the selected text", () => {
    const commands = [
      ["bold", "<strong>Beta</strong>"],
      ["italic", "<em>Beta</em>"],
      ["underline", "<u>Beta</u>"],
      ["strikeThrough", '<span style="text-decoration: line-through;">Beta</span>'],
    ] as const;

    commands.forEach(([command, expected]) => {
      document.body.innerHTML = "";
      const editable = createEditable();
      selectText(editable, "Beta");

      expect(applyEditableFormattingCommand(command)).toBe(true);
      expect(editable.innerHTML).toContain(expected);
    });
  });

  it("applies color and highlight styles to the selected text", () => {
    const editable = createEditable();
    selectText(editable, "Beta");

    expect(applyEditableFormattingCommand("foreColor", "#ff0000")).toBe(true);
    expect(editable.innerHTML).toContain('style="color: rgb(255, 0, 0);"');

    selectText(editable, "Gamma");
    expect(applyEditableFormattingCommand("hiliteColor", "#ffff00")).toBe(true);
    expect(editable.innerHTML).toContain(
      'style="background-color: rgb(255, 255, 0);"',
    );
  });

  it("applies alignment and list formatting", () => {
    const editable = createEditable();
    selectText(editable, "Beta");

    expect(applyEditableFormattingCommand("justifyCenter")).toBe(true);
    expect(editable.innerHTML).toContain("text-align: center");

    selectText(editable, "Gamma");
    expect(applyEditableFormattingCommand("insertUnorderedList")).toBe(true);
    expect(editable.innerHTML).toContain("<ul>");
    expect(editable.innerHTML).toContain("<li>Gamma</li>");
  });

  it("sanitizes strikethrough command output into backend-safe markup", () => {
    const editable = createEditable();
    selectText(editable, "Beta");

    expect(applyEditableFormattingCommand("strikeThrough")).toBe(true);

    const savedHtml = sanitizeEditableHtml(editable.innerHTML);
    expect(savedHtml).toContain("text-decoration: line-through");
    expect(savedHtml).not.toContain("text-decoration-line");
    expect(savedHtml).not.toContain("<s>");
    expect(savedHtml).not.toContain("<strike>");
    expect(savedHtml).not.toContain("<del>");
  });

  it("removes only strikethrough while preserving other inline styles", () => {
    const editable = createEditable(
      'Alpha <span style="font-weight: 700; font-style: italic; color: rgb(255, 0, 0); text-decoration: line-through;">Beta</span> Gamma',
    );
    selectText(editable, "Beta");

    expect(applyEditableFormattingCommand("strikeThrough")).toBe(true);

    const savedHtml = sanitizeEditableHtml(editable.innerHTML);
    expect(savedHtml).toContain("font-weight: 700");
    expect(savedHtml).toContain("font-style: italic");
    expect(savedHtml).toContain("color: rgb(255, 0, 0)");
    expect(savedHtml).not.toContain("line-through");
    expect(savedHtml).toContain("Beta");
  });

  it("removes only underline while preserving strikethrough and other inline styles", () => {
    const editable = createEditable(
      'Alpha <span style="font-weight: 700; text-decoration: underline line-through;">Beta</span> Gamma',
    );
    selectText(editable, "Beta");

    expect(applyEditableFormattingCommand("underline")).toBe(true);

    const savedHtml = sanitizeEditableHtml(editable.innerHTML);
    expect(savedHtml).toContain("font-weight: 700");
    expect(savedHtml).toContain("text-decoration: line-through");
    expect(savedHtml).not.toContain("underline");
    expect(savedHtml).toContain("Beta");
  });

  it("turns off inherited strikethrough without clearing inherited underline", () => {
    document.body.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `
      .decorated-field {
        text-decoration-line: underline line-through;
      }
    `;
    document.head.appendChild(style);

    const editable = createEditable("Alpha Beta Gamma");
    editable.className = "decorated-field";
    selectText(editable, "Beta");

    expect(applyEditableFormattingCommand("strikeThrough")).toBe(true);

    const savedHtml = sanitizeEditableHtml(editable.innerHTML);
    expect(savedHtml).toContain("text-decoration: underline");
    expect(savedHtml).not.toContain("line-through");

    style.remove();
  });

  it("uses deterministic backend-safe alignment instead of native browser output", () => {
    const originalExecCommand = document.execCommand;
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    try {
      const editable = createEditable();
      selectText(editable, "Beta");

      expect(applyEditableFormattingCommand("justifyCenter")).toBe(true);
      expect(execCommand).not.toHaveBeenCalled();

      const savedHtml = sanitizeEditableHtml(editable.innerHTML);
      expect(savedHtml).toContain("display: block");
      expect(savedHtml).toContain("text-align: center");
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, "execCommand", {
          configurable: true,
          value: originalExecCommand,
        });
      } else {
        Reflect.deleteProperty(document, "execCommand");
      }
    }
  });

  it("detects active toolbar state from saved semantic and styled HTML", () => {
    const cases = [
      ["<em>Beta</em>", "isItalic"],
      ['<span style="font-style: italic;">Beta</span>', "isItalic"],
      ["<u>Beta</u>", "isUnderline"],
      ['<span style="text-decoration-line: underline;">Beta</span>', "isUnderline"],
      ["<s>Beta</s>", "isStrike"],
      ["<strike>Beta</strike>", "isStrike"],
      ['<span style="text-decoration-line: line-through;">Beta</span>', "isStrike"],
      ['<span style="text-decoration: line-through;">Beta</span>', "isStrike"],
    ] as const;

    cases.forEach(([html, key]) => {
      document.body.innerHTML = "";
      const editable = createEditable(`Alpha ${html} Gamma`);
      selectText(editable, "Beta");

      const state = getEditableFormattingState();
      expect(state.hasEditableFocus).toBe(true);
      expect(state[key]).toBe(true);
    });
  });

  it("marks toolbar buttons active for visually inherited template styles", () => {
    document.body.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `
      .template-styled .template-field {
        font-weight: 700;
        font-style: italic;
        text-decoration-line: line-through;
      }
    `;
    document.head.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.className = "template-styled";
    document.body.appendChild(wrapper);

    const editable = document.createElement("div");
    editable.className = "template-field";
    editable.contentEditable = "true";
    editable.innerHTML = "Alpha Beta Gamma";
    wrapper.appendChild(editable);
    selectText(editable, "Beta");

    const state = getEditableFormattingState();
    expect(state.hasEditableFocus).toBe(true);
    expect(state.isBold).toBe(true);
    expect(state.isItalic).toBe(true);
    expect(state.isStrike).toBe(true);

    style.remove();
  });

  it("turns off template-inherited bold with a local normal override", () => {
    document.body.innerHTML = "";
    const editable = createEditable("Alpha Beta Gamma");
    editable.style.fontWeight = "700";
    selectText(editable, "Beta");

    expect(getEditableFormattingState().isBold).toBe(true);
    expect(applyEditableFormattingCommand("bold")).toBe(true);

    const savedHtml = sanitizeEditableHtml(editable.innerHTML);
    expect(savedHtml).toContain("font-weight: normal");
    expect(savedHtml).toContain("Beta");
  });

  it("removes explicit bold while preserving other inline styles", () => {
    const editable = createEditable(
      'Alpha <span style="font-weight: 700; font-style: italic; color: rgb(255, 0, 0);">Beta</span> Gamma',
    );
    selectText(editable, "Beta");

    expect(applyEditableFormattingCommand("bold")).toBe(true);

    const savedHtml = sanitizeEditableHtml(editable.innerHTML);
    expect(savedHtml).not.toContain("font-weight: 700");
    expect(savedHtml).toContain("font-style: italic");
    expect(savedHtml).toContain("color: rgb(255, 0, 0)");
    expect(savedHtml).toContain("Beta");
  });
});
