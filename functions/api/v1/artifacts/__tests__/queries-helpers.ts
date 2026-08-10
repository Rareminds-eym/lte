import type { LteEnv } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import * as XLSX from "xlsx/xlsx.mjs";

export interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

export const ok = (data: unknown): QueryResult => ({ data, error: null });
export const err = (message: string): QueryResult => ({ data: null, error: { message } });

export function mockChain(
  options: { single?: QueryResult; maybeSingle?: QueryResult; thenVal?: QueryResult } = {},
) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve(ok(null))),
    upsert: vi.fn(() => Promise.resolve(ok(null))),
    maybeSingle: vi.fn().mockResolvedValue(options.maybeSingle ?? ok(null)),
    single: vi.fn().mockResolvedValue(options.single ?? ok(null)),
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    then: vi.fn((resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(options.thenVal ?? ok(null)).then(resolve),
    ),
  };
  return chain as MockChain;
}

export function createSupabase(chains: Record<string, MockChain>): SupabaseClient {
  return {
    from: vi.fn((table: string) => chains[table] ?? mockChain()),
  } as unknown as SupabaseClient;
}

export function createEnv(overrides: Partial<LteEnv["STORAGE_BUCKET"]> = {}) {
  return {
    R2_PUBLIC_DOMAIN: "https://bucket.lte.rareminds.in",
    STORAGE_BUCKET: {
      put: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  } satisfies Pick<LteEnv, "STORAGE_BUCKET" | "R2_PUBLIC_DOMAIN">;
}

export function createTestFile(
  parts: BlobPart[],
  fileName: string,
  options?: FilePropertyBag,
): File {
  const file = new File(parts, fileName, options);
  return Object.assign(file, {
    stream: () => new ReadableStream(),
  });
}

/** Real xlsx bytes so content-signature validation accepts the fixture. */
export const xlsxBuffer = (() => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["a", "b"]]), "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
})();

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function u16le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

export function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

/** Minimal zip (local headers + central directory + EOCD) with declared sizes. */
export function buildZipBuffer(
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
    ...u16le(0),
    ...u16le(0),
    ...u16le(entries.length),
    ...u16le(entries.length),
    ...u32le(dirSize),
    ...u32le(dirOffset),
    ...u16le(0),
  );
  return new Uint8Array(bytes);
}

export function createSubmitChains(
  options: {
    questions?: QueryResult;
    fileInsert?: QueryResult;
    answerUpsert?: QueryResult;
    latest?: QueryResult;
    insertSingle?: QueryResult;
  } = {},
) {
  const submission = {
    id: "submission-1",
    artifact_id: "artifact-1",
    user_id: "user-1",
    user_module_progress_id: "progress-1",
    attempt_no: 1,
    version_label: "v1",
    is_latest: true,
    status: "submitted",
    previous_submission_id: null,
    submitted_at: "2026-08-05T10:00:00.000Z",
  };

  const submissionsInsert = mockChain({ single: options.insertSingle ?? ok(submission) });
  const submissions = mockChain({ maybeSingle: options.latest ?? ok(null) });
  submissions.insert = vi.fn(() => submissionsInsert);

  const answers = mockChain();
  answers.upsert = vi.fn(() => Promise.resolve(options.answerUpsert ?? ok(null)));

  const files = mockChain();
  files.insert = vi.fn(() => Promise.resolve(options.fileInsert ?? ok(null)));

  return {
    module_artifacts: mockChain({
      single: ok({ id: "artifact-1", modules_content_id: "content-1" }),
    }),
    modules_content: mockChain({
      single: ok({ id: "content-1", module_id: "module-1" }),
    }),
    user_module_progress: mockChain({
      maybeSingle: ok({ id: "progress-1" }),
    }),
    artifact_questions: mockChain({
      thenVal:
        options.questions ??
        ok([
          {
            id: "question-1",
            artifact_id: "artifact-1",
            response_type: "file",
            allowed_file_types: ["xlsx"],
            max_file_size_mb: 10,
            response_required: true,
          },
        ]),
    }),
    artifact_submissions: submissions,
    artifact_submission_answers: answers,
    artifact_submission_files: files,
    artifact_evaluation_flows: mockChain(),
  };
}
