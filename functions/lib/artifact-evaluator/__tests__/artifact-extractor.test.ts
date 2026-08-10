import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx/xlsx.mjs";
import {
  ARTIFACT_TEXT_CAP,
  extractArtifactContent,
  normalizeArtifactExtension,
} from "../artifact-extractor";

function buildSpreadsheetFile(sheetName: string, rows: (string | number)[][]): File {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new File([buffer], `${sheetName}.xlsx`);
}

async function buildDocxFile(text: string): Promise<File> {
  const zipModule = (await import("jszip")) as unknown as {
    default: {
      new (): {
        file: (path: string, content: string) => void;
        generateAsync: (opts: { type: "nodebuffer" }) => Promise<Uint8Array>;
      };
    };
  };
  const zip = new zipModule.default();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`,
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new File([buffer as unknown as BlobPart], "notes.docx");
}

async function buildPptxFile(slideTexts: string[]): Promise<File> {
  const zipModule = (await import("jszip")) as unknown as {
    default: {
      new (): {
        file: (path: string, content: string) => void;
        generateAsync: (opts: { type: "nodebuffer" }) => Promise<Uint8Array>;
      };
    };
  };
  const zip = new zipModule.default();
  slideTexts.forEach((text, idx) => {
    zip.file(
      `ppt/slides/slide${idx + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>
</p:sld>`,
    );
  });
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new File([buffer as unknown as BlobPart], "presentation.pptx");
}

function buildPdfFile(text: string): File {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  return buildPdfFileWithPages([content]);
}

function buildPdfFileWithPages(pageContents: string[]): File {
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
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new File([Buffer.from(pdf, "latin1").buffer as ArrayBuffer], "report.pdf");
}

function buildSpreadsheetFileWithSheets(sheets: Array<[string, (string | number)[][]]>): File {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new File([buffer], "multi.xlsx");
}

function u16le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

/** Minimal zip whose central directory declares the given uncompressed sizes. */
function buildZipBuffer(
  entries: Array<{ name: string; compressedSize: number; uncompressedSize: number }>,
): Uint8Array {
  const bytes: number[] = [];
  for (const entry of entries) {
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
      0x00,
      ...u32le(entry.compressedSize),
      ...u32le(entry.uncompressedSize),
      ...u16le(nameBytes.length),
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
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...nameBytes,
    );
  }
  const dirSize = bytes.length;
  bytes.push(
    0x50,
    0x4b,
    0x05,
    0x06, // EOCD signature
    ...u16le(0),
    ...u16le(0),
    ...u16le(entries.length),
    ...u16le(entries.length),
    ...u32le(dirSize),
    ...u32le(0),
    ...u16le(0),
  );
  return new Uint8Array(bytes);
}
describe("ai-engine / artifact-extractor", () => {
  describe("normalizeArtifactExtension", () => {
    it("extracts a lowercase extension from a file name", () => {
      expect(normalizeArtifactExtension("Readiness Sheet.XLSX")).toBe("xlsx");
      expect(normalizeArtifactExtension("no-extension")).toBe("");
    });
  });

  describe("extractArtifactContent", () => {
    it("extracts cell text from an xlsx spreadsheet", async () => {
      const file = buildSpreadsheetFile("Readiness", [
        ["Claim ID", "Evidence source", "Confidence"],
        ["C-001", "Incident log 2026-07", "High"],
      ]);
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("C-001");
      expect(result.extractedText).toContain("Incident log 2026-07");
      expect(result.extractedText).toContain("--- Sheet: Readiness ---");
      expect(result.extractedText).toContain("Header:");
      expect(result.extractedText).toContain("Claim ID | Evidence source | Confidence");
      expect(result.extractedText).toContain("Claim ID=C-001");
      expect(result.extractedText).toContain("Evidence source=Incident log 2026-07");
    });

    it("extracts plain text from csv and txt files", async () => {
      const csv = await extractArtifactContent(
        new File(["claim,evidence\nC-001,incident log"], "data.csv"),
      );
      expect(csv.isReadable).toBe(true);
      expect(csv.extractedText).toContain("C-001");
      expect(csv.extractedText).toContain("claim=C-001");
      expect(csv.extractedText).toContain("evidence=incident log");

      const txt = await extractArtifactContent(new File(["Plain analysis text"], "notes.txt"));
      expect(txt.isReadable).toBe(true);
      expect(txt.extractedText).toBe("Plain analysis text");
    });

    it("strips a UTF-8 BOM from csv content", async () => {
      const withBom = new Uint8Array([
        0xef,
        0xbb,
        0xbf,
        ...new TextEncoder().encode("claim,evidence\nC-001,log"),
      ]);
      const result = await extractArtifactContent(new File([withBom], "claims.csv"));
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("claim=C-001");
      expect(result.extractedText).not.toContain("\uFEFF");
      expect(result.extractedText).not.toContain("\uFFFD");
    });

    it("decodes non-latin1 utf-8 csv content correctly", async () => {
      const utf8 = new TextEncoder().encode("claim,evidence\nC-001,café au lait");
      const result = await extractArtifactContent(new File([utf8], "claims.csv"));
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("evidence=café au lait");
      expect(result.extractedText).not.toContain("\uFFFD");
    });

    it("rejects zip bombs before parsing", async () => {
      const bomb = buildZipBuffer([
        { name: "xl/data.bin", compressedSize: 100, uncompressedSize: 50_000_000 },
      ]);
      const result = await extractArtifactContent(new File([bomb as BlobPart], "claims.xlsx"));
      expect(result.isReadable).toBe(false);
      expect(result.extractedText).toBe("");
    });

    it("marks row-capped spreadsheets as truncated with the omitted row count", async () => {
      const rows = [["header", "x"], ...Array.from({ length: 2100 }, (_, i) => [`row-${i}`, "y"])];
      const file = buildSpreadsheetFile("Big", rows);
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.extractedText).toContain("[CONTENT TRUNCATED]");
      expect(result.extractedText).toContain("Rows omitted: 101");
    });

    it("extracts text from a docx file", async () => {
      const file = await buildDocxFile("Hello docx content");
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("Hello docx content");
    });

    it("extracts slide text from a pptx presentation file", async () => {
      const file = await buildPptxFile(["Executive Summary Slide 1", "Market Analysis Slide 2"]);
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("--- Slide 1 ---");
      expect(result.extractedText).toContain("Executive Summary Slide 1");
      expect(result.extractedText).toContain("--- Slide 2 ---");
      expect(result.extractedText).toContain("Market Analysis Slide 2");
    });

    // Runs FIRST in the pdf group on purpose: pdfjs's fake worker (vitest env)
    // bleeds the previous document's content into a subsequent unparseable
    // getDocument. With a fresh worker the corrupt payload rejects and the
    // extractor returns unreadable, matching Node/Workers semantics.
    it("marks corrupt pdfs as unreadable instead of throwing", async () => {
      const garbage = Buffer.from("%PDF-1.4 not a real pdf body").buffer as ArrayBuffer;
      const result = await extractArtifactContent(new File([garbage], "broken.pdf"));
      expect(result.isReadable).toBe(false);
      expect(result.extractedText).toBe("");
    });

    it("extracts text from a pdf file", async () => {
      const file = buildPdfFile("Hello artifact content 42");
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("Hello artifact content 42");
    });

    it("extracts text from a multi-page pdf with page markers", async () => {
      const wrap = (text: string) => `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
      const file = buildPdfFileWithPages(["Page one text", "Page two text"].map(wrap));
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("[Page 1] Page one text");
      expect(result.extractedText).toContain("[Page 2] Page two text");
    });

    it("caps the number of pdf pages processed", async () => {
      const wrap = (text: string) => `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
      const pages = Array.from({ length: 51 }, (_, i) => `Page ${i + 1} text`.replaceAll(" ", "_"));
      const file = buildPdfFileWithPages(pages.map(wrap));
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      const markerCount = (result.extractedText.match(/\[Page \d+\]/g) ?? []).length;
      expect(markerCount).toBe(50);
      expect(result.extractedText).toContain("Page_50_text");
      expect(result.extractedText).not.toContain("Page_51_text");
    });

    it("marks empty files as unreadable", async () => {
      const result = await extractArtifactContent(new File([], "empty.xlsx"));
      expect(result.isReadable).toBe(false);
      expect(result.extractedText).toBe("");
    });

    it("marks password-protected workbooks as unreadable", async () => {
      const oleMagic = new Uint8Array([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00, 0x00, 0x00,
      ]);
      const result = await extractArtifactContent(new File([oleMagic], "locked.xlsx"));
      expect(result.isReadable).toBe(false);
      expect(result.extractedText).toBe("");
    });

    it("extracts every sheet of a multi-sheet workbook with separators", async () => {
      const file = buildSpreadsheetFileWithSheets([
        ["Claims", [["C-001", "High"]]],
        ["Supporting", [["S-002", "Low"]]],
      ]);
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("--- Sheet: Claims ---");
      expect(result.extractedText).toContain("C-001");
      expect(result.extractedText).toContain("--- Sheet: Supporting ---");
      expect(result.extractedText).toContain("S-002");
    });

    it("includes hidden sheet content (SheetNames iteration per plan)", async () => {
      const workbook = XLSX.utils.book_new();
      const visible = XLSX.utils.aoa_to_sheet([["visible row"]]);
      const hidden = XLSX.utils.aoa_to_sheet([["hidden row"]]);
      hidden["!hidden"] = true;
      XLSX.utils.book_append_sheet(workbook, visible, "Visible");
      XLSX.utils.book_append_sheet(workbook, hidden, "Hidden");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      const result = await extractArtifactContent(new File([buffer], "hidden.xlsx"));
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("visible row");
      expect(result.extractedText).toContain("hidden row");
    });

    it("truncates oversized workbook text at the cap with a marker", async () => {
      // Multiple 6k cells (Excel caps a single cell at 32767 chars) joining past the cap.
      const rows = Array.from({ length: 10 }, (_, i) => [`cell-${i}-${"x".repeat(6000)}`]);
      const file = buildSpreadsheetFileWithSheets([["Big", rows]]);
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.extractedText.length).toBeLessThanOrEqual(ARTIFACT_TEXT_CAP + 200);
      expect(result.extractedText).toContain("[CONTENT TRUNCATED]");
      expect(result.extractedText).toContain("Original length:");
      expect(result.extractedText).toContain("Returned length:");
      expect(result.truncation?.originalLength).toBeGreaterThan(ARTIFACT_TEXT_CAP);
      expect(result.truncation?.returnedLength).toBe(ARTIFACT_TEXT_CAP);
    });

    it("marks scanned/image-only pdfs as unreadable (empty pages must not count)", async () => {
      const file = buildPdfFileWithPages([""]);
      const result = await extractArtifactContent(file);
      expect(result.isReadable).toBe(false);
      expect(result.extractedText).toBe("");
      expect(result.extractedText).not.toContain("[Page");
    });

    it("falls back to windows-1252 when utf-8 decoding produces replacement chars", async () => {
      const latin1Bytes = new Uint8Array([
        0x52, 0x61, 0x70, 0x70, 0x6f, 0x72, 0x74, 0x20, 0x6f, 0x63, 0x63, 0x75, 0x72, 0x72, 0x65,
        0x64, 0x20, 0x61, 0x74, 0x20, 0x31, 0x30, 0x25, 0x20, 0xe9, 0x74, 0x61, 0x67, 0x65, 0x20,
        0x63, 0x6f, 0x72, 0x72, 0x69, 0x67, 0xe9,
      ]);
      const result = await extractArtifactContent(new File([latin1Bytes], "notes.txt"));
      expect(result.isReadable).toBe(true);
      expect(result.extractedText).toContain("étage corrigé");
      expect(result.extractedText).not.toContain("\uFFFD");
    });

    it("marks unsupported formats as unreadable", async () => {
      const result = await extractArtifactContent(new File(["not really a png"], "diagram.png"));
      expect(result.isReadable).toBe(false);
      expect(result.extractedText).toBe("");
    });

    it("marks corrupt files as unreadable instead of throwing", async () => {
      const corruptZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      const result = await extractArtifactContent(
        new File([corruptZip, "garbage-not-a-valid-zip"], "broken.xlsx"),
      );
      expect(result.isReadable).toBe(false);
      expect(result.extractedText).toBe("");
    });

    it("truncates extracted text at the cap with a marker", async () => {
      const long = "a".repeat(ARTIFACT_TEXT_CAP + 100);
      const result = await extractArtifactContent(new File([long], "long.txt"));
      expect(result.isReadable).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.extractedText.length).toBeLessThanOrEqual(ARTIFACT_TEXT_CAP + 200);
      expect(result.extractedText).toContain("[CONTENT TRUNCATED]");
      expect(result.truncation?.originalLength).toBe(ARTIFACT_TEXT_CAP + 100);
      expect(result.truncation?.returnedLength).toBe(ARTIFACT_TEXT_CAP);
    });
  });
});
