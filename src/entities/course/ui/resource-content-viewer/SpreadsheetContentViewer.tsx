import type React from "react";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { getLogger } from "@/shared/config/logging";
import { ResourceViewerState } from "./ResourceViewerState";
import { fetchResourceBuffer, getOfficeEmbedUrl, type ResourceRendererProps } from "./types";

const logger = getLogger("course-spreadsheet-viewer");
const MAX_PREVIEW_ROWS = 80;
const MAX_PREVIEW_COLUMNS = 20;

type SheetPreview = {
  sheetName: string;
  rows: string[][];
};

export const SpreadsheetContentViewer: React.FC<ResourceRendererProps> = ({ item }) => {
  const [status, setStatus] = useState<"loading" | "ready" | "office" | "error">("loading");
  const [sheetPreview, setSheetPreview] = useState<SheetPreview | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let isActive = true;

    const renderWorkbook = async () => {
      setStatus("loading");
      setSheetPreview(null);

      try {
        const buffer = await fetchResourceBuffer(item.url, abortController.signal);
        if (!isActive) return;

        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Workbook does not contain a sheet.");

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error("Workbook sheet could not be read.");

        const rows = XLSX.utils
          .sheet_to_json<Array<string | number | boolean | null>>(sheet, {
            blankrows: false,
            defval: "",
            header: 1,
          })
          .slice(0, MAX_PREVIEW_ROWS)
          .map((row) =>
            row.slice(0, MAX_PREVIEW_COLUMNS).map((cell) => (cell === null ? "" : String(cell))),
          );

        setSheetPreview({ rows, sheetName });
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        logger.warn("Spreadsheet preview failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (isActive) setStatus("office");
      }
    };

    void renderWorkbook();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [item.url]);

  if (status === "loading") {
    return <ResourceViewerState title={item.title} message="Preparing spreadsheet preview..." />;
  }

  if (status === "office") {
    return (
      <iframe
        className="h-full w-full border-0 bg-surface-primary"
        src={getOfficeEmbedUrl(item.url)}
        title={item.title}
      />
    );
  }

  if (status === "error" || !sheetPreview) {
    return (
      <ResourceViewerState
        title={item.title}
        message="This spreadsheet could not be previewed here. You can still open the resource in a new tab."
        actionLabel="Open Resource"
        onAction={() => window.open(item.url, "_blank", "noopener,noreferrer")}
      />
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-surface-muted p-4">
      <div className="min-w-max rounded-lg border border-line-default bg-surface-primary shadow-2xs">
        <div className="border-b border-line-subtle px-4 py-3">
          <h3 className="text-sm font-bold text-content-primary">{sheetPreview.sheetName}</h3>
          <p className="mt-0.5 text-xs text-content-muted">
            Showing the first {sheetPreview.rows.length} rows.
          </p>
        </div>
        <table className="border-collapse text-left text-xs text-content-primary">
          <tbody>
            {sheetPreview.rows.map((row, rowIndex) => (
              <tr
                key={`${sheetPreview.sheetName}-${rowIndex}`}
                className={rowIndex === 0 ? "bg-surface-muted font-semibold" : "bg-surface-primary"}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${sheetPreview.sheetName}-${rowIndex}-${cellIndex}`}
                    className="max-w-72 border border-line-subtle px-3 py-2 align-top"
                  >
                    <span className="line-clamp-3">{cell}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
