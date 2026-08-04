import { describe, expect, it, vi } from "vitest";
import type { EContentItem } from "@/entities/course/model/levelContentTypes";
import {
  fetchResourceBuffer,
  getOfficeEmbedUrl,
  getResourceFileKind,
  getResourcePreviewUrl,
} from "@/entities/course/ui/ResourceContentViewer/types";

function item(overrides: Partial<EContentItem>): EContentItem {
  return {
    id: "1",
    contentType: "doc",
    title: "t",
    description: "",
    url: "https://example.com/file.mp4",
    sortOrder: 1,
    durationSeconds: 10,
    xpReward: 10,
    mimeType: "",
    fileSizeBytes: 0,
    status: "published",
    ...overrides,
  };
}

describe("getResourcePreviewUrl", () => {
  it("encodes the url", () => {
    expect(getResourcePreviewUrl("https://a.b/x y.pdf")).toBe(
      "/api/v1/courses/resources/preview?url=https%3A%2F%2Fa.b%2Fx%20y.pdf",
    );
  });
});

describe("getOfficeEmbedUrl", () => {
  it("encodes the url", () => {
    expect(getOfficeEmbedUrl("https://a.b/x.pptx")).toBe(
      "https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fa.b%2Fx.pptx",
    );
  });
});

describe("fetchResourceBuffer", () => {
  it("fetches the preview when it responds ok", async () => {
    const arrayBuffer = new ArrayBuffer(4);
    const previewFetch = vi.fn().mockResolvedValue(new Response(arrayBuffer, { status: 200 }));
    vi.stubGlobal("fetch", previewFetch);

    const buf1 = await fetchResourceBuffer("https://a.b/f.pdf");
    expect(buf1.byteLength).toBe(4);
    expect(previewFetch).toHaveBeenCalledWith(
      "/api/v1/courses/resources/preview?url=https%3A%2F%2Fa.b%2Ff.pdf",
      { signal: undefined },
    );
    vi.unstubAllGlobals();
  });

  it("falls back to the direct url when the preview fails", async () => {
    const arrayBuffer = new ArrayBuffer(4);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(arrayBuffer, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const buf1 = await fetchResourceBuffer("https://a.b/f.pdf");
    expect(buf1.byteLength).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith("https://a.b/f.pdf", { signal: undefined });
    vi.unstubAllGlobals();
  });

  it("throws when the direct fetch fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchResourceBuffer("https://a.b/f.pdf")).rejects.toThrow(
      "Resource file could not be loaded.",
    );
    vi.unstubAllGlobals();
  });

  it("passes the abort signal through", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ArrayBuffer(1), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchResourceBuffer("https://a.b/f.pdf", signal);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { signal });
    vi.unstubAllGlobals();
  });
});

describe("getResourceFileKind", () => {
  it("detects video by content type", () => {
    expect(getResourceFileKind(item({ contentType: "video" }))).toBe("video");
  });

  it("detects video by mime type", () => {
    expect(getResourceFileKind(item({ contentType: "doc", mimeType: "video/mp4" }))).toBe("video");
  });

  it("detects audio by content type", () => {
    expect(getResourceFileKind(item({ contentType: "audio" }))).toBe("audio");
  });

  it("detects audio by mime type", () => {
    expect(getResourceFileKind(item({ contentType: "doc", mimeType: "audio/mpeg" }))).toBe("audio");
  });

  it("detects image by content type", () => {
    expect(getResourceFileKind(item({ contentType: "image" }))).toBe("image");
  });

  it("detects image by mime type", () => {
    expect(getResourceFileKind(item({ contentType: "doc", mimeType: "image/png" }))).toBe("image");
  });

  it("detects link content", () => {
    expect(getResourceFileKind(item({ contentType: "link" }))).toBe("link");
  });

  it("detects text content", () => {
    expect(getResourceFileKind(item({ contentType: "text" }))).toBe("text");
  });

  it("detects pptx by extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/deck.pptx" }))).toBe("pptx");
  });

  it("detects pptx by old extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/deck.ppt" }))).toBe("pptx");
  });

  it("detects pptx by slide content type", () => {
    expect(getResourceFileKind(item({ contentType: "slide" }))).toBe("pptx");
  });

  it("detects pdf by extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/doc.pdf" }))).toBe("pdf");
  });

  it("detects pdf by mime type", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/doc", mimeType: "application/pdf" }))).toBe(
      "pdf",
    );
  });

  it("detects pdf by content type", () => {
    expect(getResourceFileKind(item({ contentType: "pdf" }))).toBe("pdf");
  });

  it("detects docx by extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/doc.docx" }))).toBe("docx");
  });

  it("detects docx by old extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/doc.doc" }))).toBe("docx");
  });

  it("detects docx by wordprocessing mime", () => {
    expect(
      getResourceFileKind(
        item({
          url: "https://a.b/doc",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ),
    ).toBe("docx");
  });

  it("detects docx by msword mime", () => {
    expect(
      getResourceFileKind(item({ url: "https://a.b/doc", mimeType: "application/msword" })),
    ).toBe("docx");
  });

  it("detects xlsx by extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/sheet.xlsx" }))).toBe("xlsx");
  });

  it("detects xlsx by old extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/sheet.xls" }))).toBe("xlsx");
  });

  it("detects csv extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/sheet.csv" }))).toBe("xlsx");
  });

  it("detects xlsx by spreadsheetml mime", () => {
    expect(
      getResourceFileKind(
        item({
          url: "https://a.b/sheet",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ),
    ).toBe("xlsx");
  });

  it("detects xlsx by ms-excel mime", () => {
    expect(
      getResourceFileKind(item({ url: "https://a.b/sheet", mimeType: "application/vnd.ms-excel" })),
    ).toBe("xlsx");
  });

  it("handles urls with query strings and fragments", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/deck.pptx?v=1#top" }))).toBe("pptx");
  });

  it("handles uppercase extensions", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/doc.PDF" }))).toBe("pdf");
  });

  it("returns unsupported for unknown files", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/blob.xyz" }))).toBe("unsupported");
  });

  it("returns unsupported when the url has no extension", () => {
    expect(getResourceFileKind(item({ url: "https://a.b/download" }))).toBe("unsupported");
  });
});
