import type { LevelProblemStatement } from "./types";

export const normalizeLevelProblemStatement = (
  value: unknown,
  fallbackTitle: string,
  fallbackDescription: string,
): LevelProblemStatement => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as { title?: unknown; description?: unknown };
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const description = typeof record.description === "string" ? record.description.trim() : "";

    return {
      title: title || fallbackTitle,
      description: description || fallbackDescription,
    };
  }

  return {
    title: fallbackTitle,
    description: fallbackDescription,
  };
};
