import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { getLogger } from "@/shared/config/logging";
import { Button, ChevronLeftIcon, ChevronRightIcon } from "@/shared/ui";
import { ResourceViewerState } from "./ResourceViewerState";
import { fetchResourceBuffer, type ResourceRendererProps } from "./types";

const logger = getLogger("course-pdf-viewer");

export const PdfContentViewer: React.FC<ResourceRendererProps> = ({ item }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "native" | "error">("loading");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();
    let isActive = true;

    const loadPdf = async () => {
      setStatus("loading");
      setPageNumber(1);
      setPageCount(0);
      documentRef.current = null;

      try {
        const buffer = await fetchResourceBuffer(item.url, abortController.signal);
        if (!isActive) return;

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument({ data: buffer });
        const document = await loadingTask.promise;
        if (!isActive) {
          await document.cleanup();
          return;
        }

        documentRef.current = document;
        setPageCount(document.numPages);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        logger.warn("PDF preview failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (isActive) setStatus("native");
      }
    };

    void loadPdf();

    return () => {
      isActive = false;
      abortController.abort();
      void documentRef.current?.cleanup();
      documentRef.current = null;
    };
  }, [item.url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const document = documentRef.current;
    if (!canvas || !document || status !== "ready") return undefined;

    let isActive = true;

    const renderPage = async () => {
      const page = await document.getPage(pageNumber);
      if (!isActive) return;

      const viewport = page.getViewport({ scale: 1.4 });
      const outputScale = window.devicePixelRatio || 1;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      await page.render({
        canvas,
        canvasContext: context,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        viewport,
      }).promise;
    };

    void renderPage();

    return () => {
      isActive = false;
    };
  }, [pageNumber, status]);

  if (status === "loading") {
    return <ResourceViewerState title={item.title} message="Preparing PDF preview..." />;
  }

  if (status === "error") {
    return (
      <ResourceViewerState
        title={item.title}
        message="This PDF could not be previewed here. You can still open the resource in a new tab."
        actionLabel="Open Resource"
        onAction={() => window.open(item.url, "_blank", "noopener,noreferrer")}
      />
    );
  }

  if (status === "native") {
    return (
      <iframe
        className="h-full w-full border-0 bg-surface-primary"
        src={item.url}
        title={item.title}
      />
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface-muted">
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <canvas
          ref={canvasRef}
          className="mx-auto max-w-full rounded-lg bg-surface-primary shadow-sm"
        />
      </div>
      <div className="flex h-12 shrink-0 items-center justify-center gap-2 border-t border-line-default bg-surface-primary">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-lg p-0"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((current) => Math.max(current - 1, 1))}
        >
          <ChevronLeftIcon size={16} />
        </Button>
        <span className="min-w-16 rounded-lg bg-surface-muted px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-content-primary">
          {pageNumber} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-lg p-0"
          disabled={pageNumber >= pageCount}
          onClick={() => setPageNumber((current) => Math.min(current + 1, pageCount))}
        >
          <ChevronRightIcon size={16} />
        </Button>
      </div>
    </div>
  );
};
