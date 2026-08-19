import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  normalizeFileExtension,
  validateArtifactFileContent,
  validateFileForQuestion,
} from "../file-validation";

function createTestFile(parts: BlobPart[], fileName: string, options?: FilePropertyBag): File {
  return new File(parts, fileName, options);
}

/** Real xlsx bytes so content-signature validation accepts the fixture. */
const xlsxBuffer = (() => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["a", "b"]]), "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
})();

function u16le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

/** Minimal zip (local headers + central directory + EOCD) with declared sizes. */
function buildZipBuffer(
  entries: Array<{ name: string; compressedSize: number; uncompressedSize: number }>,
): ArrayBuffer {
  const bytes: number[] = [];
  const localOffsets: number[] = [];
  entries.forEach((entry) => {
    const nameBytes = [...new TextEncoder().encode(entry.name)];
    localOffsets.push(bytes.length);
    bytes.push(
      0x50,
      0x4b,
      0x03,
      0x04, // local file header signature
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(entry.compressedSize),
      ...u32le(entry.uncompressedSize),
      ...u16le(nameBytes.length),
      ...u16le(0),
      ...nameBytes,
    );
  });
  const dirOffset = bytes.length;
  entries.forEach((entry, i) => {
    const nameBytes = [...new TextEncoder().encode(entry.name)];
    bytes.push(
      0x50,
      0x4b,
      0x01,
      0x02, // central directory signature
      0x14,
      0x00,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // crc-32
      ...u32le(entry.compressedSize),
      ...u32le(entry.uncompressedSize),
      ...u16le(nameBytes.length),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u16le(0),
      ...u32le(localOffsets[i] ?? 0),
      0x00,
      0x00,
      ...nameBytes,
    );
  });
  bytes.push(
    0x50,
    0x4b,
    0x05,
    0x06, // end of central directory
    0x00,
    0x00,
    0x00,
    0x00,
    ...u16le(entries.length),
    ...u16le(entries.length),
    ...u32le(bytes.length - dirOffset),
    ...u32le(dirOffset),
    0x00,
    0x00,
  );
  return new Uint8Array(bytes).buffer;
}

const FILE_QUESTION = {
  response_type: "file" as const,
  allowed_file_types: ["xlsx", "pdf"],
  max_file_size_mb: 10,
};

const fileToBuffer = async (file: File): Promise<ArrayBuffer> => file.arrayBuffer();

/** Minimal but valid PDF; pdfjs must be able to parse it and count pages. */
function buildPdfFileWithPages(pageContents: string[]): ArrayBuffer {
  const objects: string[] = [];
  const N = pageContents.length;
  const fontIdx = 3 + 2 * N;
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageContents.map((_, i) => `${3 + 2 * i} 0 R`).join(" ")}] /Count ${N} >>`,
  );
  pageContents.forEach((content, i) => {
    const contentIdx = 4 + 2 * i;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIdx} 0 R /Resources << /Font << /F1 ${fontIdx} 0 R >> >> >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf).buffer;
}

describe("normalizeFileExtension", () => {
  it("lowercases and strips leading dots", () => {
    expect(normalizeFileExtension("Report.XLSX")).toBe("xlsx");
    expect(normalizeFileExtension(".PDF")).toBe("pdf");
    expect(normalizeFileExtension("noext")).toBe("");
  });
});

describe("validateFileForQuestion", () => {
  it("returns the normalized extension for an allowed file", () => {
    const file = createTestFile([xlsxBuffer], "report.XLSX", { type: "application/octet-stream" });
    expect(validateFileForQuestion(file, FILE_QUESTION)).toBe("xlsx");
  });

  it("rejects files for non-file questions", () => {
    const file = createTestFile([xlsxBuffer], "report.xlsx");
    expect(() =>
      validateFileForQuestion(file, { ...FILE_QUESTION, response_type: "text" as const }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_RESPONSE_TYPE", status: 400 }));
  });

  it("rejects a disallowed extension", () => {
    const file = createTestFile([xlsxBuffer], "malware.exe");
    expect(() => validateFileForQuestion(file, FILE_QUESTION)).toThrowError(
      expect.objectContaining({ code: "FILE_TYPE_NOT_ALLOWED" }),
    );
  });

  it("rejects an empty file name", () => {
    const file = createTestFile([xlsxBuffer], "");
    expect(() => validateFileForQuestion(file, FILE_QUESTION)).toThrowError(
      expect.objectContaining({ code: "INVALID_FILE_NAME" }),
    );
  });

  it("rejects an overlong file name", () => {
    const file = createTestFile([xlsxBuffer], `${"a".repeat(255)}.xlsx`);
    expect(() => validateFileForQuestion(file, FILE_QUESTION)).toThrowError(
      expect.objectContaining({ code: "INVALID_FILE_NAME" }),
    );
  });

  it("rejects a file name with control characters", () => {
    const file = createTestFile([xlsxBuffer], "evil\nname.xlsx");
    expect(() => validateFileForQuestion(file, FILE_QUESTION)).toThrowError(
      expect.objectContaining({ code: "INVALID_FILE_NAME" }),
    );
  });

  it("falls back to 'file' when a file has no extension and any type is allowed", () => {
    const file = createTestFile([xlsxBuffer], "noext");
    expect(validateFileForQuestion(file, { ...FILE_QUESTION, allowed_file_types: [""] })).toBe(
      "file",
    );
  });

  it("rejects an oversized file", () => {
    const bigFile = createTestFile([new Uint8Array(11 * 1024 * 1024)], "huge.pdf");
    expect(() => validateFileForQuestion(bigFile, FILE_QUESTION)).toThrowError(
      expect.objectContaining({ code: "FILE_TOO_LARGE" }),
    );
  });
});

describe("validateArtifactFileContent", () => {
  it("accepts a genuine xlsx workbook", async () => {
    const buffer = await fileToBuffer(createTestFile([xlsxBuffer], "book.xlsx"));
    await expect(validateArtifactFileContent(buffer, "xlsx", "book.xlsx")).resolves.toBeUndefined();
  });

  it("rejects a renamed binary with an xlsx extension", async () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3]).buffer;
    await expect(validateArtifactFileContent(buffer, "xlsx", "fake.xlsx")).rejects.toMatchObject({
      code: "INVALID_FILE_SIGNATURE",
    });
  });

  it("rejects a zip bomb with a huge declared uncompressed size", async () => {
    const buffer = buildZipBuffer([
      { name: "xl/sheet1.xml", compressedSize: 10, uncompressedSize: 4_000_000_000 },
    ]);
    await expect(validateArtifactFileContent(buffer, "xlsx", "bomb.xlsx")).rejects.toMatchObject({
      code: "ZIP_BOMB_DETECTED",
    });
  });

  it("does not throw when an archive fails pre-parse (warns and skips)", async () => {
    // Valid zip structure but not a real workbook: signature + expansion pass,
    // the XLSX sheet-limit pre-parse fails and is skipped, not fatal.
    const buffer = buildZipBuffer([
      { name: "not-a-sheet.bin", compressedSize: 4, uncompressedSize: 4 },
    ]);
    await expect(
      validateArtifactFileContent(buffer, "xlsx", "corrupt.xlsx"),
    ).resolves.toBeUndefined();
  });

  it("rejects a workbook with more than 20 sheets", async () => {
    const workbook = XLSX.utils.book_new();
    for (let i = 0; i < 21; i += 1) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["x"]]), `S${i}`);
    }
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    await expect(
      validateArtifactFileContent(buffer, "xlsx", "many-sheets.xlsx"),
    ).rejects.toMatchObject({ code: "EXCEEDS_SHEET_LIMIT" });
  });

  it("accepts a legacy xls workbook", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["a"]]), "Sheet1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" });
    await expect(validateArtifactFileContent(buffer, "xls", "legacy.xls")).resolves.toBeUndefined();
  });

  it("accepts a docx archive (zip expansion only)", async () => {
    await expect(
      validateArtifactFileContent(xlsxBuffer, "docx", "doc.docx"),
    ).resolves.toBeUndefined();
  });

  it("accepts a plain zip archive", async () => {
    await expect(
      validateArtifactFileContent(xlsxBuffer, "zip", "bundle.zip"),
    ).resolves.toBeUndefined();
  });

  it("rejects a presentation with more than 50 slides", async () => {
    const zip = new JSZip();
    for (let i = 1; i <= 51; i += 1) {
      zip.file(`ppt/slides/slide${i}.xml`, "<p:sld xmlns:p='x'/>");
    }
    const buffer = await zip.generateAsync({ type: "uint8array" });
    await expect(
      validateArtifactFileContent(buffer.buffer as ArrayBuffer, "pptx", "many-slides.pptx"),
    ).rejects.toMatchObject({ code: "EXCEEDS_SLIDE_LIMIT" });
  });

  it("does not throw when a pptx fails pre-parse (warns and skips)", async () => {
    const buffer = buildZipBuffer([
      { name: "ppt/slides/slide1.xml", compressedSize: 4, uncompressedSize: 4 },
    ]);
    await expect(
      validateArtifactFileContent(buffer, "pptx", "corrupt.pptx"),
    ).resolves.toBeUndefined();
  });

  // Runs FIRST in the pdf group on purpose: pdfjs's fake worker (vitest env)
  // bleeds the previous document's content into a subsequent unparseable
  // getDocument, so the corrupt payload must see a fresh worker.
  it("does not throw when a pdf fails pre-parse (warns and skips)", async () => {
    const garbage = new TextEncoder().encode("%PDF-1.4 not a real pdf body").buffer as ArrayBuffer;
    await expect(
      validateArtifactFileContent(garbage, "pdf", "broken.pdf"),
    ).resolves.toBeUndefined();
  });

  it("rejects a pdf with more than 50 pages", async () => {
    const content = Array.from({ length: 51 }, (_, i) => `Page ${i + 1}`).map(
      (text) => `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`,
    );
    const buffer = buildPdfFileWithPages(content);
    await expect(validateArtifactFileContent(buffer, "pdf", "long.pdf")).rejects.toMatchObject({
      code: "EXCEEDS_PAGE_LIMIT",
    });
  });
});
