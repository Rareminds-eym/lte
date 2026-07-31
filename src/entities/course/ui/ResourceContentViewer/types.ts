import type { EContentItem } from "@/entities/course/model/levelContentTypes";

export type ResourceFileKind =
  | "pptx"
  | "pdf"
  | "docx"
  | "xlsx"
  | "video"
  | "image"
  | "audio"
  | "text"
  | "link"
  | "unsupported";

export interface ResourceRendererProps {
  item: EContentItem;
}

const getFileExtension = (url: string) => {
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  const fileName = path.split("/").pop() ?? "";
  const extension = fileName.split(".").pop();
  return extension?.toLowerCase() ?? "";
};

export const getResourcePreviewUrl = (url: string) =>
  `/api/v1/courses/resources/preview?url=${encodeURIComponent(url)}`;

export const getOfficeEmbedUrl = (url: string) =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

export const fetchResourceBuffer = async (url: string, signal?: AbortSignal) => {
  const previewResponse = await fetch(getResourcePreviewUrl(url), { signal });
  if (previewResponse.ok) return previewResponse.arrayBuffer();

  const directResponse = await fetch(url, { signal });
  if (!directResponse.ok) throw new Error("Resource file could not be loaded.");

  return directResponse.arrayBuffer();
};

export const getResourceFileKind = (item: EContentItem): ResourceFileKind => {
  const extension = getFileExtension(item.url);
  const mimeType = item.mimeType?.toLowerCase() ?? "";

  if (item.contentType === "video" || mimeType.startsWith("video/")) return "video";
  if (item.contentType === "audio" || mimeType.startsWith("audio/")) return "audio";
  if (item.contentType === "image" || mimeType.startsWith("image/")) return "image";
  if (item.contentType === "link") return "link";
  if (item.contentType === "text") return "text";

  if (extension === "pptx" || extension === "ppt" || item.contentType === "slide") return "pptx";
  if (extension === "pdf" || mimeType === "application/pdf" || item.contentType === "pdf") {
    return "pdf";
  }
  if (
    extension === "docx" ||
    extension === "doc" ||
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword")
  ) {
    return "docx";
  }
  if (
    extension === "xlsx" ||
    extension === "xls" ||
    extension === "csv" ||
    mimeType.includes("spreadsheetml") ||
    mimeType.includes("ms-excel")
  ) {
    return "xlsx";
  }

  return "unsupported";
};
