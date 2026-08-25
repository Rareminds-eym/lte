import { createQueryGateway, createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../files/[fileId]/download";

vi.mock("@functions/lib/query-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/query-gateway")>();
  return { ...actual, createServiceQueryGateway: vi.fn() };
});

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_KEY = "submissions/artifacts/users/user-1/artifact-1/submission-1/file-1-answer.xlsx";

const fileRow = {
  id: "file-1",
  submission_id: "submission-1",
  question_id: "22222222-2222-4222-8222-222222222222",
  file_name: "answer.xlsx",
  file_url: null,
  object_key: OBJECT_KEY,
  file_type: "xlsx",
  file_size_bytes: 12,
};

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

function fileChain(result: { data: unknown; error: unknown }): MockChain {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain as MockChain;
}

function gatewayFromChain(chain: MockChain) {
  return createQueryGateway({
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient);
}

function createContext(
  fileId: string,
  env: LteEnv,
  user: { sub: string } | null = { sub: "user-1" },
): PagesContext<LteEnv> {
  return {
    request: new Request(`http://localhost/api/v1/artifacts/files/${fileId}/download`),
    env,
    params: { fileId },
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next: vi.fn(),
    data: user ? { user } : {},
  };
}

function createEnv(get: ReturnType<typeof vi.fn>): LteEnv {
  return { STORAGE_BUCKET: { get } } as unknown as LteEnv;
}

describe("GET /api/v1/artifacts/files/[fileId]/download", () => {
  const ok = (data: unknown) => ({ data, error: null });
  const notFound = { data: null, error: { message: "not found" } };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not on the context", async () => {
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(fileChain(ok(null))));

    const response = await onRequestGet(createContext(FILE_ID, createEnv(vi.fn()), null));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for an invalid file id", async () => {
    const createGateway = vi.mocked(createServiceQueryGateway);
    const response = await onRequestGet(createContext("not-a-uuid", createEnv(vi.fn())));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createGateway).not.toHaveBeenCalled();
  });

  it("streams the owned R2 object as an attachment", async () => {
    const get = vi.fn().mockResolvedValue({
      body: "xlsx-content",
      size: 12,
      httpMetadata: {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(fileChain(ok(fileRow))));

    const response = await onRequestGet(createContext(FILE_ID, createEnv(get)));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("xlsx-content");
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="answer.xlsx"');
    expect(response.headers.get("Content-Length")).toBe("12");
    expect(get).toHaveBeenCalledWith(OBJECT_KEY);
    expect(createServiceQueryGateway).toHaveBeenCalled();
  });

  it("returns 404 when the learner does not own the file", async () => {
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(fileChain(notFound)));

    const response = await onRequestGet(createContext(FILE_ID, createEnv(vi.fn())));
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FILE_NOT_FOUND");
  });

  it("returns 404 when the R2 object is missing", async () => {
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(fileChain(ok(fileRow))));

    const response = await onRequestGet(
      createContext(FILE_ID, createEnv(vi.fn().mockResolvedValue(null))),
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FILE_NOT_AVAILABLE");
  });

  it("returns 500 when fetching the R2 object fails", async () => {
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(fileChain(ok(fileRow))));

    const response = await onRequestGet(
      createContext(FILE_ID, createEnv(vi.fn().mockRejectedValue(new Error("r2 down")))),
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
