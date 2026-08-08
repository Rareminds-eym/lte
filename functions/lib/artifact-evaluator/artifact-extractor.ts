import { apiLogger } from "../../shared/logger";
import { checkZipExpansion } from "./artifact-file-guard";

export interface ExtractedArtifactContent {
  format: string;
  extractedText: string;
  isReadable: boolean;
  truncated?: boolean;
  truncation?: {
    originalLength: number;
    returnedLength: number;
    rowsOmitted: number | null;
  };
}

/** Overall cap on extracted text sent to the LLM (TRD §8.4). */
export const ARTIFACT_TEXT_CAP = 50_000;
const PDF_PAGE_CAP = 15;
const MAX_SHEETS = 20;
const SHEET_MAX_ROWS = 2_000;
const SHEET_MAX_COLS = 256;

function truncationMarker(
  originalLength: number,
  returnedLength: number,
  rowsOmitted: number | null,
): string {
  const rows = rowsOmitted !== null && rowsOmitted > 0 ? `\nRows omitted: ${rowsOmitted}` : "";
  return (
    `[CONTENT TRUNCATED]\nOriginal length: ${originalLength}\nReturned length: ${returnedLength}` +
    rows
  );
}

function finish(
  text: string,
  format: string,
  options: { rowsOmitted?: number | null } = {},
): ExtractedArtifactContent {
  const trimmed = text.trim();
  if (!trimmed) return { format, extractedText: "", isReadable: false };
  const rowsOmitted = options.rowsOmitted ?? null;
  if (trimmed.length <= ARTIFACT_TEXT_CAP && !rowsOmitted) {
    return { format, extractedText: trimmed, isReadable: true };
  }
  const originalLength = trimmed.length;
  const returnedLength = Math.min(trimmed.length, ARTIFACT_TEXT_CAP);
  const marker = truncationMarker(originalLength, returnedLength, rowsOmitted);
  apiLogger.warn(`Artifact text extraction exceeded limits`, {
    format,
    originalLength,
    rowsOmitted,
  });
  return {
    format,
    extractedText: `${trimmed.slice(0, ARTIFACT_TEXT_CAP)}\n${marker}`,
    isReadable: true,
    truncated: true,
    truncation: {
      originalLength,
      returnedLength,
      rowsOmitted,
    },
  };
}

/**
 * Decodes raw bytes as strict UTF-8 (with BOM stripped), falling back to
 * windows-1252 for legacy latin1 content. Loose utf-8 decoding would silently
 * garble latin1 bytes into U+FFFD replacement chars.
 */
function decodeTextBytes(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252", { fatal: false })
      .decode(buffer)
      .replace(/^\u00EF\u00BB\u00BF/, "");
  }
}

interface SpreadsheetRows {
  text: string;
}

/**
 * Row-aware spreadsheet serialization: keeps the header row and per-row
 * header-to-value relationships instead of a flat CSV that loses them.
 */
function renderSheetRows(rows: unknown[][], sheetName: string): SpreadsheetRows {
  let headerIndex = -1;
  for (let i = 0; i < rows.length; i += 1) {
    if ((rows[i] ?? []).some((cell) => cell !== "" && cell !== null && cell !== undefined)) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) return { text: "" };

  const header = (rows[headerIndex] ?? []).map((cell) => String(cell));
  const lines: string[] = [`--- Sheet: ${sheetName} ---`, "", "Header:", header.join(" | ")];

  let dataRowCount = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const pairs: string[] = [];
    for (let c = 0; c < header.length; c += 1) {
      const value = row[c];
      if (value === "" || value === null || value === undefined) continue;
      pairs.push(`${header[c]}=${String(value)}`);
    }
    if (pairs.length === 0) continue;
    dataRowCount += 1;
    lines.push("", `Row ${headerIndex + 1 + dataRowCount}`);
    for (const pair of pairs) {
      lines.push("", pair);
    }
  }

  return { text: lines.join("\n").trim() };
}

async function parseSpreadsheet(
  buffer: ArrayBuffer,
  format: string,
): Promise<ExtractedArtifactContent> {
  // Dynamic import so SheetJS's heavy module body does not execute at worker startup.
  const XLSX = await import("xlsx/xlsx.mjs");

  // P1-3 (defense in depth; upload validation already guards): refuse to
  // parse archives with abnormal expansion before SheetJS buffers everything.
  if (format === "xlsx" || format === "xls") {
    const expansion = checkZipExpansion(buffer);
    if (!expansion.safe) {
      apiLogger.warn("Refusing to parse suspicious archive expansion.", {
        format,
        ...expansion,
      });
      return { format, extractedText: "", isReadable: false };
    }
  }

  let workbook: Awaited<ReturnType<typeof XLSX.read>>;
  if (format === "csv") {
    // P1-5: decode BOM-less UTF-8 / UTF-8 BOM / windows-1252 explicitly
    // instead of letting SheetJS guess from raw bytes.
    workbook = XLSX.read(decodeTextBytes(buffer), { type: "string", cellDates: true });
  } else {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  }

  const parts: string[] = [];
  let rowsOmitted = 0;
  for (const sheetName of workbook.SheetNames.slice(0, MAX_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    if (sheet["!ref"]) {
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      const originalRowCount = range.e.r - range.s.r + 1;
      const cappedEndRow = range.s.r + SHEET_MAX_ROWS - 1;
      range.e.r = Math.min(range.e.r, cappedEndRow);
      range.e.c = Math.min(range.e.c, range.s.c + SHEET_MAX_COLS - 1);
      const cappedRowCount = range.e.r - range.s.r + 1;
      if (originalRowCount > cappedRowCount) {
        rowsOmitted += originalRowCount - cappedRowCount;
      }
      sheet["!ref"] = XLSX.utils.encode_range(range);
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const rendered = renderSheetRows(rows, sheetName);
    // Skip empty sheets: SheetJS returns a phantom "Sheet1" (with !ref "A1") when
    // parsing empty bytes - a header-only marker must not count as readable content.
    if (rendered.text) parts.push(rendered.text);
    if (parts.join("\n").length >= ARTIFACT_TEXT_CAP) break;
  }
  return finish(parts.join("\n\n"), "spreadsheet", { rowsOmitted });
}

async function parsePdf(buffer: ArrayBuffer): Promise<ExtractedArtifactContent> {
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

async function parseDocx(buffer: ArrayBuffer): Promise<ExtractedArtifactContent> {
  const module = (await import("mammoth")) as unknown as MammothModule;
  const mammoth = module.default ?? module;
  // Node entry expects { buffer }, browser build expects { arrayBuffer }; pass both.
  const result = await mammoth.extractRawText({ arrayBuffer: buffer, buffer });
  return finish(result.value, "docx");
}

function unescapeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function parsePptx(buffer: ArrayBuffer): Promise<ExtractedArtifactContent> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    return { format: "pptx", extractedText: "", isReadable: false };
  }

  const parts: string[] = [];
  const MAX_SLIDES = 50;

  for (let i = 0; i < Math.min(slideFiles.length, MAX_SLIDES); i += 1) {
    const filename = slideFiles[i];
    if (!filename) continue;
    const xml = await zip.file(filename)?.async("string");
    if (!xml) continue;

    const matches: string[] = [];
    const re = /<a:t[^>]*>(.*?)<\/a:t>/gi;
    let match = re.exec(xml);
    while (match !== null) {
      if (match[1]) {
        const text = unescapeXml(match[1]).trim();
        if (text) matches.push(text);
      }
      match = re.exec(xml);
    }

    if (matches.length > 0) {
      parts.push(`--- Slide ${i + 1} ---\n${matches.join("\n")}`);
    }
  }

  return finish(parts.join("\n\n"), "pptx");
}

/**
 * Extracts readable text from an uploaded artifact file.
 *
 * `preReadBuffer` is an optional caller-provided copy of the file bytes
 * (already read once for signature validation); supplying it avoids a second
 * `arrayBuffer()` allocation of the whole file.
 */
export async function extractArtifactContent(
  file: File,
  preReadBuffer?: ArrayBuffer,
): Promise<ExtractedArtifactContent> {
  const format = normalizeArtifactExtension(file.name) || "file";
  try {
    const buffer = preReadBuffer ?? (await file.arrayBuffer());
    switch (format) {
      case "xlsx":
      case "xls":
      case "csv":
        return await parseSpreadsheet(buffer, format);
      case "pdf":
        return await parsePdf(buffer);
      case "docx":
        return await parseDocx(buffer);
      case "pptx":
      case "ppt":
        return await parsePptx(buffer);
      case "txt":
      case "text":
      case "md":
        return await parseText(buffer);
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

async function parseText(buffer: ArrayBuffer): Promise<ExtractedArtifactContent> {
  return finish(decodeTextBytes(buffer), "text");
}

export function normalizeArtifactExtension(fileName: string): string {
  if (!fileName.includes(".")) return "";
  return (fileName.split(".").pop() ?? "").trim().replace(/^\./, "").toLowerCase();
}
