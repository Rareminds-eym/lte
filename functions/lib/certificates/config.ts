export const CERTIFICATE_CONFIG = {
  templateVersion: 2,
  cleanupBatchSize: 10,
  cleanupPageSize: 1000,
  rendererTimeoutMs: 30_000,
  listRateLimit: 60,
  downloadRateLimit: 10,
  publicRateLimit: 60,
  internalRateLimit: 600,
  maxPageSize: 100,
  verifyCacheSeconds: 60,
} as const;

export const CERTIFICATE_COPY = {
  brand: "RAREMINDS",
  product: "LTE",
  eyebrow: "Learning • Achievement • Progress",
  courseHeading: "Certificate of Completion",
  roleHeading: "Certificate of Role Readiness",
  recipient: "This certifies that",
  achievement: "has successfully completed",
  completed: "Completed on",
  verify: "Verify at",
} as const;
