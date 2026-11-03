import { render, waitFor } from "@testing-library/react";
import { renderAsync } from "docx-preview";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EContentItem } from "@/entities/course/model/levelContentTypes";
import { DocxContentViewer } from "@/entities/course/ui/resource-content-viewer/DocxContentViewer";

vi.mock("docx-preview", () => ({ renderAsync: vi.fn(async () => {}) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("DOCX catalog assets", () => {
  it("loads and renders a persisted relative asset directly", async () => {
    const url = "/api/admin/lte/assets?key=resources%2Fdocument.docx";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
    );
    render(<DocxContentViewer item={{ id: "document", url, title: "Document" } as EContentItem} />);
    await waitFor(() => expect(renderAsync).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
