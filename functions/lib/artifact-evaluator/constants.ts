/**
 * Central, configurable limits for artifact submission hardening (Phase 3).
 *
 * Single source of truth, shared by the zod schema, the multipart guards and
 * the endpoint so the caps can never drift apart. Build-time constants only
 * (the env-override experiment was removed: fixed, reviewable caps beat
 * runtime-tunable ones when the trade-off is a misconfigured var widening a
 * validation limit).
 */
export interface ArtifactLimits {
  textResponseMaxChars: number;
  urlResponseMaxChars: number;
  fileNameMaxChars: number;
  maxAnswersPerSubmission: number;
  maxFilesPerSubmission: number;
  maxRequestBytes: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

export const ARTIFACT_LIMITS: ArtifactLimits = {
  textResponseMaxChars: 20_000,
  urlResponseMaxChars: 2_048,
  fileNameMaxChars: 255,
  maxAnswersPerSubmission: 20,
  maxFilesPerSubmission: 10,
  // Per-file cap is 10 MB; 25 MB covers several files plus multipart overhead.
  maxRequestBytes: 25 * 1024 * 1024,
  // 10 submissions per authenticated user per minute.
  rateLimitMax: 10,
  rateLimitWindowMs: 60_000,
};
