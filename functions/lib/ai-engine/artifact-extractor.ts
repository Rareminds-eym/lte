import { apiLogger } from "../logger";

export interface ExtractedArtifactContent {
  format: string;
  extractedText: string;
  isReadable: boolean;
  truncated?: boolean;
}

/** Overall cap on extracted text sent to the LLM (TRD §8.4). */
export const ARTIFACT_TEXT_CAP = 50_000;
const PDF_PAGE_CAP = 15;
const MAX_SHEETS = 20;
const SHEET_MAX_ROWS = 2_000;
const SHEET_MAX_COLS = 256;
const TRUNCATION_MARKER = `...[truncated at ${ARTIFACT_TEXT_CAP} chars]`;

export function normalizeArtifactExtension(fileName: string): string {
  if (!fileName.includes(".")) return "";
  return (fileName.split(".").pop() ?? "").trim().replace(/^\./, "").toLowerCase();
}

function finish(text: string, format: string): ExtractedArtifactContent {
  const trimmed = text.trim();
  if (!trimmed) return { format, extractedText: "", isReadable: false };
  if (trimmed.length <= ARTIFACT_TEXT_CAP) {
    return { format, extractedText: trimmed, isReadable: true };
  }
  apiLogger.warn(`Artifact text extraction exceeded ${ARTIFACT_TEXT_CAP} chars`, { format });
  return {
    format,
    extractedText: `${trimmed.slice(0, ARTIFACT_TEXT_CAP)}\n${TRUNCATION_MARKER}`,
    isReadable: true,
    truncated: true,
  };
}

async function parseSpreadsheet(file: File): Promise<ExtractedArtifactContent> {
  // Dynamic import so SheetJS's heavy module body does not execute at worker startup.
  const XLSX = await import("xlsx/xlsx.mjs");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames.slice(0, MAX_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    if (sheet["!ref"]) {
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      range.e.r = Math.min(range.e.r, range.s.r + SHEET_MAX_ROWS - 1);
      range.e.c = Math.min(range.e.c, range.s.c + SHEET_MAX_COLS - 1);
      sheet["!ref"] = XLSX.utils.encode_range(range);
    }
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    // Skip empty sheets: SheetJS returns a phantom "Sheet1" (with !ref "A1") when
    // parsing empty bytes - a header-only marker must not count as readable content.
    if (csv) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    if (parts.join("\n").length >= ARTIFACT_TEXT_CAP) break;
  }
  return finish(parts.join("\n\n"), "spreadsheet");
}

async function parsePdf(file: File): Promise<ExtractedArtifactContent> {
  const buffer = await file.arrayBuffer();
  // Side-effect import registers the worker module for fake-worker fallback (no real Worker in Workers/Node).
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;
  try {
    const pageCount = Math.min(doc.numPages, PDF_PAGE_CAP);
    const parts: string[] = [];
    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      try {
        const textContent = await page.getTextContent();
        const line = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        // Skip empty pages (e.g. scanned/image pages) so marker-only text never
        // counts as readable content and defeats the human-review gate.
        if (line.trim()) parts.push(`[Page ${pageNo}] ${line.trim()}`);
      } finally {
        page.cleanup();
      }
    }
    return finish(parts.join("\n\n"), "pdf");
  } finally {
    await loadingTask.destroy();
  }
}

interface MammothModule {
  extractRawText: (input: {
    arrayBuffer: ArrayBuffer;
    buffer?: ArrayBuffer;
  }) => Promise<{ value: string }>;
  default?: MammothModule;
}

async function parseDocx(file: File): Promise<ExtractedArtifactContent> {
  const arrayBuffer = await file.arrayBuffer();
  const module = (await import("mammoth")) as unknown as MammothModule;
  const mammoth = module.default ?? module;
  // Node entry expects { buffer }, browser build expects { arrayBuffer }; pass both.
  const result = await mammoth.extractRawText({ arrayBuffer, buffer: arrayBuffer });
  return finish(result.value, "docx");
}

export async function extractArtifactContent(file: File): Promise<ExtractedArtifactContent> {
  const format = normalizeArtifactExtension(file.name) || "file";
  try {
    switch (format) {
      case "xlsx":
      case "xls":
      case "csv":
        return await parseSpreadsheet(file);
      case "pdf":
        return await parsePdf(file);
      case "docx":
        return await parseDocx(file);
      case "txt":
      case "text":
      case "md":
        return await parseText(file);
      default:
        return { format, extractedText: "", isReadable: false };
    }
  } catch (error) {
    apiLogger.warn(`Failed to extract artifact content from "${file.name}"`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { format, extractedText: "", isReadable: false };
  }
}

async function parseText(file: File): Promise<ExtractedArtifactContent> {
  const buffer = await file.arrayBuffer();
  // Strict utf-8 first; fall back to windows-1252 for legacy latin1-encoded files
  // (loose utf-8 decoding would silently garble them into U+FFFD replacement chars).
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    decoded = new TextDecoder("windows-1252", { fatal: false })
      .decode(buffer)
      .replace(/^\u00EF\u00BB\u00BF/, "");
  }
  return finish(decoded, "text");
}
