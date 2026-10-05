# Code Review Report

**Branch**: `feat/human-review-and-catalog-sync` → `dev`  
**Commits reviewed**: `63a5562`, `3c97446` (2 ahead of `dev`)  
**Scope**: 76 files · +11,575 / −2,049 lines  
**Review date**: 2026-10-05  
**Enforcement**: [`.codereview.yml`](.codereview.yml)  
**Reviewer posture**: Senior principal engineer (30 yr)  

---

## Executive Summary

This PR introduces a **human (staff) review workflow** for artifact submissions, a **managed catalogue sync** pipeline, and supporting changes across the entire stack — from SQL migrations through backend services to frontend UI updates.

**Overall grade: B+** — Excellent architecture and security design. Three items should block merge: missing test coverage for critical service modules, two silent catch blocks, and one unreachable code path.

---

## Scorecard

| Area | Grade | Detail |
|------|-------|--------|
| Architecture | ✅ A | Clean FSD layering, proper `src/` ↔ `functions/` separation, zero cross-boundary violations |
| Security | ✅ A | Auth middleware, scope/assignment checks, scoped RPC, no secret leakage, `REVOKE ALL FROM authenticated` on all review tables |
| Error handling | ⚠️ B+ | Mostly excellent — two silent catch blocks need logging |
| Validation | ✅ A | Zod at every boundary (contracts, queries, env checks, `superRefine` for business invariants) |
| State management | ✅ A | TanStack Query for server state, Zustand for local-only state, proper query key partitioning |
| Test coverage | ⚠️ B− | 20 test files changed/added, but critical new service modules lack tests |
| Naming & structure | ✅ A | Kebab-case dirs, PascalCase components, proper FSD segments |
| Logging | ✅ A | `apiLogger`/`logger` used consistently, zero `console.*` statements |
| SQL migrations | ✅ A | Strong grant-based security model, `FOR UPDATE SKIP LOCKED` outbox, PGTap test suite |

---

## What This PR Does Well

1. **Clean modular decomposition** — The human review system is properly split into [`contracts.ts`](functions/lib/human-review/contracts.ts), [`service.ts`](functions/lib/human-review/service.ts), [`operations.ts`](functions/lib/human-review/operations.ts), [`dispatch.ts`](functions/lib/human-review/dispatch.ts), [`stages.ts`](functions/lib/human-review/stages.ts), [`scores.ts`](functions/lib/human-review/scores.ts) — each with a single responsibility.

2. **Robust Zod validation at every boundary** — `completionSchema` with `superRefine` validates business invariants (pass requires evidence and scores ≥2, revision requires action items). `assignmentSchema` validates all database reads. `reviewScopeSchema` validates SSO authority responses.

3. **Proper auth middleware** — The review middleware ([`_middleware.ts`](functions/api/v1/reviews/_middleware.ts)) uses `getAuthInstance(context.env)` with `requireActiveMembership`, not manual JWT decoding. Scope/assignment checks happen on every read and mutation via `assertAssignmentScope` and `assertActiveReviewer`.

4. **Idempotency keys for mutations** — The `complete`/`return` operations require an `Idempotency-Key` header with SHA-256 command hashing, preventing duplicate review submissions even on network retries.

5. **Fail-closed design** — When the review policy authority is unavailable, the system preserves submissions for staff review (`reviewReason = "review_policy_unavailable"`) rather than auto-passing. This is the correct security posture.

6. **Semantic HTTP status codes** — `ReviewError` uses 400, 403, 404, 409, 413, 503 — all semantically correct. The catch-all returns `"Review service unavailable"` (503) with a `requestId`, never leaking internals.

7. **Evaluation metadata preservation** — AI reference scores are stored in `metadata.ai_reference` and projected through `projectEvaluationReference()`, keeping evaluator internals out of learner-facing responses while preserving them for staff reviewers.

8. **SQL security model** — All review tables use `REVOKE ALL FROM PUBLIC, anon, authenticated` + `GRANT ... TO service_role`. All RPC functions similarly revoke `EXECUTE` from `authenticated`. The `guard_active_artifact_review` trigger prevents submission demotion during active reviews. `claim_review_outbox` uses `FOR UPDATE SKIP LOCKED` for safe concurrent consumption.

9. **API versioning** — All new endpoints are under `/api/v1/reviews/`.

10. **Zero `console.*` statements** — All logging uses `apiLogger`/`logger` throughout.

---

## Merge Blockers (3)

### BLOCKER-1 · Missing tests for critical new service modules

> **Rule**: "Mandatory Test Files" (critical), "Every new module must have a corresponding unit test file" (high)

The following new modules introduced in this PR have **zero test coverage**:

| Module | Lines | Risk |
|--------|-------|------|
| [`functions/lib/human-review/service.ts`](functions/lib/human-review/service.ts) | 264 | Core service: `ensureAndAssignReview`, `requireAssignment`, `assertAssignmentScope`, `requiresFollowupReview` |
| [`functions/api/v1/reviews/[[path]].ts`](functions/api/v1/reviews/[[path]].ts) | 264 | Main review route handler — queue, stats, operations, start, complete, return, file download |
| [`functions/api/v1/dashboard/feedback.ts`](functions/api/v1/dashboard/feedback.ts) | 154 | Learner dashboard feedback endpoint |
| [`functions/lib/human-review/dispatch.ts`](functions/lib/human-review/dispatch.ts) | 74 | CRON-driven reconciliation + outbox processing |
| [`functions/lib/human-review/operations.ts`](functions/lib/human-review/operations.ts) | 128 | Admin backlog, admin review detail, reassignment |
| [`functions/api/v1/reviews/queries.ts`](functions/api/v1/reviews/queries.ts) | 95 | Review detail query composition |

**Tests that DO exist** (good coverage): `authorization.test.ts`, `contracts.test.ts`, `scope-recovery.test.ts`, `scores.test.ts`, `stages.test.ts`, `boundary.test.ts`, `detail.test.ts`, `catalog-sync.test.ts`, `learner-track.test.ts`, `process-and-save.test.ts`, `artifact-extractor.test.ts`.

**Fix**: Add test files for at minimum `service.ts` and `[[path]].ts`, which contain the most business logic and the highest blast radius.

---

### BLOCKER-2 · Two silent catch blocks in `learner-track.ts` swallow operational errors

> **Rule**: "Strict Prohibition of Empty or Silent Catch Blocks" (critical)

```typescript
// Line 122 — DB read for inactive track
} catch {
  inactiveTrack = null;
}

// Line 138 — DB write to reactivate track
} catch {
  // Fall through to SkillPassport lookup.
}
```

Both catch blocks swallow all errors (network failures, Supabase 500s, malformed responses) from **async database operations** without any logging. The `.codereview.yml` rule explicitly prohibits this for operational I/O.

**Mitigation**: Both are intentional degradation paths (fall through to SkillPassport gateway lookup), and the line-138 block has a comment documenting the intent. However, the rule still requires at minimum `logger.warn` so operators can diagnose failures.

**Fix**: Add `logger.warn("Inactive track lookup failed, proceeding to gateway", { userId, error })` to both blocks.

**Location**: [`learner-track.ts:122`](functions/lib/learner-track.ts#L122), [`learner-track.ts:138`](functions/lib/learner-track.ts#L138)

---

### BLOCKER-3 · Unreachable code path after `.safeParse` guard

> **Rule**: Code quality / dead code

```typescript
// learner-track.ts lines 146-151
const parsed = LearningTrackDataSchema.safeParse(raw);
if (!parsed.success) throw new Error("Invalid learning track gateway response");
if (parsed.data.found && !parsed.data.tracks?.length && !parsed.data.track) {
  throw new Error("Assessment found without learning tracks");
}
if (parsed.success && parsed.data.found) {   // ← parsed.success is ALWAYS true here
```

Line 147 throws when `!parsed.success`, so by line 151 `parsed.success` is guaranteed `true`. The redundant `parsed.success &&` check is dead code that confuses reviewers.

**Fix**: Change line 151 to `if (parsed.data.found) {`.

**Location**: [`learner-track.ts:151`](functions/lib/learner-track.ts#L151)

---

## High-Severity Findings (7)

### HIGH-1 · `fetchAndSetActiveLearningPath` always forces `refresh=true` on boot

> **Rule**: Performance

```typescript
// learningPathStore.ts:31
const result = await fetchActiveLearningPath(true);  // always refresh
```

The store method now unconditionally passes `refresh=true`, which bypasses the local database cache and triggers a full SkillPassport gateway round-trip. This is called from `AuthInitializer.tsx` on every app initialization.

**Impact**: Every page load triggers: upstream API call → `syncManagedCatalog` → `deactivateOtherTracks` → `upsertLearningTrack` × N tracks → `syncUserCapabilities` × N roles. On a slow gateway, this adds 2-5s to initial load.

**Note**: `switchActiveTrack` (line 80) correctly calls `fetchActiveLearningPath()` without refresh. Only the boot path is affected.

**Fix**: Accept `refresh` as a parameter to `fetchAndSetActiveLearningPath(userId, refresh?)`. Use `refresh=true` only from the retry button, not the initial boot.

**Location**: [`learningPathStore.ts:31`](src/entities/active-learning-path/model/learningPathStore.ts#L31)

---

### HIGH-2 · `isPanelExpanded` is a dead prop in `ArtifactFeedbackTab`

> **Rule**: "Modularized Components"

The prop `isPanelExpanded` remains in the `ArtifactFeedbackTabProps` interface ([line 44](src/pages/level-content/ui/components/ArtifactFeedbackTab.tsx#L44)) and is still passed from the parent `ArtifactPanel` ([line 291](src/pages/level-content/ui/components/ArtifactPanel.tsx#L291)), but is **no longer destructured** in the component implementation. It was removed during the stage-rendering refactor but the interface and parent prop were not cleaned up.

**Fix**: Remove `isPanelExpanded` from `ArtifactFeedbackTabProps` and from the parent's JSX.

---

### HIGH-3 · Hardcoded 30-second timeout for `catalogue:get`

> **Rule**: "No Hardcoded Values"

```typescript
// skill-gateway.ts
action === "catalogue:get" ? 30000 : GATEWAY_TIMEOUT_MS,
```

The timeout override is inlined without a named constant.

**Fix**: `const CATALOGUE_TIMEOUT_MS = 30_000;` in config.

**Location**: [`skill-gateway.ts`](functions/lib/skill-gateway.ts)

---

### HIGH-4 · In-memory rate limiter used for review endpoints

> **Rule**: "Distributed Rate Limiting at the Edge"

The review endpoint at [`[[path]].ts:66`](functions/api/v1/reviews/[[path]].ts#L66) uses `rateLimiter.check()`, which is a `SlidingWindowRateLimiter` backed by an in-memory `Map` ([`rate-limiter.ts:17`](functions/middleware/rate-limiter.ts#L17)). The source code itself acknowledges this at line 40: *"A global DB-backed limiter is the upgrade path if multi-isolate accuracy ever matters."*

Per `.codereview.yml`, security-critical edge endpoints must use distributed rate limiting. This is a known pre-existing pattern used across the project, so it's not unique to this PR, but extending it to the review system amplifies the risk.

---

### HIGH-5 · Zustand store directly calls `queryClient.invalidateQueries()`

> **Rule**: "Proper Zustand Usage", "Do not duplicate TanStack Query data in Zustand"

```typescript
// learningPathStore.ts:42-46
import { queryClient } from "@/shared/lib/queryClient";
// ...
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ["dashboardData", userId] }),
  queryClient.invalidateQueries({ queryKey: ["userCourses", userId] }),
  queryClient.invalidateQueries({ queryKey: ["capabilityLevels", userId] }),
]);
```

A Zustand store in the `entities/` layer directly imports and manipulates TanStack Query's internal cache. This couples the two state management systems. The invalidation should be triggered by the component/hook that calls the store method, not from inside the store.

**Location**: [`learningPathStore.ts:5,42-46`](src/entities/active-learning-path/model/learningPathStore.ts#L42)

---

### HIGH-6 · Hardcoded polling intervals should be in `shared/config/`

> **Rule**: "No Hardcoded Values"

Both [`useDashboardData.ts`](src/entities/dashboard/model/useDashboardData.ts) and [`useSubmissionEvaluation.ts`](src/features/submit-artifact/model/useSubmissionEvaluation.ts) hardcode `30_000` ms polling intervals. Extract to `shared/config/polling.ts`.

---

### HIGH-7 · `ModuleArtifactSubmission` type duplicated without annotation

> **Rule**: "Shared types must not cross runtime boundaries by direct import"

The `ModuleArtifactSubmission` interface is defined identically in:
- [`functions/api/v1/courses/types.ts:64`](functions/api/v1/courses/types.ts#L64) (backend)
- [`src/entities/course/model/levelContentTypes.ts:59`](src/entities/course/model/levelContentTypes.ts#L59) (frontend)

Per `.codereview.yml`, intentional duplication is the correct approach (types must not cross runtime boundaries). However, **neither file documents the duplication**. Without a comment like `// Mirrors functions/api/v1/courses/types.ts#ModuleArtifactSubmission`, a future developer will change one without the other.

**Fix**: Add mirror comments to both definitions.

---

## Medium-Severity Findings (6)

### MED-1 · `catalog-sync.ts` silently returns on `schema cache` errors

```typescript
// catalog-sync.ts:60-63
if (message.includes("missing_managed_catalog_roles") || message.includes("schema cache")) {
  return;   // silently swallows
}
```

This is an RPC-level database error. The `schema cache` case typically means the migration hasn't been applied. Add `logger.warn`.

**Location**: [`catalog-sync.ts:58-63`](functions/lib/catalog-sync.ts#L58)

---

### MED-2 · `ArtifactPanel.tsx` optimistic state has no reconciliation

The `localAttempts` state manually merges optimistic attempt data with server-returned `submittedAttempts`. If the server rejects the submission, the local attempt persists until a full page reload. Consider resetting `localAttempts` when `activeArtifact.submittedAttempts` updates.

**Location**: [`ArtifactPanel.tsx`](src/pages/level-content/ui/components/ArtifactPanel.tsx)

---

### MED-3 · `DashboardFeedbackResponseSchema` regex ties schema to route pattern

```typescript
href: z.string().regex(/^\/my-courses\//),
```

If the routes change, this schema silently rejects valid data. Consider `z.string().startsWith("/")`.

**Location**: [`dashboardSchemas.ts`](src/entities/dashboard/model/dashboardSchemas.ts)

---

### MED-4 · `useSubmissionEvaluation` bulk invalidation may cause render waterfall

The `useEffect` in [`useSubmissionEvaluation.ts`](src/features/submit-artifact/model/useSubmissionEvaluation.ts) invalidates 6 query key prefixes when a staff review completes. This could cause cascading re-renders on the dashboard.

---

### MED-5 · `refresh` query param not Zod-validated in `active.ts`

```typescript
refresh: new URL(context.request.url).searchParams.get("refresh") === "true",
```

Safe via `=== "true"` coercion, but doesn't follow the project pattern where all query params are Zod-validated at the boundary.

**Location**: [`active.ts`](functions/api/v1/learning-paths/active.ts)

---

### MED-6 · `review-worker/index.ts` uses relative imports and lives outside approved structure

```typescript
import { dispatchReviewWork } from '../functions/lib/human-review/dispatch';
```

Uses `../functions/` relative imports instead of the `@functions/` path alias. The `review-worker/` directory is also not in the `.codereview.yml` approved structure.

**Fix**: Either update `.codereview.yml` to include `review-worker/`, or move the entry point into `functions/workers/review/`.

**Location**: [`review-worker/index.ts`](review-worker/index.ts), [`wrangler.reviews.toml`](wrangler.reviews.toml)

---

## Low-Severity Observations

| Finding | Detail |
|---------|--------|
| `UpcomingFeedback` removed `action` prop from `WidgetCard` | Removed `{ label: "View calendar", href: "#calendar" }`. Verify no other consumers depend on it. |
| `readCommand()` manual body parsing | Manually streams `Uint8Array` chunks for a 64KB limit. Functional and secure, but `request.text()` with `Content-Length` check would be simpler. |
| `badge: "none"` removed from upsert | Safe — column has `DEFAULT 'none'` in schema. Good cleanup. |
| Pre-existing: No `ErrorBoundary` on dashboard widgets | `UpcomingFeedback` and other dashboard widgets lack localized error boundaries per `.codereview.yml`. Pre-existing debt, not introduced by this PR. |

---

## Import Direction & Cross-Boundary Audit

| Check | Result |
|-------|--------|
| `src/` importing `functions/` | ✅ Zero violations |
| `functions/` importing `src/` | ✅ Zero violations |
| `shared/` importing `entities/features/pages` | ✅ Zero violations |
| `entities/` importing `features/pages/widgets` | ✅ Zero violations |
| FSD upward imports (lower → higher layer) | ✅ Clean |
| `console.*` in new code | ✅ Zero instances |
| Secrets in frontend-accessible code | ✅ None |
| Direct `supabase.auth.*` usage | ✅ None |

---

## SQL Migration Security Audit

The branch includes 8 SQL migrations under `supabase/migrations/`. Key findings:

| Migration | Purpose | Security |
|-----------|---------|----------|
| `20261001090000_add_staff_review_stage.sql` | Adds `staff_review` to `artifact_evaluation_stage` enum | ✅ |
| `20261001090100_human_review_foundation.sql` | Review tables, RPC functions, grant lockdown | ✅ `REVOKE ALL FROM PUBLIC, anon, authenticated` on all tables |
| `20261001090300_review_reconciliation.sql` | Claim-based reconciliation RPC | ✅ Service-role only |
| `20261001090500_review_queue.sql` | Queue listing RPC | ✅ Service-role only |
| `20261001090600_review_operations.sql` | Admin operations: reassignment, stats | ✅ Service-role only |
| `20261001090700_review_deadlines.sql` | Business-day deadline calculation, overdue escalation | ✅ |
| `20261001090900_review_scope_recovery.sql` | Scope transfer, outbox cancellation | ✅ Audited |
| `20261001091000_review_access_without_rls.sql` | Explicit RLS disable + grant-only access | ✅ Correct pattern |
| `20261001091200_normalize_review_rubrics.sql` | Normalized rubric criteria + per-criterion scores | ✅ |

**PGTap test suite** ([`human_review.sql`](supabase/tests/human_review.sql), 193 lines): Covers assignment flow, scope transfer, deadline escalation, idempotency conflicts, old-reviewer rejection, permission grants, and verifies `authenticated` role cannot call any review RPC.

> ⚠️ **Database migrations require explicit user approval before merge** per project rules.

---

## Test Coverage Map

| Test File | What It Covers | Status |
|-----------|---------------|--------|
| `human-review/authorization.test.ts` | `assertActiveReviewer` edge cases | ✅ New |
| `human-review/contracts.test.ts` | `completionSchema`, `normalizeCompletion`, `completionHash` | ✅ New |
| `human-review/scope-recovery.test.ts` | `assertAssignmentScope`, scope mismatch scenarios | ✅ New |
| `human-review/scores.test.ts` | `readStaffRubricRows` schema validation | ✅ New |
| `human-review/stages.test.ts` | `getEvaluationStages`, `projectEvaluationReference` | ✅ New |
| `reviews/boundary.test.ts` | Review endpoint boundary validation | ✅ New |
| `reviews/detail.test.ts` | Review detail query composition | ✅ New |
| `catalog-sync.test.ts` | `syncManagedCatalog` happy/error paths | ✅ New |
| `learner-track.test.ts` | `resolveActiveTrack` with refresh, catalogue sync, shadow role | ✅ Updated |
| `artifact-extractor.test.ts` | Template sheet filtering | ✅ Updated |
| `process-and-save.test.ts` | Human review integration in evaluation pipeline | ✅ Updated |
| `active.test.ts` | Learning path active endpoint with refresh | ✅ Updated |
| `queries.test.ts` | `ensureShadowRole` | ✅ New |
| `getModuleDetails.test.ts` | Submitted attempts in module details | ✅ New |
| Dashboard tests (4 files) | Updated for feedback widget data | ✅ Updated |
| `learningPathStore.test.ts` | Store with refresh + query invalidation | ✅ Updated |
| **`service.ts`** | Core service logic (264 lines) | ❌ **Missing** |
| **`[[path]].ts`** | Route handler (264 lines) | ❌ **Missing** |
| **`feedback.ts`** | Dashboard feedback endpoint (154 lines) | ❌ **Missing** |
| **`dispatch.ts`** | CRON reconciliation (74 lines) | ❌ **Missing** |
| **`operations.ts`** | Admin operations (128 lines) | ❌ **Missing** |

---

## Action Items (Prioritized)

| Priority | ID | Action | Effort |
|----------|----|--------|--------|
| 🔴 Blocker | BLOCKER-1 | Add tests for `service.ts`, `[[path]].ts`, `feedback.ts`, `dispatch.ts`, `operations.ts` | Large |
| 🔴 Blocker | BLOCKER-2 | Add `logger.warn` to silent catch blocks at lines 122 and 138 of `learner-track.ts` | Trivial |
| 🔴 Blocker | BLOCKER-3 | Remove redundant `parsed.success` guard at line 151 of `learner-track.ts` | Trivial |
| 🟡 High | HIGH-1 | Parameterize `refresh` in `fetchAndSetActiveLearningPath` — don't force on boot | Small |
| 🟡 High | HIGH-2 | Remove dead `isPanelExpanded` prop from interface and parent JSX | Trivial |
| 🟡 High | HIGH-3 | Extract catalogue timeout `30000` to named constant | Trivial |
| 🟡 High | HIGH-5 | Move `queryClient.invalidateQueries` out of Zustand store into the calling component | Small |
| 🟡 High | HIGH-6 | Extract polling interval `30_000` to `shared/config/` | Trivial |
| 🟡 High | HIGH-7 | Add mirror comments to duplicated `ModuleArtifactSubmission` types | Trivial |
| 🟢 Medium | MED-1 | Add `logger.warn` for `schema cache` early return in `catalog-sync.ts` | Trivial |
| 🟢 Medium | MED-2 | Add optimistic state reconciliation for `localAttempts` in `ArtifactPanel` | Small |
| 🟢 Medium | MED-5 | Zod-validate `refresh` query param in `active.ts` | Trivial |
| 🟢 Medium | MED-6 | Update `.codereview.yml` structure to include `review-worker/` | Trivial |

---

## Files Reviewed (42 source files)

### Backend — New (10)

| File | Lines | Verdict |
|------|-------|---------|
| [`human-review/service.ts`](functions/lib/human-review/service.ts) | 264 | ✅ Well-structured · ⚠️ Needs tests |
| [`human-review/contracts.ts`](functions/lib/human-review/contracts.ts) | 116 | ✅ Excellent Zod validation |
| [`human-review/operations.ts`](functions/lib/human-review/operations.ts) | 128 | ✅ Clean admin operations · ⚠️ Needs tests |
| [`human-review/dispatch.ts`](functions/lib/human-review/dispatch.ts) | 74 | ✅ Outbox pattern · ⚠️ Needs tests |
| [`human-review/stages.ts`](functions/lib/human-review/stages.ts) | 84 | ✅ Good projection logic |
| [`human-review/scores.ts`](functions/lib/human-review/scores.ts) | 33 | ✅ Tight Zod schema |
| [`catalog-sync.ts`](functions/lib/catalog-sync.ts) | 81 | ⚠️ Silent error swallow (MED-1) |
| [`reviews/[[path]].ts`](functions/api/v1/reviews/[[path]].ts) | 264 | ⚠️ Needs tests, in-memory rate limiter |
| [`reviews/queries.ts`](functions/api/v1/reviews/queries.ts) | 95 | ✅ Clean query composition |
| [`dashboard/feedback.ts`](functions/api/v1/dashboard/feedback.ts) | 154 | ⚠️ Needs tests |

### Backend — Modified (10)

| File | Verdict |
|------|---------|
| [`learner-track.ts`](functions/lib/learner-track.ts) | ⚠️ BLOCKER-2 + BLOCKER-3 |
| [`artifact-evaluator.ts`](functions/lib/artifact-evaluator/artifact-evaluator.ts) | ✅ Clean human review integration |
| [`artifact-extractor.ts`](functions/lib/artifact-evaluator/artifact-extractor.ts) | ✅ Smart template sheet filtering |
| [`response-schema.ts`](functions/lib/artifact-evaluator/response-schema.ts) | ✅ Clean threshold parameterization |
| [`reviews/_middleware.ts`](functions/api/v1/reviews/_middleware.ts) | ✅ Proper auth delegation |
| [`skill-gateway.ts`](functions/lib/skill-gateway.ts) | ⚠️ Hardcoded timeout (HIGH-3) |
| [`active.ts`](functions/api/v1/learning-paths/active.ts) | ✅ Good — sanitized 503 error response |
| [`queries.ts`](functions/api/v1/learning-paths/queries.ts) | ✅ `ensureShadowRole` with race-condition handling |
| [`artifact-helpers.ts`](functions/api/v1/courses/artifact-helpers.ts) | ✅ Clean `submittedAttempts` plumbing |
| [`shared/types.ts`](functions/shared/types.ts) | ✅ `HUMAN_REVIEW_ENABLED` + `HUMAN_REVIEW_AVAILABLE` |

### Frontend — Modified (14)

| File | Verdict |
|------|---------|
| [`DashboardPage.tsx`](src/pages/dashboard/ui/DashboardPage.tsx) | ✅ Good retry UX for learning path errors |
| [`ArtifactPanel.tsx`](src/pages/level-content/ui/components/ArtifactPanel.tsx) | ⚠️ Optimistic state needs reconciliation (MED-2) |
| [`ArtifactFeedbackTab.tsx`](src/pages/level-content/ui/components/ArtifactFeedbackTab.tsx) | ⚠️ Dead `isPanelExpanded` prop (HIGH-2) |
| [`UpcomingFeedback.tsx`](src/widgets/dashboard/upcoming-feedback/ui/UpcomingFeedback.tsx) | ✅ Good empty states, `Link` routing |
| [`learningPathStore.ts`](src/entities/active-learning-path/model/learningPathStore.ts) | ⚠️ `refresh=true` always (HIGH-1), Zustand↔TanStack coupling (HIGH-5) |
| [`learningPathApi.ts`](src/entities/active-learning-path/api/learningPathApi.ts) | ✅ Clean `refresh` parameter |
| [`dashboardApi.ts`](src/entities/dashboard/api/dashboardApi.ts) | ✅ Graceful degradation for feedback |
| [`dashboardSchemas.ts`](src/entities/dashboard/model/dashboardSchemas.ts) | ⚠️ Regex-tied href (MED-3) |
| [`types.ts`](src/entities/dashboard/model/types.ts) | ✅ Clean `staff-review` type extension |
| [`useDashboardData.ts`](src/entities/dashboard/model/useDashboardData.ts) | ⚠️ Hardcoded polling interval (HIGH-6) |
| [`getSubmissionEvaluation.ts`](src/features/submit-artifact/api/getSubmissionEvaluation.ts) | ✅ `EvaluationStage` interface |
| [`useSubmissionEvaluation.ts`](src/features/submit-artifact/model/useSubmissionEvaluation.ts) | ⚠️ Hardcoded polling (HIGH-6), bulk invalidation (MED-4) |
| [`levelContentSchemas.ts`](src/entities/course/model/levelContentSchemas.ts) | ✅ `ModuleArtifactSubmissionSchema` |
| [`levelContentTypes.ts`](src/entities/course/model/levelContentTypes.ts) | ⚠️ Undocumented type duplication (HIGH-7) |

### Other (8)

| File | Verdict |
|------|---------|
| [`review-worker/index.ts`](review-worker/index.ts) | ⚠️ Relative imports, outside approved structure (MED-6) |
| [`wrangler.reviews.toml`](wrangler.reviews.toml) | ✅ Safe defaults (`HUMAN_REVIEW_AVAILABLE=false`) |
| [`docs/MANAGED_CATALOG_SYNC.md`](docs/MANAGED_CATALOG_SYNC.md) | ✅ |
| 8 SQL migrations | ✅ Strong security model |
| [`supabase/tests/human_review.sql`](supabase/tests/human_review.sql) | ✅ Excellent PGTap coverage |
| [`scripts/tests/human-review-concurrency.py`](scripts/tests/human-review-concurrency.py) | ✅ Load test script |

---

*Review completed with two passes and false-positive verification against source code. Three findings originally reported were retracted after verification: `waitUntil()` gap (the call chain is fully awaited), `badge` column removal (column has `DEFAULT 'none'`), and `UpcomingFeedback` error boundary (pre-existing debt, not introduced by this PR).*
