export type EditableFormattingCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "foreColor"
  | "hiliteColor"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "removeFormat";

export interface EditableFormattingState {
  hasEditableFocus: boolean;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
}

const emptyFormattingState: EditableFormattingState = {
  hasEditableFocus: false,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrike: false,
};

const findEditableEl = (node: Node | null): HTMLElement | null => {
  if (!node) return null;
  let el: Element | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  while (el && (el as HTMLElement).contentEditable !== "true") {
    el = el.parentElement;
  }
  return (el as HTMLElement) || null;
};

const getSelection = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return selection;
};

const restoreSelectionToNode = (node: Node) => {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
};

const wrapSelectionWith = (
  tagName: string,
  style?: Partial<CSSStyleDeclaration>,
) => {
  const selection = getSelection();
  if (!selection || selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  const wrapper = document.createElement(tagName);
  if (style) Object.assign(wrapper.style, style);

  try {
    range.surroundContents(wrapper);
  } catch {
    const fragment = range.extractContents();
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
  }

  restoreSelectionToNode(wrapper);
  return true;
};

const findWrappedAncestor = (tagNames: string[]) => {
  const selection = getSelection();
  if (!selection || !selection.anchorNode) return null;
  const normalizedTags = tagNames.map((tag) => tag.toUpperCase());
  let node: Element | null =
    selection.anchorNode.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : (selection.anchorNode as Element);

  while (node) {
    if (normalizedTags.includes(node.nodeName)) return node;
    if ((node as HTMLElement).contentEditable === "true") break;
    node = node.parentElement;
  }

  return null;
};

const findSelectionAncestor = (
  callback: (element: HTMLElement) => boolean,
) => {
  const selection = getSelection();
  if (!selection || !selection.anchorNode) return null;
  let node: Element | null =
    selection.anchorNode.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : (selection.anchorNode as Element);

  while (node) {
    if ((node as HTMLElement).contentEditable === "true") break;
    if (node instanceof HTMLElement && callback(node)) return node;
    node = node.parentElement;
  }

  return null;
};

const unwrapElement = (element: Element) => {
  const parent = element.parentNode;
  if (!parent) return false;

  const firstChild = element.firstChild;
  const lastChild = element.lastChild;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);

  if (firstChild && lastChild) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStartBefore(firstChild);
    range.setEndAfter(lastChild);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  return true;
};

const cleanupEmptyStyleSpan = (element: HTMLElement) => {
  if (!element.style.cssText) element.removeAttribute("style");
  if (
    element.tagName.toLowerCase() === "span" &&
    !element.getAttribute("style") &&
    element.attributes.length === 0
  ) {
    return unwrapElement(element);
  }
  return true;
};

const toCssPropertyName = (property: keyof CSSStyleDeclaration) =>
  String(property).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

const removeStyleProperty = (
  element: HTMLElement,
  property: keyof CSSStyleDeclaration,
) => {
  element.style.removeProperty(toCssPropertyName(property));
  return cleanupEmptyStyleSpan(element);
};

const isBoldWeight = (value: string) =>
  value === "bold" ||
  value === "bolder" ||
  Number.parseInt(value, 10) >= 600;

const isItalicStyle = (value: string) =>
  value === "italic" || value === "oblique";

const removeDecorationToken = (value: string, tokenToRemove: string) =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token !== tokenToRemove)
    .join(" ");

const removeTextDecorationTokenStyle = (
  element: HTMLElement,
  tokenToRemove: string,
) => {
  const line = element.style.textDecorationLine;
  const decoration = element.style.textDecoration;

  if (line.toLowerCase().includes(tokenToRemove)) {
    const remaining = removeDecorationToken(line, tokenToRemove);
    if (remaining) element.style.textDecorationLine = remaining;
    else element.style.removeProperty("text-decoration-line");
  }

  if (decoration.toLowerCase().includes(tokenToRemove)) {
    const remaining = removeDecorationToken(decoration, tokenToRemove);
    if (remaining) element.style.textDecoration = remaining;
    else element.style.removeProperty("text-decoration");
  }

  return cleanupEmptyStyleSpan(element);
};

const removeLineThroughStyle = (element: HTMLElement) => {
  return removeTextDecorationTokenStyle(element, "line-through");
};

const toggleStrikeThrough = () => {
  const existing = (() => {
    const selection = getSelection();
    if (!selection || selection.isCollapsed) return null;

    let node: Element | null =
      selection.anchorNode?.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement
        : (selection.anchorNode as Element | null);

    while (node) {
      if (!(node instanceof HTMLElement)) {
        node = node.parentElement;
        continue;
      }

      const tag = node.tagName.toLowerCase();
      const decoration = `${node.style.textDecoration} ${node.style.textDecorationLine}`.toLowerCase();
      if (
        tag === "s" ||
        tag === "strike" ||
        tag === "del" ||
        decoration.includes("line-through")
      ) {
        return node;
      }
      if (node.contentEditable === "true") break;
      node = node.parentElement;
    }

    return null;
  })();

  if (existing) {
    const tag = existing.tagName.toLowerCase();
    if (tag === "s" || tag === "strike" || tag === "del") {
      return unwrapElement(existing);
    }
    return removeLineThroughStyle(existing);
  }

  if (getEffectiveTextElementState().isStrike) {
    return wrapSelectionWith("span", {
      textDecoration: getDecorationOverrideWithout("line-through"),
    });
  }

  return wrapSelectionWith("span", { textDecoration: "line-through" });
};

const getSelectionEditable = () => {
  const selection = getSelection();
  if (!selection) return null;
  return findEditableEl(selection.anchorNode);
};

const getSelectionElement = () => {
  const selection = getSelection();
  if (!selection) return null;
  const node = selection.focusNode || selection.anchorNode;
  if (!node) return null;
  return node.nodeType === Node.TEXT_NODE
    ? node.parentElement
    : (node as Element);
};

const getComputedTextDecorationTokens = (element: Element | null) => {
  if (!element) return [];
  const computed = window.getComputedStyle(element);
  const value =
    `${computed.textDecorationLine || ""} ${computed.textDecoration || ""}`.toLowerCase();
  return ["underline", "line-through", "overline"].filter((token) =>
    value.includes(token),
  );
};

const getDecorationOverrideWithout = (tokenToRemove: string) => {
  const remaining = getComputedTextDecorationTokens(getSelectionElement()).filter(
    (token) => token !== tokenToRemove,
  );
  return remaining.length > 0 ? remaining.join(" ") : "none";
};

const walkSelectionAncestors = (
  callback: (element: HTMLElement) => boolean,
) => {
  let element = getSelectionElement();

  while (element) {
    if ((element as HTMLElement).contentEditable === "true") break;
    if (element instanceof HTMLElement && callback(element)) return true;
    element = element.parentElement;
  }

  return false;
};

const hasTextDecoration = (element: HTMLElement, value: string) => {
  const inline =
    element.style.textDecorationLine || element.style.textDecoration || "";
  return inline.toLowerCase().includes(value);
};

const hasComputedTextDecoration = (element: Element, value: string) => {
  const computed = window.getComputedStyle(element);
  return (
    computed.textDecorationLine?.toLowerCase().includes(value) ||
    computed.textDecoration?.toLowerCase().includes(value)
  );
};

const getSelectedTextElementState = () => {
  const hasBoldAncestor = walkSelectionAncestors((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "strong" || tag === "b") return true;
    const weight = element.style.fontWeight;
    return (
      weight === "bold" ||
      weight === "bolder" ||
      Number.parseInt(weight, 10) >= 600
    );
  });

  const hasItalicAncestor = walkSelectionAncestors((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "em" || tag === "i") return true;
    const style = element.style.fontStyle;
    return style === "italic" || style === "oblique";
  });

  const hasUnderlineAncestor = walkSelectionAncestors((element) => {
    if (element.tagName.toLowerCase() === "u") return true;
    return hasTextDecoration(element, "underline");
  });

  const hasStrikeAncestor = walkSelectionAncestors((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "s" || tag === "strike" || tag === "del") return true;
    return hasTextDecoration(element, "line-through");
  });

  return {
    isBold: hasBoldAncestor,
    isItalic: hasItalicAncestor,
    isUnderline: hasUnderlineAncestor,
    isStrike: hasStrikeAncestor,
  };
};

const getEffectiveTextElementState = () => {
  const element = getSelectionElement();
  if (!element) {
    return {
      isBold: false,
      isItalic: false,
      isUnderline: false,
      isStrike: false,
    };
  }

  const computed = window.getComputedStyle(element);
  const fontWeight = computed.fontWeight || "";

  return {
    isBold: isBoldWeight(fontWeight),
    isItalic: isItalicStyle(computed.fontStyle || ""),
    isUnderline: hasComputedTextDecoration(element, "underline"),
    isStrike: hasComputedTextDecoration(element, "line-through"),
  };
};

export const getEditableFormattingState = (): EditableFormattingState => {
  const selection = getSelection();
  if (!selection || selection.rangeCount === 0) return emptyFormattingState;

  const editable = getSelectionEditable();
  if (!editable) return emptyFormattingState;

  const selectedTextElementState = getSelectedTextElementState();
  const effectiveTextElementState = getEffectiveTextElementState();

  return {
    hasEditableFocus: true,
    isBold: selectedTextElementState.isBold || effectiveTextElementState.isBold,
    isItalic:
      selectedTextElementState.isItalic || effectiveTextElementState.isItalic,
    isUnderline:
      selectedTextElementState.isUnderline ||
      effectiveTextElementState.isUnderline,
    isStrike:
      selectedTextElementState.isStrike || effectiveTextElementState.isStrike,
  };
};

const toggleBold = () => {
  const existingTag = findWrappedAncestor(["strong", "b"]);
  if (existingTag) return unwrapElement(existingTag);

  const styled = findSelectionAncestor((element) =>
    isBoldWeight(element.style.fontWeight),
  );
  if (styled) return removeStyleProperty(styled, "fontWeight");

  if (getEffectiveTextElementState().isBold) {
    return wrapSelectionWith("span", { fontWeight: "normal" });
  }

  return wrapSelectionWith("strong");
};

const toggleItalic = () => {
  const existingTag = findWrappedAncestor(["em", "i"]);
  if (existingTag) return unwrapElement(existingTag);

  const styled = findSelectionAncestor((element) =>
    isItalicStyle(element.style.fontStyle),
  );
  if (styled) return removeStyleProperty(styled, "fontStyle");

  if (getEffectiveTextElementState().isItalic) {
    return wrapSelectionWith("span", { fontStyle: "normal" });
  }

  return wrapSelectionWith("em");
};

const toggleUnderline = () => {
  const existingTag = findWrappedAncestor(["u"]);
  if (existingTag) return unwrapElement(existingTag);

  const styled = findSelectionAncestor((element) =>
    hasTextDecoration(element, "underline"),
  );
  if (styled) return removeTextDecorationTokenStyle(styled, "underline");

  if (getEffectiveTextElementState().isUnderline) {
    return wrapSelectionWith("span", {
      textDecoration: getDecorationOverrideWithout("underline"),
    });
  }

  return wrapSelectionWith("u");
};

const findNearestBlock = (start: Node | null, editable: HTMLElement) => {
  let node: Element | null =
    start?.nodeType === Node.TEXT_NODE
      ? start.parentElement
      : (start as Element | null);

  while (node && node !== editable) {
    const display = window.getComputedStyle(node).display;
    if (display !== "inline") return node as HTMLElement;
    node = node.parentElement;
  }

  return null;
};

const setEditableAlignmentWrapper = (
  editable: HTMLElement,
  alignment: CSSStyleDeclaration["textAlign"],
) => {
  const wrapperTag = editable.tagName === "DIV" ? "div" : "span";
  const onlyElement =
    editable.childNodes.length === 1 && editable.firstElementChild
      ? (editable.firstElementChild as HTMLElement)
      : null;
  const existingWrapper =
    onlyElement &&
    onlyElement.style.display === "block" &&
    onlyElement.style.textAlign
      ? onlyElement
      : null;

  const wrapper = existingWrapper || document.createElement(wrapperTag);
  wrapper.style.display = "block";
  wrapper.style.textAlign = alignment;

  if (!existingWrapper) {
    while (editable.firstChild) wrapper.appendChild(editable.firstChild);
    editable.appendChild(wrapper);
  }

  restoreSelectionToNode(wrapper);
  return true;
};

const setAlignment = (alignment: CSSStyleDeclaration["textAlign"]) => {
  const selection = getSelection();
  const editable = getSelectionEditable();
  if (!selection || !editable) return false;

  const block = findNearestBlock(selection.anchorNode, editable);
  if (block) {
    block.style.textAlign = alignment;
    return true;
  }

  return setEditableAlignmentWrapper(editable, alignment);
};

const insertList = (ordered: boolean) => {
  const selection = getSelection();
  if (!selection) return false;
  const range = selection.getRangeAt(0);
  const list = document.createElement(ordered ? "ol" : "ul");
  const li = document.createElement("li");

  if (selection.isCollapsed) {
    li.appendChild(document.createElement("br"));
  } else {
    li.appendChild(range.extractContents());
  }

  list.appendChild(li);
  range.insertNode(list);
  restoreSelectionToNode(li);
  return true;
};

const removeFormat = () => {
  const selection = getSelection();
  if (!selection || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const fragment = range.extractContents();
  const textNode = document.createTextNode(fragment.textContent || "");
  range.insertNode(textNode);
  restoreSelectionToNode(textNode);
  return true;
};

const runBrowserCommandFallback = (
  command: EditableFormattingCommand,
  value?: string,
) => {
  try {
    document.execCommand("styleWithCSS", false, "true");
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
};

const runNativeCommand = (
  command: EditableFormattingCommand,
  value?: string,
) => {
  const editable = getSelectionEditable();
  const before = editable?.innerHTML;

  const run = (nativeCommand: string) => {
    try {
      document.execCommand("styleWithCSS", false, "true");
      return document.execCommand(nativeCommand, false, value);
    } catch {
      return false;
    }
  };

  let applied = run(command);
  if (command === "hiliteColor" && !applied) {
    applied = run("backColor");
  }

  return {
    applied,
    changed: Boolean(editable && before !== editable.innerHTML),
  };
};

export const applyEditableFormattingCommand = (
  command: EditableFormattingCommand,
  value?: string,
) => {
  const selection = getSelection();
  if (!selection) return false;

  if (selection.isCollapsed) {
    return runBrowserCommandFallback(command, value);
  }

  if (
    ![
      "bold",
      "italic",
      "underline",
      "strikeThrough",
      "justifyLeft",
      "justifyCenter",
      "justifyRight",
    ].includes(command)
  ) {
    const nativeResult = runNativeCommand(command, value);
    if (nativeResult.applied && nativeResult.changed) {
      return true;
    }
  }

  switch (command) {
    case "bold":
      return toggleBold();
    case "italic":
      return toggleItalic();
    case "underline":
      return toggleUnderline();
    case "strikeThrough":
      return toggleStrikeThrough();
    case "foreColor":
      return wrapSelectionWith("span", { color: value || "" });
    case "hiliteColor":
      return wrapSelectionWith("span", { backgroundColor: value || "" });
    case "justifyLeft":
      return setAlignment("left");
    case "justifyCenter":
      return setAlignment("center");
    case "justifyRight":
      return setAlignment("right");
    case "insertUnorderedList":
      return insertList(false);
    case "insertOrderedList":
      return insertList(true);
    case "removeFormat":
      return removeFormat();
    default:
      return runBrowserCommandFallback(command, value);
  }
};
