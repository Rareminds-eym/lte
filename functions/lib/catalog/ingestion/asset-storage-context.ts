/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import type { AssetReference } from "./asset-extractor";

export interface AssetStorageContext {
  moduleNo: number;
  category: "content" | "artifact" | "catalog";
  artifactType?: string;
  artifactSubfolder?: "templates" | "questions";
}

interface SnapshotTable {
  columns?: string[];
  rows?: unknown[][];
}

function table(snapshot: any, name: string): SnapshotTable | undefined {
  return snapshot?.tables?.[name];
}

function rowObject(
  tableData: SnapshotTable | undefined,
  rowIndex: number,
): Record<string, unknown> | null {
  const row = tableData?.rows?.[rowIndex];
  if (!tableData?.columns || !Array.isArray(row)) return null;
  return Object.fromEntries(tableData.columns.map((column, index) => [column, row[index]]));
}

function findRowById(
  snapshot: any,
  tableName: string,
  id: unknown,
): Record<string, unknown> | null {
  const tableData = table(snapshot, tableName);
  const idIndex = tableData?.columns?.indexOf("id") ?? -1;
  if (!tableData?.columns || !tableData.rows || idIndex < 0) return null;
  const target = String(id || "");
  const row = tableData.rows.find(
    (candidate) => Array.isArray(candidate) && String(candidate[idIndex] || "") === target,
  );
  return row
    ? Object.fromEntries(tableData.columns.map((column, index) => [column, row[index]]))
    : null;
}

function moduleNoForContent(snapshot: any, modulesContentId: unknown): number {
  const content = findRowById(snapshot, "modules_content", modulesContentId);
  const module = findRowById(snapshot, "modules", content?.["module_id"]);
  const moduleNo = Number(module?.["module_no"]);
  return Number.isInteger(moduleNo) && moduleNo >= 0 ? moduleNo : 0;
}

function artifactContext(
  snapshot: any,
  artifactId: unknown,
  subfolder?: "templates" | "questions",
): AssetStorageContext {
  const artifact = findRowById(snapshot, "module_artifacts", artifactId);
  return {
    moduleNo: moduleNoForContent(snapshot, artifact?.["modules_content_id"]),
    category: "artifact",
    artifactType: String(artifact?.["artifact_type"] || "artifact"),
    artifactSubfolder: subfolder,
  };
}

export function resolveAssetStorageContext(
  snapshot: any,
  reference: AssetReference,
): AssetStorageContext {
  if (reference.tableName === "e_content") {
    const row = rowObject(table(snapshot, "e_content"), reference.rowIndex);
    return {
      moduleNo: moduleNoForContent(snapshot, row?.["modules_content_id"]),
      category: "content",
    };
  }

  if (reference.tableName === "artifact_templates") {
    const row = rowObject(table(snapshot, "artifact_templates"), reference.rowIndex);
    return artifactContext(snapshot, row?.["artifact_id"], "templates");
  }

  if (reference.tableName === "artifact_questions") {
    const row = rowObject(table(snapshot, "artifact_questions"), reference.rowIndex);
    return artifactContext(snapshot, row?.["artifact_id"], "questions");
  }

  if (reference.tableName === "module_artifacts") {
    const row = rowObject(table(snapshot, "module_artifacts"), reference.rowIndex);
    return {
      moduleNo: moduleNoForContent(snapshot, row?.["modules_content_id"]),
      category: "artifact",
      artifactType: String(row?.["artifact_type"] || "artifact"),
    };
  }

  return { moduleNo: 0, category: "catalog" };
}
