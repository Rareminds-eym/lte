import {
  ArtifactFileGuardError,
  assertFileSignature,
  assertValidArtifactFileName,
  checkZipExpansion,
} from "@functions/lib/artifact-evaluator";
import { apiLogger } from "@functions/shared/logger";

export class ArtifactSubmissionError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "ARTIFACT_SUBMISSION_ERROR",
  ) {
    super(message);
    this.name = "ArtifactSubmissionError";
  }
}

export function normalizeFileExtension(fileName: string): string {
  return (fileName.includes(".") ? (fileName.split(".").pop() ?? "") : "")
    ?.trim()
    .replace(/^\./, "")
    .toLowerCase();
}

interface FileQuestionConstraint {
  response_type: "text" | "file" | "url";
  allowed_file_types: string[] | null;
  max_file_size_mb: number | null;
}

export function validateFileForQuestion(file: File, question: FileQuestionConstraint): string {
  if (question.response_type !== "file") {
    throw new ArtifactSubmissionError(
      "This question does not accept file uploads.",
      400,
      "INVALID_RESPONSE_TYPE",
    );
  }

  // Phase 3: reject empty/overlong/control-character file names (incl. CR/LF
  // header injection) before anything is stored or rendered into headers.
  try {
    assertValidArtifactFileName(file.name);
  } catch (error) {
    if (error instanceof ArtifactFileGuardError) {
      throw new ArtifactSubmissionError(error.message, 400, error.code);
    }
    throw error;
  }

  const extension = normalizeFileExtension(file.name);
  const allowedTypes = question.allowed_file_types?.map((type) => type.toLowerCase()) ?? [];
  if (allowedTypes.length > 0 && !allowedTypes.includes(extension)) {
    throw new ArtifactSubmissionError(
      "This file type is not allowed for the artifact question.",
      400,
      "FILE_TYPE_NOT_ALLOWED",
    );
  }

  const maxBytes = (question.max_file_size_mb ?? 10) * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new ArtifactSubmissionError(
      "The selected file is larger than the allowed upload size.",
      400,
      "FILE_TOO_LARGE",
    );
  }

  return extension || "file";
}

/**
 * P1-2/P1-3: content-level validation - magic-byte signature check (rejects
 * renamed binaries) and zip-expansion check (rejects zip bombs). Runs before
 * any submission row or R2 object is created. The buffer is read exactly once
 * by the caller and shared with extraction (Phase 3 perf).
 */
export async function validateArtifactFileContent(
  buffer: ArrayBuffer,
  extension: string,
  fileName: string,
): Promise<void> {
  try {
    assertFileSignature(extension, buffer);
  } catch (error) {
    if (error instanceof ArtifactFileGuardError) {
      throw new ArtifactSubmissionError(error.message, 400, error.code);
    }
    throw error;
  }

  // 1. Zip expansion & Zip bomb protection for all zip-based Office / Archive files
  if (
    extension === "xlsx" ||
    extension === "xls" ||
    extension === "docx" ||
    extension === "pptx" ||
    extension === "zip"
  ) {
    const expansion = checkZipExpansion(buffer);
    if (!expansion.safe) {
      apiLogger.warn("Rejected artifact upload with abnormal archive expansion.", {
        extension,
        fileName,
        reason: expansion.reason,
      });
      throw new ArtifactSubmissionError(
        `The uploaded archive expands beyond a safe processing limit (${expansion.reason ?? "invalid archive"}).`,
        400,
        "ZIP_BOMB_DETECTED",
      );
    }
  }

  // 2. Pre-parse validation for PDF page limits (max 50 pages)
  if (extension === "pdf") {
    try {
      await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      const doc = await loadingTask.promise;
      const numPages = doc.numPages;
      await loadingTask.destroy();

      if (numPages > 50) {
        throw new ArtifactSubmissionError(
          `The uploaded PDF contains ${numPages} pages, exceeding the maximum allowed limit of 50 pages.`,
          400,
          "EXCEEDS_PAGE_LIMIT",
        );
      }
    } catch (err) {
      if (err instanceof ArtifactSubmissionError) throw err;
      // Corrupt/encrypted PDFs fail parsing; treat as unreadable (later
      // extraction marks them for human review) but never swallow silently.
      apiLogger.warn("PDF pre-parse failed; page limit check skipped.", {
        fileName,
        extension,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Pre-parse validation for PPTX slide limits (max 50 slides)
  if (extension === "pptx") {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const slideCount = Object.keys(zip.files).filter((name) =>
        /^ppt\/slides\/slide\d+\.xml$/i.test(name),
      ).length;
      if (slideCount > 50) {
        throw new ArtifactSubmissionError(
          `The uploaded presentation contains ${slideCount} slides, exceeding the maximum allowed limit of 50 slides.`,
          400,
          "EXCEEDS_SLIDE_LIMIT",
        );
      }
    } catch (err) {
      if (err instanceof ArtifactSubmissionError) throw err;
      apiLogger.warn("PPTX pre-parse failed; slide limit check skipped.", {
        fileName,
        extension,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 4. Pre-parse validation for XLSX sheet limits (max 20 sheets)
  if (extension === "xlsx" || extension === "xls") {
    try {
      const XLSX = await import("../../../../vendor/sheetjs/xlsx-0.20.3/xlsx.mjs");
      const workbook = XLSX.read(buffer, { type: "buffer", bookSheets: true });
      if (workbook.SheetNames && workbook.SheetNames.length > 20) {
        throw new ArtifactSubmissionError(
          `The uploaded workbook contains ${workbook.SheetNames.length} sheets, exceeding the maximum allowed limit of 20 sheets.`,
          400,
          "EXCEEDS_SHEET_LIMIT",
        );
      }
    } catch (err) {
      if (err instanceof ArtifactSubmissionError) throw err;
      apiLogger.warn("Workbook pre-parse failed; sheet limit check skipped.", {
        fileName,
        extension,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
