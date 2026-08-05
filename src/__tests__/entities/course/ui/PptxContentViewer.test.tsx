import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PptxContentViewer } from "@/entities/course/ui/PptxContentViewer";

const destroy = vi.fn();
let viewerCallbacks: {
  onSlideSize?: (size: { width: number; height: number }) => void;
  onSlideRendered?: () => void;
  onRenderComplete?: () => void;
  onError?: (error: unknown) => void;
} = {};

vi.mock("@file-viewer/pptx", () => ({
  PptxViewer: {
    open: vi.fn(
      async (_buffer: ArrayBuffer, target: HTMLElement, options: typeof viewerCallbacks) => {
        viewerCallbacks = options;
        target.innerHTML = `
        <div class="flyfish-pptx-scale-box">
          <div class="flyfish-pptx-content">
            <section class="slide" style="width: 960px; height: 540px;">One</section>
            <section class="slide" style="width: 960px; height: 540px;">Two</section>
          </div>
        </div>
      `;
        options.onSlideSize?.({ width: 960, height: 540 });
        options.onSlideRendered?.();
        options.onRenderComplete?.();
        return { destroy };
      },
    ),
  },
}));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

describe("PptxContentViewer", () => {
  beforeEach(() => {
    viewerCallbacks = {};
    destroy.mockClear();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a presentation and navigates between slides", async () => {
    render(<PptxContentViewer title="Pitch Deck" url="https://example.com/deck.pptx" />);

    expect(screen.getByText("Preparing presentation preview...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("1 / 2")).toBeInTheDocument());

    const nextButton = screen.getByLabelText("Next PPT slide");
    const previousButton = screen.getByLabelText("Previous PPT slide");

    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
    expect(nextButton).toBeDisabled();
    expect(previousButton).not.toBeDisabled();

    fireEvent.click(previousButton);
    await waitFor(() => expect(screen.getByText("1 / 2")).toBeInTheDocument());

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/courses/resources/preview?url=https%3A%2F%2Fexample.com%2Fdeck.pptx",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows an open-resource fallback when preview loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    );
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<PptxContentViewer title="Broken Deck" url="https://example.com/broken.pptx" />);

    await waitFor(() =>
      expect(
        screen.getByText(
          "This presentation is not available for preview right now. You can still open the resource in a new tab.",
        ),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Resource" }));
    expect(open).toHaveBeenCalledWith(
      "https://example.com/broken.pptx",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("ignores abort errors instead of showing the fallback panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    );

    render(<PptxContentViewer title="Aborted Deck" url="https://example.com/abort.pptx" />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Open Resource" })).not.toBeInTheDocument();
  });

  it("keeps the loading panel when the viewer reports an abort error", async () => {
    render(<PptxContentViewer title="Callback Deck" url="https://example.com/callback.pptx" />);

    await waitFor(() => expect(screen.getByText("1 / 2")).toBeInTheDocument());

    viewerCallbacks.onError?.(new DOMException("aborted", "AbortError"));

    expect(
      screen.queryByText("This presentation is not available for preview right now."),
    ).not.toBeInTheDocument();
  });
});
