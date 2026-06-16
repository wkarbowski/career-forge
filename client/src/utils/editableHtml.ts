import DOMPurify from "dompurify";

const ALLOWED_CSS = [
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "text-align",
  "display",
];

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "b",
    "i",
    "u",
    "strong",
    "em",
    "br",
    "p",
    "div",
    "ul",
    "ol",
    "li",
    "a",
    "s",
    "strike",
    "del",
    "span",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "style"],
  FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
};

type DOMPurifyWithEditableHookFlag = typeof DOMPurify & {
  __careerForgeEditableHooksInstalled?: boolean;
};

const unsafeCssValuePattern = /url\s*\(|expression\s*\(|javascript:|@import|[<>"'`;]/i;

const normalizeTextDecorationValue = (value: string) => {
  const normalized = value.toLowerCase();
  const decorations = ["underline", "line-through", "overline"].filter(
    (token) => normalized.includes(token),
  );

  if (decorations.length > 0) return decorations.join(" ");
  if (/\bnone\b/.test(normalized)) return "none";
  return null;
};

const sanitizeCssValue = (property: string, value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized || unsafeCssValuePattern.test(normalized)) return null;

  switch (property) {
    case "display":
      return ["block", "inline", "inline-block"].includes(normalized)
        ? normalized
        : null;
    case "text-align":
      return ["left", "right", "center", "justify", "start", "end"].includes(normalized)
        ? normalized
        : null;
    case "font-weight":
      return (
        ["normal", "bold", "bolder", "lighter"].includes(normalized) ||
        /^[1-9]00$/.test(normalized)
      )
        ? normalized
        : null;
    case "font-style":
      return ["normal", "italic", "oblique"].includes(normalized)
        ? normalized
        : null;
    case "text-decoration":
    case "text-decoration-line":
      return normalizeTextDecorationValue(normalized);
    case "color":
    case "background-color":
      return value.trim();
    default:
      return null;
  }
};

const installEditableHtmlHooks = () => {
  const purify = DOMPurify as DOMPurifyWithEditableHookFlag;
  if (purify.__careerForgeEditableHooksInstalled) return;
  purify.__careerForgeEditableHooksInstalled = true;

  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "font" && (node as Element).getAttribute?.("color")) {
      const color = (node as Element).getAttribute("color");
      const span = document.createElement("span");
      span.style.color = color ?? "";
      while (node.firstChild) span.appendChild(node.firstChild);
      node.parentNode?.replaceChild(span, node);
    }

    if (["s", "strike", "del"].includes(data.tagName)) {
      const span = document.createElement("span");
      const style = (node as Element).getAttribute?.("style");
      span.setAttribute(
        "style",
        [style, "text-decoration: line-through"].filter(Boolean).join("; "),
      );

      while (node.firstChild) span.appendChild(node.firstChild);
      node.parentNode?.replaceChild(span, node);
    }
  });

  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName !== "style" || !data.attrValue) return;

    const cleaned = data.attrValue
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separatorIndex = declaration.indexOf(":");
        if (separatorIndex === -1) return null;
        const property = declaration
          .slice(0, separatorIndex)
          .trim()
          .toLowerCase();
        const value = declaration.slice(separatorIndex + 1).trim();
        const sanitizedValue = sanitizeCssValue(property, value);
        if (!ALLOWED_CSS.includes(property)) return null;
        if (!sanitizedValue) return null;
        const outputProperty =
          property === "text-decoration-line" ? "text-decoration" : property;
        return `${outputProperty}: ${sanitizedValue}`;
      })
      .filter(Boolean)
      .join("; ");

    data.attrValue = cleaned || "";
    if (!cleaned) data.keepAttr = false;
  });
};

export const sanitizeEditableHtml = (html: string) => {
  installEditableHtmlHooks();
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
};
