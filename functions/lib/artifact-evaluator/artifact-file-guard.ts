/**
 * Magic-byte signature validation and zip-expansion (zip bomb) protection for
 * artifact uploads. Extension-only validation was exploitable by renamed
 * binaries; spreadsheet parsing buffered arbitrary archives in memory.
 */

export type FileSignatureFamily =
  | "zip"
  | "ole"
  | "pdf"
  | "text"
  | "png"
  | "jpeg"
  | "gif"
  | "bmp"
  | "webp"
  | "empty"
  | "unknown";

/**
 * Which content signature families each extension may legitimately carry.
 * Extensions not listed keep the historical extension-only behavior.
 */
export const FILE_SIGNATURE_REQUIREMENTS: Record<string, FileSignatureFamily[]> = {
  xlsx: ["zip"],
  docx: ["zip"],
  xls: ["ole", "zip"],
  pdf: ["pdf"],
  csv: ["text"],
  txt: ["text"],
  text: ["text"],
  md: ["text"],
  json: ["text"],
  log: ["text"],
  png: ["png"],
  jpg: ["jpeg"],
  jpeg: ["jpeg"],
  gif: ["gif"],
  bmp: ["bmp"],
  webp: ["webp"],
  zip: ["zip"],
};

export class ArtifactFileGuardError extends Error {
  constructor(
    message: string,
    public readonly code = "INVALID_FILE_SIGNATURE",
  ) {
    super(message);
    this.name = "ArtifactFileGuardError";
  }
}

export function detectFileSignature(buffer: ArrayBuffer): FileSignatureFamily {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return "empty";
  const head = bytes.subarray(0, 16);

  // zip: PK\x03\x04 (archive), PK\x05\x06 (empty), PK\x07\x08 (spanned)
  if (head[0] === 0x50 && head[1] === 0x4b) {
    if (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07) return "zip";
  }
  // OLE2 compound document (legacy .xls)
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return "ole";
  // PDF
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "pdf";
  // PNG
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "png";
  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  // GIF
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return "gif";
  // BMP
  if (head[0] === 0x42 && head[1] === 0x4d) return "bmp";
  // WebP (RIFF....WEBP)
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "webp";
  }

  // No known binary signature: reject strongly binary content (null bytes)
  // so renamed executables with text extensions are caught; otherwise treat
  // as text.
  const sample = bytes.subarray(0, Math.min(512, bytes.length));
  for (const byte of sample) {
    if (byte === 0x00) return "unknown";
  }
  return "text";
}

/**
 * Throws ArtifactFileGuardError when the detected content signature is not
 * allowed for the given extension. Unknown extensions pass through.
 */
export function assertFileSignature(extension: string, buffer: ArrayBuffer): void {
  const allowed = FILE_SIGNATURE_REQUIREMENTS[extension];
  if (!allowed) return;

  const detected = detectFileSignature(buffer);
  if (detected === "empty") {
    throw new ArtifactFileGuardError("The selected file is empty.", "FILE_EMPTY");
  }
  if (!allowed.includes(detected)) {
    throw new ArtifactFileGuardError(
      `The file content does not match the "${extension}" file type.`,
      "INVALID_FILE_SIGNATURE",
    );
  }
}

/** Control characters that must never reach a Content-Disposition header. */
const FILENAME_CONTROL_CHARS = /[\p{Cc}]/gu;

/**
 * Sanitizes a user-supplied file name for use inside a Content-Disposition
 * header value: strips control characters (CR/LF header injection), quotes,
 * and caps the length. Applied at both upload and download time.
 */
export function sanitizeContentDispositionFilename(name: string): string {
  return name.replace(FILENAME_CONTROL_CHARS, "").replace(/"/g, "").slice(0, 255);
}

/**
 * Rejects file names that are empty, too long, or carry control characters.
 * Throws ArtifactFileGuardError; callers convert to their error type.
 */
export function assertValidArtifactFileName(name: string): void {
  if (name.length === 0 || name.length > 255) {
    throw new ArtifactFileGuardError("The file name is empty or too long.", "INVALID_FILE_NAME");
  }
  if (name.search(FILENAME_CONTROL_CHARS) !== -1) {
    throw new ArtifactFileGuardError(
      "The file name contains invalid characters.",
      "INVALID_FILE_NAME",
    );
  }
}

export const ZIP_EXPANSION_LIMITS = {
  /** Total uncompressed payload cap across all entries. */
  maxTotalUncompressedBytes: 25 * 1024 * 1024,
  /** Per-entry uncompressed cap. */
  maxEntryUncompressedBytes: 10 * 1024 * 1024,
  /** Uncompressed/compressed ratio cap. */
  maxExpansionRatio: 50,
  /** Entry count cap. */
  maxEntries: 10_000,
};

export interface ZipExpansionResult {
  safe: boolean;
  totalUncompressed: number;
  entryCount: number;
  reason: string | null;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function findEocd(bytes: Uint8Array): number {
  const searchStart = Math.max(0, bytes.length - 65_557);
  for (let i = bytes.length - 4; i >= searchStart; i -= 1) {
    if (
      (bytes[i] ?? 0) === 0x50 &&
      (bytes[i + 1] ?? 0) === 0x4b &&
      (bytes[i + 2] ?? 0) === 0x05 &&
      (bytes[i + 3] ?? 0) === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Scans the zip central directory and sums the real uncompressed entry sizes
 * without extracting anything. Archives whose expansion is abnormal are
 * flagged unsafe. Archives that are not valid zips (no EOCD) report safe so
 * the existing corrupt-file → human_review path is preserved.
 */
export function checkZipExpansion(
  buffer: ArrayBuffer,
  limits: typeof ZIP_EXPANSION_LIMITS = ZIP_EXPANSION_LIMITS,
): ZipExpansionResult {
  const bytes = new Uint8Array(buffer);
  const eocd = findEocd(bytes);
  if (eocd < 0 || eocd + 22 > bytes.length) {
    return { safe: true, totalUncompressed: 0, entryCount: 0, reason: null };
  }

  const declaredEntries = readU16(bytes, eocd + 10);
  const dirOffset = readU32(bytes, eocd + 16);
  if (dirOffset >= bytes.length) {
    return { safe: true, totalUncompressed: 0, entryCount: 0, reason: null };
  }

  let offset = dirOffset;
  let totalUncompressed = 0;
  let totalCompressed = 0;
  let maxEntry = 0;
  let scanned = 0;
  while (scanned < declaredEntries && scanned <= limits.maxEntries) {
    if (offset + 46 > bytes.length || readU32(bytes, offset) !== 0x02014b50) break;
    const compressedSize = readU32(bytes, offset + 20);
    const uncompressedSize = readU32(bytes, offset + 24);
    const nameLen = readU16(bytes, offset + 28);
    const extraLen = readU16(bytes, offset + 30);
    const commentLen = readU16(bytes, offset + 32);
    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    maxEntry = Math.max(maxEntry, uncompressedSize);
    scanned += 1;
    offset += 46 + nameLen + extraLen + commentLen;
  }

  const reasons: string[] = [];
  if (declaredEntries > limits.maxEntries) {
    reasons.push(`archive declares ${declaredEntries} entries`);
  }
  if (scanned > limits.maxEntries) {
    reasons.push(`archive contains more than ${limits.maxEntries} entries`);
  }
  if (totalUncompressed > limits.maxTotalUncompressedBytes) {
    reasons.push(
      `total uncompressed size ${totalUncompressed} exceeds ${limits.maxTotalUncompressedBytes} bytes`,
    );
  }
  if (maxEntry > limits.maxEntryUncompressedBytes) {
    reasons.push(
      `entry uncompressed size ${maxEntry} exceeds ${limits.maxEntryUncompressedBytes} bytes`,
    );
  }
  if (totalCompressed > 0 && totalUncompressed / totalCompressed > limits.maxExpansionRatio) {
    reasons.push(`expansion ratio exceeds ${limits.maxExpansionRatio}:1`);
  }

  return {
    safe: reasons.length === 0,
    totalUncompressed,
    entryCount: scanned,
    reason: reasons.length > 0 ? reasons.join("; ") : null,
  };
}
