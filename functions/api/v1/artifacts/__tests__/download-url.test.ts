import { createQueryGateway, createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../files/[fileId]/download-url";

vi.mock("@functions/lib/query-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/query-gateway")>();
  return { ...actual, createServiceQueryGateway: vi.fn() };
});

const FILE_ID = "11111111-1111-4111-8111-111111111111";

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
  user: { sub: string } | null = { sub: "user-1" },
): PagesContext<LteEnv> {
  return {
    request: new Request(`http://localhost/api/v1/artifacts/files/${fileId}/download-url`),
    env: {} as LteEnv,
    params: { fileId },
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next: vi.fn(),
    data: user ? { user } : {},
  };
}

describe("GET /api/v1/artifacts/files/[fileId]/download-url", () => {
  const ok = (data: unknown) => ({ data, error: null });
  const notFound = { data: null, error: { message: "not found" } };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not on the context", async () => {
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(fileChain(ok(null))));

    const response = await onRequestGet(createContext(FILE_ID, null));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for an invalid file id", async () => {
    const createGateway = vi.mocked(createServiceQueryGateway);

    const response = await onRequestGet(createContext("not-a-uuid"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createGateway).not.toHaveBeenCalled();
  });

  it("returns the download url after verifying ownership", async () => {
    const chain = fileChain(ok({ id: "file-1" }));
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(chain));

    const response = await onRequestGet(createContext(FILE_ID));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; download_url: string };
    expect(body.success).toBe(true);
    expect(body.download_url).toBe(`http://localhost/api/v1/artifacts/files/${FILE_ID}/download`);
    expect(chain.eq).toHaveBeenCalledWith("artifact_submissions.user_id", "user-1");
  });

  it("returns 404 when the learner does not own the file", async () => {
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(fileChain(notFound)));

    const response = await onRequestGet(createContext(FILE_ID));
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FILE_NOT_FOUND");
  });

  it("returns 500 when the ownership check fails unexpectedly", async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn().mockRejectedValue(new Error("db down")),
    };
    vi.mocked(createServiceQueryGateway).mockReturnValue(gatewayFromChain(chain));

    const response = await onRequestGet(createContext(FILE_ID));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
