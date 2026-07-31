import { renderAsync } from "docx-preview";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { getLogger } from "@/shared/config/logging";
import { ResourceViewerState } from "./ResourceViewerState";
import { getResourcePreviewUrl, type ResourceRendererProps } from "./types";

const logger = getLogger("course-docx-viewer");

export const DocxContentViewer: React.FC<ResourceRendererProps> = ({ item }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const abortController = new AbortController();
    let isActive = true;

    const renderDocument = async () => {
      setStatus("loading");
      container.innerHTML = "";

      try {
        const response = await fetch(getResourcePreviewUrl(item.url), {
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error("Document file could not be loaded.");

        const blob = await response.blob();
        if (!isActive) return;

        await renderAsync(blob, container, undefined, {
          breakPages: true,
          className: "lte-docx-preview",
          ignoreFonts: true,
          ignoreHeight: false,
          ignoreWidth: false,
          inWrapper: true,
        });

        if (isActive) setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        logger.warn("DOCX preview failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (isActive) setStatus("error");
      }
    };

    void renderDocument();

    return () => {
      isActive = false;
      abortController.abort();
      container.innerHTML = "";
    };
  }, [item.url]);

  if (status === "error") {
    return (
      <ResourceViewerState
        title={item.title}
        message="This document could not be previewed here. You can still open the resource in a new tab."
        actionLabel="Open Resource"
        onAction={() => window.open(item.url, "_blank", "noopener,noreferrer")}
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-surface-muted p-4">
      {status === "loading" ? (
        <ResourceViewerState title={item.title} message="Preparing document preview..." />
      ) : null}
      <div
        ref={containerRef}
        className="mx-auto max-w-4xl rounded-lg bg-surface-primary shadow-2xs [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-0 [&_.docx]:!mx-auto"
      />
    </div>
  );
};
