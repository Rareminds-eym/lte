import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadArtifactFile } from "@/features/submit-artifact";
import { apiFetchBlob } from "@/shared/api";

vi.mock("@/shared/api", () => ({
  authClient: {
    request: vi.fn(),
    subscribe: vi.fn(),
    initialize: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
  },
  apiFetchBlob: vi.fn().mockResolvedValue(new Blob(["artifact"])),
}));

describe("downloadArtifactFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads artifact files through the protected API endpoint", async () => {
    const blob = await downloadArtifactFile("/api/v1/artifacts/files/file-1/download");

    expect(apiFetchBlob).toHaveBeenCalledWith("/api/v1/artifacts/files/file-1/download", {
      method: "GET",
    });
    expect(await blob.text()).toBe("artifact");
  });
});
