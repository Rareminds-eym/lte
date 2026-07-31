import type React from "react";
import { PptxContentViewer } from "../PptxContentViewer";
import { DocxContentViewer } from "./DocxContentViewer";
import { ImageContentViewer } from "./ImageContentViewer";
import { PdfContentViewer } from "./PdfContentViewer";
import { ResourceViewerState } from "./ResourceViewerState";
import { SpreadsheetContentViewer } from "./SpreadsheetContentViewer";
import { getResourceFileKind, type ResourceRendererProps } from "./types";
import { VideoContentViewer } from "./VideoContentViewer";

export type ResourceContentViewerProps = ResourceRendererProps;

export const ResourceContentViewer: React.FC<ResourceContentViewerProps> = ({ item }) => {
  const fileKind = getResourceFileKind(item);

  if (fileKind === "video") return <VideoContentViewer item={item} />;
  if (fileKind === "image") return <ImageContentViewer item={item} />;
  if (fileKind === "pptx") return <PptxContentViewer title={item.title} url={item.url} />;
  if (fileKind === "pdf") return <PdfContentViewer item={item} />;
  if (fileKind === "docx") return <DocxContentViewer item={item} />;
  if (fileKind === "xlsx") return <SpreadsheetContentViewer item={item} />;

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
