import type React from "react";
import { lazy, Suspense } from "react";
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

export type ResourceContentViewerProps = ResourceRendererProps;

export const ResourceContentViewer: React.FC<ResourceContentViewerProps> = ({ item }) => {
  const fileKind = getResourceFileKind(item);

  if (fileKind === "video") return <VideoContentViewer item={item} />;
  if (fileKind === "image") return <ImageContentViewer item={item} />;

  if (fileKind === "pptx")
    return (
      <Suspense fallback={<ViewerFallback title={item.title} />}>
        <PptxContentViewer title={item.title} url={item.url} />
      </Suspense>
    );

  if (fileKind === "pdf")
    return (
      <Suspense fallback={<ViewerFallback title={item.title} />}>
        <PdfContentViewer item={item} />
      </Suspense>
    );

  if (fileKind === "docx")
    return (
      <Suspense fallback={<ViewerFallback title={item.title} />}>
        <DocxContentViewer item={item} />
      </Suspense>
    );

  if (fileKind === "xlsx")
    return (
      <Suspense fallback={<ViewerFallback title={item.title} />}>
        <SpreadsheetContentViewer item={item} />
      </Suspense>
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
