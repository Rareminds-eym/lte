import { File as NodeFile } from "node:buffer";
import { ARTIFACT_LIMITS } from "@functions/lib/artifact-evaluator";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactSubmissionError } from "../queries";
import { onRequestPost } from "../submit";

const { submitArtifactSubmissionMock } = vi.hoisted(() => ({
  submitArtifactSubmissionMock: vi.fn(),
}));

vi.mock("../queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../queries")>();
  return { ...actual, submitArtifactSubmission: submitArtifactSubmissionMock };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

// jsdom FormData only preserves values that are jsdom Blobs, so files must be
// created with the original jsdom File constructor; the endpoint's
// `value instanceof File` guard needs the undici File that request.formData()
// yields, so the module-scope `File` global is stubbed to node:buffer's File.
const JsdomFile = globalThis.File;

const validPayload = {
  artifact_id: UUID_A,
  answers: [{ question_id: UUID_B, text_response: "All done." }],
};

const mockResult = {
  submission_id: "submission-1",
  attempt_no: 1,
  version_label: "v1",
  submitted_at: "2026-08-05T10:00:00.000Z",
  status: "accepted",
  evaluation_status: "completed",
  duplicate: false,
  evaluation: {
    overall_score: 90,
    confidence: 0.95,
    decision: "pass",
    rubric_rows: [],
    feedback: "Good work.",
    improvements: "None.",
    calculated_xp: 80,
  },
  files: [{ file_id: "file-1", question_id: UUID_B, file_name: "answer.txt" }],
};

let userSeq = 0;
function nextUser(): { sub: string } {
  userSeq += 1;
  return { sub: `user-${userSeq}` };
}

function createContext(
  request: Request,
  user: { sub: string } | null = nextUser(),
): PagesContext<LteEnv> {
  return {
    request,
    env: {} as LteEnv,
    params: {},
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next: vi.fn(),
    data: user ? { user } : {},
  };
}

// jsdom's multipart serializer strips filenames and file sizes, so bodies
// that must round-trip real File parts are built manually with a boundary.
const BOUNDARY = "----vitest-multipart-boundary";

function multipartRequest(
  payload: unknown,
  files?: Array<[questionId: string, fileName: string, content: string]>,
  headers?: HeadersInit,
) {
  const parts: string[] = [
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(payload)}`,
  ];
  for (const [questionId, fileName, content] of files ?? []) {
    parts.push(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file:${questionId}"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n${content}`,
    );
  }
  const body = `${parts.join("\r\n")}\r\n--${BOUNDARY}--\r\n`;
  return new Request("http://localhost/api/v1/artifacts/submit", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${BOUNDARY}`, ...headers },
    body,
  });
}

describe("POST /api/v1/artifacts/submit", () => {
  const mockSupabase = { from: vi.fn() } as unknown as SupabaseClient;

  beforeAll(() => {
    vi.stubGlobal("File", NodeFile);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(createServiceSupabase).mockReturnValue(mockSupabase);
  });

  it("returns 401 when the user is not on the context", async () => {
    const response = await onRequestPost(createContext(multipartRequest(validPayload), null));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 429 when the user exceeds the submission rate limit", async () => {
    submitArtifactSubmissionMock.mockResolvedValue(mockResult);
    const request = () =>
      new Request("http://localhost/api/v1/artifacts/submit", { method: "POST" });

    const responses = [];
    for (let i = 0; i < ARTIFACT_LIMITS.rateLimitMax + 1; i += 1) {
      responses.push(await onRequestPost(createContext(request(), { sub: "rate-limit-user" })));
    }

    const rejected = responses[responses.length - 1] as (typeof responses)[number];
    expect(rejected.status).toBe(429);
    const body = (await rejected.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(rejected.headers.get("Retry-After")).not.toBeNull();
  });

  it("rejects a body with Content-Length above maxRequestBytes", async () => {
    const request = new Request("http://localhost/api/v1/artifacts/submit", {
      method: "POST",
      headers: { "Content-Length": String(ARTIFACT_LIMITS.maxRequestBytes + 1) },
    });

    const response = await onRequestPost(createContext(request));
    expect(response.status).toBe(413);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects a chunked body (no Content-Length) above maxRequestBytes", async () => {
    const oversized = new Uint8Array(ARTIFACT_LIMITS.maxRequestBytes + 1);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversized);
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/v1/artifacts/submit", {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: { "Content-Type": "application/json" },
    } as RequestInit);

    const response = await onRequestPost(createContext(request));
    expect(response.status).toBe(413);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects more than maxFilesPerSubmission files", async () => {
    const files = Array.from({ length: ARTIFACT_LIMITS.maxFilesPerSubmission + 1 }, (_, i) => [
      `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`,
      `file-${i}.txt`,
      "a",
    ]) as Array<[string, string, string]>;

    const response = await onRequestPost(createContext(multipartRequest(validPayload, files)));
    expect(response.status).toBe(413);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects files whose cumulative size exceeds maxRequestBytes", async () => {
    const oversized = [UUID_B, "big.txt", "a".repeat(ARTIFACT_LIMITS.maxRequestBytes + 1)] as [
      string,
      string,
      string,
    ];

    const response = await onRequestPost(
      createContext(multipartRequest(validPayload, [oversized])),
    );
    expect(response.status).toBe(413);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns 400 when a multipart body has no payload field", async () => {
    const formData = new FormData();
    formData.set("file:question-1", new JsdomFile(["a"], "answer.txt"));
    const request = new Request("http://localhost/api/v1/artifacts/submit", {
      method: "POST",
      body: formData,
    });

    const response = await onRequestPost(createContext(request));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PAYLOAD_REQUIRED");
  });

  it("returns 400 when the payload is not valid JSON", async () => {
    const formData = new FormData();
    formData.set("payload", "not-json");
    const request = new Request("http://localhost/api/v1/artifacts/submit", {
      method: "POST",
      body: formData,
    });

    const response = await onRequestPost(createContext(request));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("returns 400 when the payload fails schema validation", async () => {
    const response = await onRequestPost(
      createContext(multipartRequest({ artifact_id: "not-a-uuid", answers: [] })),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when the Idempotency-Key header is longer than 128 chars", async () => {
    const response = await onRequestPost(
      createContext(
        multipartRequest(validPayload, undefined, { "Idempotency-Key": "x".repeat(129) }),
      ),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(submitArtifactSubmissionMock).not.toHaveBeenCalled();
  });

  it("submits a valid multipart submission with files and idempotency key", async () => {
    submitArtifactSubmissionMock.mockResolvedValue(mockResult);
    const user = nextUser();

    const response = await onRequestPost(
      createContext(
        multipartRequest(validPayload, [[UUID_B, "answer.txt", "answer content"]], {
          "Idempotency-Key": "idem-key-1",
        }),
        user,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; submission_id: string };
    expect(body.success).toBe(true);
    expect(body.submission_id).toBe("submission-1");

    expect(createServiceSupabase).toHaveBeenCalled();
    expect(submitArtifactSubmissionMock).toHaveBeenCalledTimes(1);
    const [supabase, , userId, payload, files, idempotencyKey] = submitArtifactSubmissionMock.mock
      .calls[0] as unknown[];
    expect(supabase).toBe(mockSupabase);
    expect(userId).toBe(user.sub);
    expect(payload).toEqual(validPayload);
    expect(files).toBeInstanceOf(Map);
    const receivedFile = (files as Map<string, File>).get(UUID_B);
    expect(receivedFile?.name).toBe("answer.txt");
    expect(await receivedFile?.text()).toBe("answer content");
    expect(idempotencyKey).toBe("idem-key-1");
  });

  it("submits a JSON body without files", async () => {
    submitArtifactSubmissionMock.mockResolvedValue(mockResult);
    const request = new Request("http://localhost/api/v1/artifacts/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await onRequestPost(createContext(request));
    expect(response.status).toBe(200);

    const [, , , , files, idempotencyKey] = submitArtifactSubmissionMock.mock.calls[0] as [
      unknown,
      unknown,
      unknown,
      unknown,
      Map<string, File>,
      unknown,
    ];
    expect(files.size).toBe(0);
    expect(idempotencyKey).toBeUndefined();
  });

  it("returns the original submission response for a duplicate idempotency key", async () => {
    submitArtifactSubmissionMock.mockResolvedValue({ ...mockResult, duplicate: true });
    const response = await onRequestPost(
      createContext(multipartRequest(validPayload, undefined, { "Idempotency-Key": "idem-key-1" })),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; duplicate: boolean };
    expect(body.success).toBe(true);
    expect(body.duplicate).toBe(true);
  });

  it("maps ArtifactSubmissionError from the query layer to its status and code", async () => {
    submitArtifactSubmissionMock.mockRejectedValue(
      new ArtifactSubmissionError(
        "This artifact has already been accepted and cannot be resubmitted.",
        409,
        "SUBMISSION_ALREADY_ACCEPTED",
      ),
    );

    const response = await onRequestPost(createContext(multipartRequest(validPayload)));
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SUBMISSION_ALREADY_ACCEPTED");
  });

  it("returns 500 on an unexpected query error", async () => {
    submitArtifactSubmissionMock.mockRejectedValue(new Error("boom"));

    const response = await onRequestPost(createContext(multipartRequest(validPayload)));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
