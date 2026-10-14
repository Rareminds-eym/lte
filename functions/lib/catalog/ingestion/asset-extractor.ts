export const ASSET_EXTRACTION_CONFIG: Record<string, string[]> = {
  artifact_templates: [
    "file_url",
    "template_file_url",
    "template_url",
    "sample_output_url",
    "resource_url",
  ],
  artifact_questions: ["reference_url", "solution_url", "asset_url", "image_url"],
  module_artifacts: [
    "template_url",
    "artifact_url",
    "sample_url",
    "starter_code_url",
    "download_url",
  ],
  e_content: ["url", "media_url", "asset_url", "content_url", "learning_content.context_link"],
  courses: ["thumbnail_url", "banner_url", "image_url"],
};

const URL_PATTERN = /https?:\/\/[^\s<>"'|]+/gi;
const IMPORTABLE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export interface AssetOccurrence {
  tableName: string;
  rowIndex: number;
  fieldPath: string;
}

export interface AssetReference {
  originalUrl: string;
  tableName: string;
  rowIndex: number;
  fieldPath: string;
  occurrences: AssetOccurrence[];
}

function readNested(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function urlsIn(value: unknown): string[] {
  if (typeof value === "string") return value.match(URL_PATTERN) || [];
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(urlsIn);
  return [];
}

export function assertScalarAssetUrl(value: unknown, path: string): void {
  const urls = urlsIn(value);
  if (urls.length > 1 || (typeof value !== "string" && urls.length > 0))
    throw new Error(`INVALID_ASSET_URL: ${path} must contain one URL per row.`);
}

function isImportableSourceUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "https:" && IMPORTABLE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function extractAssets(
  snapshot: unknown,
  config: Record<string, string[]> = ASSET_EXTRACTION_CONFIG,
): AssetReference[] {
  const tables = (snapshot as { tables?: Record<string, unknown> })?.tables || {};
  const unique = new Map<string, AssetReference>();

  for (const [tableName, configuredPaths] of Object.entries(config)) {
    const table = tables[tableName] as { columns?: string[]; rows?: unknown[] } | undefined;
    if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) continue;

    table.rows.forEach((row, rowIndex) => {
      for (const configuredPath of configuredPaths) {
        const [columnName, ...nestedPath] = configuredPath.split(".");
        if (!columnName) continue;
        const columnIndex = table.columns!.indexOf(columnName);
        if (columnIndex < 0) continue;
        const columnValue = Array.isArray(row)
          ? row[columnIndex]
          : (row as Record<string, unknown>)?.[columnName];
        const value = nestedPath.length ? readNested(columnValue, nestedPath) : columnValue;
        const fieldPath = `tables.${tableName}.rows.${rowIndex}.${configuredPath}`;
        // These columns are scalar URLs. Replacing a whole cell cannot preserve a list.
        assertScalarAssetUrl(value, fieldPath);

        for (const originalUrl of urlsIn(value).filter(isImportableSourceUrl)) {
          const occurrence: AssetOccurrence = { tableName, rowIndex, fieldPath };
          const existing = unique.get(originalUrl);
          if (existing) existing.occurrences.push(occurrence);
          else unique.set(originalUrl, { originalUrl, ...occurrence, occurrences: [occurrence] });
        }
      }
    });
  }

  return [...unique.values()];
}
