import { describe, expect, it } from "vitest";
import {
  assertFileSignature,
  checkZipExpansion,
  detectFileSignature,
} from "../artifact-file-guard";

function u16le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

/** Minimal zip: local file headers + central directory + EOCD. */
function buildZipBuffer(
  entries: Array<{ name: string; compressedSize: number; uncompressedSize: number }>,
) {
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
      0x00, // version needed
      0x00,
      0x00, // flags
      0x00,
      0x00, // method (stored)
      0x00,
      0x00,
      0x00,
      0x00, // mod time + date
      0x00,
      0x00,
      0x00,
      0x00, // crc32
      ...u32le(entry.compressedSize),
      ...u32le(entry.uncompressedSize),
      ...u16le(nameBytes.length),
      ...u16le(0), // extra len
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
      0x00, // version made by
      0x14,
      0x00, // version needed
      0x00,
      0x00, // flags
      0x00,
      0x00, // method (stored)
      0x00,
      0x00,
      0x00,
      0x00, // mod time + date
      0x00,
      0x00,
      0x00,
      0x00, // crc32
      ...u32le(entry.compressedSize),
      ...u32le(entry.uncompressedSize),
      ...u16le(nameBytes.length),
      0x00,
      0x00, // extra len
      0x00,
      0x00, // comment len
      0x00,
      0x00,
      0x00,
      0x00, // disk start
      0x00,
      0x00, // internal attrs
      0x00,
      0x00,
      0x00,
      0x00, // external attrs
      ...u32le(localOffsets[i] ?? 0),
      ...nameBytes,
    );
  });
  const dirSize = bytes.length - dirOffset;
  bytes.push(
    0x50,
    0x4b,
    0x05,
    0x06, // EOCD signature
    ...u16le(0), // disk number
    ...u16le(0), // disk with cd
    ...u16le(entries.length),
    ...u16le(entries.length),
    ...u32le(dirSize),
    ...u32le(dirOffset),
    ...u16le(0), // comment len
  );
  return new Uint8Array(bytes);
}

const textBytes = new TextEncoder().encode("hello world");
const zipBytes = buildZipBuffer([{ name: "sheet.xml", compressedSize: 10, uncompressedSize: 20 }]);
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const oleBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("detectFileSignature", () => {
  it("detects zip, pdf, ole and text signatures", () => {
    expect(detectFileSignature(bufferOf(zipBytes))).toBe("zip");
    expect(detectFileSignature(bufferOf(pdfBytes))).toBe("pdf");
    expect(detectFileSignature(bufferOf(oleBytes))).toBe("ole");
    expect(detectFileSignature(bufferOf(textBytes))).toBe("text");
  });

  it("treats empty buffers as empty", () => {
    expect(detectFileSignature(new ArrayBuffer(0))).toBe("empty");
  });

  it("treats binary-looking unknown content as unknown", () => {
    const binary = new Uint8Array(64);
    binary[0] = 0x4d;
    binary[1] = 0x5a;
    binary[10] = 0x00;
    expect(detectFileSignature(bufferOf(binary))).toBe("unknown");
  });
});

describe("assertFileSignature", () => {
  it("accepts content matching the extension", () => {
    expect(() => assertFileSignature("xlsx", bufferOf(zipBytes))).not.toThrow();
    expect(() => assertFileSignature("pdf", bufferOf(pdfBytes))).not.toThrow();
    expect(() => assertFileSignature("txt", bufferOf(textBytes))).not.toThrow();
    expect(() => assertFileSignature("md", bufferOf(textBytes))).not.toThrow();
    expect(() => assertFileSignature("csv", bufferOf(textBytes))).not.toThrow();
    expect(() => assertFileSignature("docx", bufferOf(zipBytes))).not.toThrow();
    expect(() => assertFileSignature("ppt", bufferOf(oleBytes))).not.toThrow();
  });

  it("rejects text bytes named as a zip-based extension", () => {
    expect(() => assertFileSignature("xlsx", bufferOf(textBytes))).toThrow(
      /(file type|file signature)/i,
    );
    expect(() => assertFileSignature("docx", bufferOf(textBytes))).toThrow(
      /(file type|file signature)/i,
    );
  });

  it("rejects pdf bytes named as xlsx", () => {
    expect(() => assertFileSignature("xlsx", bufferOf(pdfBytes))).toThrow(
      /(file type|file signature)/i,
    );
  });

  it("does not reject unknown or text extensions", () => {
    expect(() => assertFileSignature("xyz", bufferOf(zipBytes))).not.toThrow();
    expect(() => assertFileSignature("", bufferOf(textBytes))).not.toThrow();
  });

  it("rejects pdf bytes named as txt", () => {
    expect(() => assertFileSignature("txt", bufferOf(pdfBytes))).toThrow(
      /(file type|file signature)/i,
    );
  });

  it("rejects empty files for every extension", () => {
    for (const ext of ["xlsx", "pdf", "txt", "docx"]) {
      expect(() => assertFileSignature(ext, new ArrayBuffer(0))).toThrow(/empty/i);
    }
  });
});

describe("checkZipExpansion", () => {
  it("reports a normal archive as safe", () => {
    const result = checkZipExpansion(bufferOf(zipBytes));
    expect(result.safe).toBe(true);
    expect(result.totalUncompressed).toBe(20);
    expect(result.entryCount).toBe(1);
  });

  it("flags archives whose declared uncompressed size exceeds the cap", () => {
    const bomb = buildZipBuffer([
      { name: "data.bin", compressedSize: 100, uncompressedSize: 100_000_000 },
    ]);
    const result = checkZipExpansion(bufferOf(bomb));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("uncompressed");
  });

  it("flags archives with an extreme compression ratio", () => {
    const bomb = buildZipBuffer([
      { name: "data.bin", compressedSize: 10, uncompressedSize: 10_000 },
    ]);
    const result = checkZipExpansion(bufferOf(bomb));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("ratio");
  });

  it("flags archives with more entries than allowed", () => {
    const many = buildZipBuffer(
      Array.from({ length: 20 }, (_, i) => ({
        name: `f-${i}`,
        compressedSize: 1,
        uncompressedSize: 1,
      })),
    );
    const result = checkZipExpansion(bufferOf(many), {
      maxTotalUncompressedBytes: 25_000_000,
      maxEntryUncompressedBytes: 10_000_000,
      maxExpansionRatio: 50,
      maxEntries: 10,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("entries");
  });

  it("reports safe when the buffer is not a zip at all", () => {
    const result = checkZipExpansion(bufferOf(textBytes));
    expect(result.safe).toBe(true);
  });
});
