const JSON_EXTENSION = ".json";
const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
};

const decodeCommonHtmlEntities = (value: string): string =>
  value.replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, (entity) => {
    const key = entity.slice(1, -1).toLowerCase();
    return HTML_ENTITY_REPLACEMENTS[key] ?? entity;
  });

export const sanitizeDownloadBaseName = (name: string): string => {
  const withoutTags = name.replace(/<[^>]*>/g, " ");
  const decoded = decodeCommonHtmlEntities(withoutTags);

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
  suffix?: string,
): string => {
  const baseName =
    sanitizeDownloadBaseName(documentTitle) ||
    sanitizeDownloadBaseName(fallbackBaseName) ||
    "document";
  const nameWithoutExtension = baseName.toLowerCase().endsWith(JSON_EXTENSION)
    ? baseName.slice(0, -JSON_EXTENSION.length)
    : baseName;
  const exportBaseName = suffix
    ? `${nameWithoutExtension}_${suffix}`
    : nameWithoutExtension;

  return `${exportBaseName}${JSON_EXTENSION}`;
};
