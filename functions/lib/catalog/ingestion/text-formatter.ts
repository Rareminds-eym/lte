/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
/**
 * Text Formatter Utility
 *
 * Formats any value (string, object, array, number, boolean) into a clean,
 * human-readable string while preventing "[object Object]" artifacts.
 */

export function formatText(val: any, fallback = ""): string {
  if (val === null || val === undefined) return fallback;

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "" || trimmed === "[object Object]") return fallback;

    // Handle JSON string representing object or array
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatText(parsed, fallback);
      } catch {
        // Not valid JSON, keep string
      }
    }
    return trimmed;
  }

  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }

  if (typeof val === "object") {
    if (Array.isArray(val)) {
      const formatted = val
        .map((v) => formatText(v, ""))
        .filter(Boolean)
        .join(", ");
      return formatted || fallback;
    }

    const title = val.title ? formatText(val.title, "") : "";
    const description = val.description ? formatText(val.description, "") : "";

    if (title && description) {
      if (description.toLowerCase().startsWith(title.toLowerCase())) {
        return description;
      }
      return `${title}: ${description}`;
    }
    if (description) return description;
    if (title) return title;
    if (val.problemStatement || val.problem_statement) {
      return formatText(val.problemStatement || val.problem_statement, fallback);
    }
    if (val.text) {
      return formatText(val.text, fallback);
    }

    // Fallback: format key-value pairs
    const entries = Object.entries(val);
    if (entries.length > 0) {
      const parts = entries
        .map(([k, v]) => {
          const str = formatText(v, "");
          return str ? `${k}: ${str}` : "";
        })
        .filter(Boolean);
      if (parts.length > 0) return parts.join(" | ");
    }
  }

  return fallback;
}
