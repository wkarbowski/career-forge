const JSON_EXTENSION = ".json";

export const sanitizeDownloadBaseName = (name: string): string => {
  const withoutTags = name.replace(/<[^>]*>/g, " ");
  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return decoded
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
};

export const buildJsonDownloadFileName = (
  documentTitle: string,
  fallbackBaseName = "document",
): string => {
  const baseName =
    sanitizeDownloadBaseName(documentTitle) ||
    sanitizeDownloadBaseName(fallbackBaseName) ||
    "document";

  return baseName.toLowerCase().endsWith(JSON_EXTENSION)
    ? baseName
    : `${baseName}${JSON_EXTENSION}`;
};
