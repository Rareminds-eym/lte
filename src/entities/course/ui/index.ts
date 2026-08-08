export { CourseCard, type CourseCardProps } from "./CourseCard";
export { CourseCardGridSkeleton, CourseCardSkeleton } from "./CourseCardSkeleton";
// PptxContentViewer is intentionally excluded from the public API — it is loaded
// via React.lazy() inside ResourceContentViewer for code-splitting.
// Do not re-add a static export here.
export { ResourceContentViewer, type ResourceContentViewerProps } from "./resource-content-viewer";
