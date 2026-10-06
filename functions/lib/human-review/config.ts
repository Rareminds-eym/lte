export const DEFAULT_REVIEW_SLA = { slaDays: 3, timeZone: "Asia/Kolkata", loadCap: 10 } as const;
export const REVIEW_PAGE_SIZE = 25;
export const REVIEW_BODY_LIMIT_BYTES = 65_536;
export const REVIEW_RATE_LIMIT = { namespace: "reviews", limit: 60, windowSeconds: 60 } as const;
export const TRACK_REFRESH_RATE_LIMIT = {
  namespace: "track-refresh",
  limit: 5,
  windowSeconds: 60,
} as const;
export const REVIEW_STATS_LIMIT = 100;
export const REVIEW_AUTH_BATCH_SIZE = 10;
export const REVIEW_FEEDBACK_LIMIT = 20;
export const REVIEW_FEEDBACK_TEXT = {
  awaitingReviewer: "Awaiting an eligible staff reviewer",
  inProgress: "Staff review in progress",
  awaitingAssignment: "Awaiting assignment",
  passed: "Staff review passed — view feedback",
  revision: "Revision requested — view next steps",
} as const;
export const reviewModuleHref = (levelId: string, moduleNo: number) =>
  `/my-courses/${encodeURIComponent(levelId)}/modules/${moduleNo}`;
export const REVIEW_QUERY_LIMIT = 100;
export const REVIEW_MAINTENANCE_BATCH_SIZE = 25;
export const REVIEW_DEADLINE_BATCH_SIZE = 100;
