export { CourseCard, type CourseCardProps } from "./CourseCard";
export { CourseCardGridSkeleton, CourseCardSkeleton } from "./CourseCardSkeleton";
export { CourseGridSkeleton, CourseSkeleton } from "./CourseSkeleton";
// PptxContentViewer is intentionally excluded from the public API — it is loaded
// via React.lazy() inside ResourceContentViewer for code-splitting.
// Do not re-add a static export here.
export { ResourceContentViewer, type ResourceContentViewerProps } from "./ResourceContentViewer";
