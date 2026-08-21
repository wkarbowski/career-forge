const decodeEntities = (str: string): string => {
  if (typeof str !== "string") return str;
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
};

export const decodeData = (item: unknown): unknown => {
  if (Array.isArray(item)) return item.map(decodeData);
  if (item && typeof item === "object") {
    const out: Record<string, unknown> = {};
    Object.keys(item).forEach((k) => {
      out[k] = decodeData((item as Record<string, unknown>)[k]);
    });
    return out;
  }
  if (typeof item === "string") return decodeEntities(item);
  return item;
};
