import type React from "react";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/shared/ui";
import { ImageContentViewer } from "./ImageContentViewer";
import { ResourceViewerState } from "./ResourceViewerState";
import { getResourceFileKind, type ResourceRendererProps } from "./types";
import { VideoContentViewer } from "./VideoContentViewer";

const PptxContentViewer = lazy(() =>
  import("../PptxContentViewer").then((m) => ({ default: m.PptxContentViewer })),
);
const PdfContentViewer = lazy(() =>
  import("./PdfContentViewer").then((m) => ({ default: m.PdfContentViewer })),
);
const DocxContentViewer = lazy(() =>
  import("./DocxContentViewer").then((m) => ({ default: m.DocxContentViewer })),
);
const SpreadsheetContentViewer = lazy(() =>
  import("./SpreadsheetContentViewer").then((m) => ({ default: m.SpreadsheetContentViewer })),
);

const ViewerFallback = ({ title }: { title: string }) => (
  <ResourceViewerState title={title} message="Loading preview..." />
);

// Local boundary per lazy viewer: a render-phase or chunk-load crash in one
// viewer must not propagate to the root boundary and unmount the whole app.
const BoundedViewer = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <Suspense fallback={<ViewerFallback title={title} />}>{children}</Suspense>
  </ErrorBoundary>
);

export type ResourceContentViewerProps = ResourceRendererProps;

export const ResourceContentViewer: React.FC<ResourceContentViewerProps> = ({ item }) => {
  const fileKind = getResourceFileKind(item);

  if (fileKind === "video") return <VideoContentViewer item={item} />;
  if (fileKind === "image") return <ImageContentViewer item={item} />;

  if (fileKind === "pptx")
    return (
      <BoundedViewer title={item.title}>
        <PptxContentViewer title={item.title} url={item.url} />
      </BoundedViewer>
    );

  if (fileKind === "pdf")
    return (
      <BoundedViewer title={item.title}>
        <PdfContentViewer item={item} />
      </BoundedViewer>
    );

  if (fileKind === "docx")
    return (
      <BoundedViewer title={item.title}>
        <DocxContentViewer item={item} />
      </BoundedViewer>
    );

  if (fileKind === "xlsx")
    return (
      <BoundedViewer title={item.title}>
        <SpreadsheetContentViewer item={item} />
      </BoundedViewer>
    );

  if (fileKind === "audio") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-content-primary p-6">
        <audio controls className="w-full max-w-xl" src={item.url}>
          <track kind="captions" />
        </audio>
      </div>
    );
  }

  return (
    <ResourceViewerState
      title={item.title}
      message="This resource type cannot be previewed here yet. You can still open the resource in a new tab."
      actionLabel="Open Resource"
      onAction={() => window.open(item.url, "_blank", "noopener,noreferrer")}
    />
  );
};
