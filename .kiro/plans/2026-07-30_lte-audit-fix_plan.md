# Plan: Fix Audit Violations in lte/ Changed Files

**Date**: 2026-07-30  
**Source**: Deep audit of 28 changed files vs `lte/.codereview.yml` + workspace steering files + 2026 best practices

---

## Overview

24 issues found (5 critical, 12 high, 7 medium). This plan covers every fix ordered by dependency — later steps depend on earlier infrastructure being in place.

---

## Phase 0: Infrastructure (must land first)

### P0.1 — Create `apiClient` with auth injection

**Files**: `src/shared/api/index.ts` (rewrite), `src/shared/api/authApi.ts` (minor update)

**Problem**: `.codereview.yml` mandates `apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete` via an approved client, but only a bare `fetchJSON` exists. All 4 frontend API files (`authApi.ts`, `courseApi.ts`, `learningPathApi.ts`, `initializeLearningPath.ts`) use raw `fetch()` — this is a pre-existing infra gap, not a new violation per se, but fixing the infra fixes all 4 at once.

**Fix**: Add to `src/shared/api/index.ts`:

```ts
function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string, opts?: { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(path, {
    method: "GET",
    headers: { ...getAuthHeaders() },
    signal: opts?.signal,
    credentials: "include",
  });
  if (!res.ok) throw await parseApiError(res);
  return res.json();
}

// apiPost, apiPut, apiPatch, apiDelete — same shape with method + JSON body
```

Also add shared `parseApiError`, `ApiError` class, and `ApiResponse<T>` type.

**Note**: `authApi.ts` uses `credentials: "include"` for its session endpoints — keep those as-is since they depend on HttpOnly cookies not Bearer tokens.

---

### P0.2 — Add `shared/ui/icons/` for reused SVG components

**Files**: create `src/shared/ui/icons/` barrel

**Problem**: 12 inline SVG icon component definitions duplicated across `CourseCard.tsx` (6) and `CoursesPage.tsx` (6). These are the same icons used elsewhere in the app.

**Fix**: Extract all unique icons into `src/shared/ui/icons/<Name>.tsx` files with a barrel `index.ts`. Both consuming files then import from `@/shared/ui`.

```ts
// src/shared/ui/icons/ClockIcon.tsx
export const ClockIcon: React.FC = () => (
  <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" ...>
  </svg>
);
```

Affected icons: ClockIcon, FireIcon, ArrowRightIcon, InfoIcon, CheckSmall, CheckCircleIcon, BookIcon, LayersIconSmall, CheckIconSmall, ClockIconSmall, FilterIcon, GridIcon, ListIcon.

---

## Phase 1: FSD Violations (CRITICAL)

### 1.1 — Move authStore from `app/store/` to `entities/session/model/`

**Files**:
- Move: `src/app/store/authStore.ts` → `src/entities/session/model/authStore.ts`
- Create: `src/entities/session/index.ts` (barrel)
- Create: `src/entities/session/model/index.ts` (barrel)
- Update: `src/app/store/` → remove authStore
- Update: All imports of `@/app/store/authStore` → `@/entities/session`

**Importers to update** (grep for `@/app/store/authStore`):
- `src/entities/course/model/useCourses.ts`
- `src/features/initialize-learning-path/ui/LearningPathInitializer.tsx`
- `src/features/...` (any others)
- `src/__tests__/auth/store/authStore.test.ts`

**Impact**: Fixes audit issue #3 (authStore in app layer) and unblocks #1.1.

---

### 1.2 — Move `learningPathApi` from `shared/` to `entities/`

**Files**:
- Move: `src/shared/api/learningPathApi.ts` → `src/entities/active-learning-path/api/learningPathApi.ts`
- Create: `src/entities/active-learning-path/model/types.ts` (or import from shared types)
- Create: `src/entities/active-learning-path/index.ts`
- Update: imports in `authStore.ts` and `__tests__/shared/api/learningPathApi.test.ts`
- Move test: `src/__tests__/shared/api/learningPathApi.test.ts` → `src/__tests__/courses/api/`

**Impact**: Fixes audit issue #6 — domain API in shared instead of entity.

---

### 1.3 — Fix `entities/course` importing from `app/`

**File**: `src/entities/course/model/useCourses.ts`

**Problem**: Line 4: `import { useAuthStore } from "@/app/store/authStore"` — entities cannot import from app (FSD violation). After 1.1, this becomes `import { useAuthStore } from "@/entities/session"` which is legal (same-layer entity cross-import, allowed via `@x` notation in FSD v2.1).

**Impact**: Blocked on 1.1. Once authStore moves, fix is automatic.

---

## Phase 2: Error Handling Regression (HIGH)

### 2.1 — Restore structured error responses with `requestId`

**Files**: `functions/lib/http.ts`, `functions/api/v1/learning-paths/initialize.ts`

**Problem**: The new `jsonError()` helper only returns `{ success: false, error: { message } }`. The old code returned `{ success: false, error: { code, message, details }, requestId }` — losing both the error code enum (`VALIDATION_ERROR`, `ROLE_NOT_FOUND`, `SERVER_ERROR`) and the `requestId` in the response.

**Fix in `functions/lib/http.ts`**:

```ts
export function jsonError(
  message: string,
  status: number,
  opts?: { code?: string; details?: unknown; requestId?: string },
): Response {
  return jsonResponse({
    success: false,
    error: { code: opts?.code ?? "SERVER_ERROR", message, details: opts?.details ?? {} },
    requestId: opts?.requestId,
  }, { ...init, status });
}
```

**Fix in `initialize.ts`**: Pass the appropriate code string + requestId at each error site (VALIDATION_ERROR, BAD_REQUEST, ROLE_NOT_FOUND, etc.).

---

## Phase 3: Styling Violations (HIGH)

### 3.1 — Replace hardcoded `text-red-600` with semantic token

**File**: `src/pages/courses/ui/CoursesPage.tsx:97`

**Change**: `text-red-600 font-semibold` → `text-danger-600 font-semibold`

---

### 3.2 — Fix Tailwind v4 dynamic class interpolation in StatsPill

**File**: `src/pages/courses/ui/CoursesPage.tsx` lines 14-16 and 114-140

**Problem**: `defaultStatsColors` map uses string interpolation like `` `${colorClass} ${borderClass} ``, which won't work in Tailwind v4 JIT (classes must be complete strings at build time). The `[&_svg]:${iconClass}` template literal definitely won't work.

**Fix**: Replace runtime dynamic classes with a `cn()`-based conditional or a map of known variant keys:

```tsx
const STATS_STYLES = {
  enrolled: "bg-brand-50 border-brand-100 text-brand-700 [&_svg]:text-brand-500",
  completed: "bg-success-50 border-success-200 text-success-700 [&_svg]:text-success-600",
  inProgress: "bg-warning-50 border-warning-200 text-warning-700 [&_svg]:text-warning-600",
} as const;

<StatsPill className={STATS_STYLES.enrolled} ... />
```

---

### 3.3 — Replace non-semantic colors in CourseSkeleton

**File**: `src/entities/course/ui/CourseSkeleton.tsx`

**Problem**: `bg-gray-200`, `bg-gray-300`, `bg-white`, `border-gray-200` are hardcoded Tailwind colors, not semantic tokens.

**Fix**:
| Before | After |
|--------|-------|
| `bg-white` | `bg-surface-primary` |
| `bg-gray-200` / `bg-gradient-to-br from-gray-200 to-gray-300` | `bg-surface-muted` |
| `border-gray-200` | `border-line-subtle` |

---

## Phase 4: Ponytail — Delete Over-Engineering (MEDIUM)

### 4.1 — Replace duplicated error classes with shared `ApiError`

**Files**: `src/entities/course/api/courseApi.ts`, `src/shared/api/learningPathApi.ts`, `src/features/initialize-learning-path/api/initializeLearningPath.ts`

**Problem**: 3 identical error classes (`CourseApiError`, `LearningPathApiError`, `InitializeLearningPathError`).

**Fix**:
```ts
// src/shared/api/ApiError.ts
export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}
```

Then `CourseApiError` becomes `ApiError`, `InitializeLearningPathError` becomes `ApiError` in the feature file, etc. Remove all 3 redundant class definitions.

---

### 4.2 — Remove `useMemo` on trivial computations

**File**: `src/pages/courses/ui/CoursesPage.tsx`

**Lines to change**:
- `priorityCounts` (lines 51-58): simple loop over small array, no memo needed
- `filteredCourses` (lines 37-40): simple `.filter()`, no memo needed

**Fix**: Replace `useMemo(...)` with plain computed values:

```tsx
const filteredCourses = filterCoursesByPriority(courses ?? [], activePriority);
const totalPages = Math.ceil(filteredCourses.length / COURSE_PAGE_SIZE);
const safePage = getSafeCoursePage(currentPage, totalPages);
const paginatedCourses = paginateCourses(filteredCourses, safePage);

const total = courses?.length ?? 0;
const completed = courses?.filter((c) => c.status === "completed").length ?? 0;
const inProgress = courses?.filter((c) => c.status === "in_progress").length ?? 0;

const priorityCounts: Record<string, number> = {};
if (courses) for (const p of PRIORITIES) priorityCounts[p] = courses.filter((c) => c.priority === p).length;
```

---

### 4.3 — Remove `_userId` unused parameter

**File**: `functions/api/v1/capabilities/queries.ts:56`

**Fix**: Remove the parameter entirely. Update the sole caller in `user.ts` to pass only 2 args.

---

### 4.4 — Remove dead code `getClientIp`, `getUserAgent`

**File**: `functions/lib/http.ts`

**Fix**: Delete both functions. They're exported but never called by any endpoint.

---

### 4.5 — Remove manual retry loop from authStore

**File**: `src/app/store/authStore.ts` — the `fetchAndSetActiveLearningPath` method (40 lines) has a manual 3-attempt retry loop.

**Fix**: After Phase 0 (apiClient exists) and Phase 1 (authStore in entities), replace with a simple call — let the consumer (tanstack-query) handle retry. Or keep the bare fetch but strip the retry loop since the TanStack Query in `fetchAndSetActiveLearningPath`'s callers already handles retries.

Simplest: just await the single call, no retry:

```ts
const path = await fetchActiveLearningPath(accessToken);
set({ activeLearningPath: path, activeLearningPathLoading: false });
```

---

## Phase 5: Environment Validation (HIGH)

### 5.1 — Add Zod env validation on backend

**File**: `functions/shared/` (new file: `functions/shared/env.ts`)

**Fix**: Add Zod schema that validates `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` at startup:

```ts
import { z } from "zod";

const LteEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  COOKIE_DOMAIN: z.string().optional(),
});

export function validateLteEnv(env: Record<string, unknown>) {
  return LteEnvSchema.parse(env);
}
```

Update `functions/lib/auth.ts` or a middleware to call `validateLteEnv(env)` on first access.

---

## Dependency Graph

```
Phase 0 (Infra)
  ├─ P0.1 apiClient  ──┬── unlocks 0 files directly (pre-existing gap)
  │                     └── but needed for future frontend-backend calls
  └─ P0.2 shared/ui/icons  ─── unlocks 4.0 (inline SVGs)

Phase 1 (FSD)
  ├─ 1.1 move authStore to entities/session  ─── unlocks 1.3
  │     └─ P0.2 suggested first (icons prereq not required here)
  ├─ 1.2 move learningPathApi to entities/  ─── independent
  └─ 1.3 fix entity→app import  ─── blocked on 1.1

Phase 2 (Error handling)
  └─ 2.1 structured errors  ─── independent

Phase 3 (Styling)
  ├─ 3.1 text-red-600 → text-danger-600  ─── independent
  ├─ 3.2 Tailwind v4 dynamic classes  ─── independent  
  └─ 3.3 CourseSkeleton semantic tokens  ─── independent

Phase 4 (Ponytail)
  ├─ 4.1 shared ApiError  ─── independent
  ├─ 4.2 remove useMemo  ─── independent
  ├─ 4.3 remove _userId  ─── independent
  ├─ 4.4 remove dead http.ts functions  ─── independent
  └─ 4.5 remove manual retry in authStore  ─── independent (P0.1 nice-to-have)

Phase 5 (Validation)
  └─ 5.1 backend env validation  ─── independent
```

**Independent phases can run in parallel.** Dependencies shown chain only where one fix changes a path another file imports from.

---

## Missed in First Round — 6 Additional Issues

Audited diffs a second time. These were overlooked.

### M6.1 — `accessToken!` non-null assertion bypasses TypeScript

**File**: `src/entities/course/model/useCourses.ts:12`
```ts
queryFn: () => fetchUserCourses(accessToken!),
```

**Problem**: The `!` suppresses `accessToken` being `string | null`. If `enabled: !!accessToken` fails to guard (race on init), this passes `null` to the API. Works today by luck, not correctness.

**Severity**: high

**Fix**: Three options, pick one:
- (A) Use `enabled` as sole guard and cast: fine pragmatically, but brittle
- (B) (Ponytail picks this) Pass token as query key param so the function signature reflects reality:
  ```ts
  queryKey: ["userCourses", accessToken],
  queryFn: ({ queryKey }) => fetchUserCourses(queryKey[1] as string),
  enabled: !!accessToken,
  ```
- (C) Keep `!` + exhaustive test coverage. Risk low but principled objection stands.

---

### M6.2 — Error branch in CoursesPage.tsx doesn't log

**File**: `src/pages/courses/ui/CoursesPage.tsx:93-102`

**Problem**: `.codereview.yml` line 391: "Always log errors using the centralized logging utility (`logger.error`)." The error branch only renders UI — no logger call.

**Severity**: high

**Fix**: Add import and logger call:
```ts
import { getLogger } from "@/shared/lib/logger"; // or wherever getLogger lives
// ...
if (error) {
  getLogger("CoursesPage").error("Failed to load courses", { message: error instanceof Error ? error.message : "unknown" });
  return ( /* existing error JSX */ );
}
```

---

### M6.3 — Zod response validation missing on 2 of 3 frontend APIs

**Files**: `src/entities/course/api/courseApi.ts`, `src/shared/api/learningPathApi.ts`

**Problem**: Both cast API responses with `as T` or `as unknown as T` without Zod `safeParse()`. `initializeLearningPath.ts` does it right (Zod response schema + `safeParse`). `.codereview.yml` line 1061: "external API response validation" with Zod is required.

**Severity**: high

**Fix**: Add Zod response schemas to both files:

**courseApi.ts**:
```ts
const UserCapabilitiesResponseSchema = z.object({
  success: z.boolean(),
  capabilities: z.array(z.object({ /* ... shape */ })),
  count: z.number().optional(),
});
// Then: const data = UserCapabilitiesResponseSchema.parse(await response.json());
```

**learningPathApi.ts**:
```ts
const ActiveLearningPathResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({ learningPathId: z.string(), /* ... */ }).nullable(),
});
```

---

### M6.4 — tsconfig targets ES2020 instead of ES2022

**File**: `lte/tsconfig.json:3-4`

**Problem**: 2026 best practices recommend `ES2022` minimum. `ES2020` is missing `at()`, `Array.fromAsync()`, `Error.cause`, and other stable language features.

**Severity**: low (no current breakage, but constrains future)

**Fix**:
```json
"target": "ES2022",
"lib": ["ES2022", "DOM", "DOM.Iterable"],
```

---

### M6.5 — BREAKING CHANGE in `ErrorResponse` type shape

**File**: `functions/shared/types.ts` (diff)

**Problem**: Old type was `{ error: string }`. New type is `{ success: false, error: { message: string } }`. Any client reading `res.error` as a string (e.g. `JSON.parse(res).error`) will get an object instead and silently fail. This was deployed as part of the current diff but needs a coordinated deploy with any frontend consumers.

**Severity**: critical (silent client breakage)

**Fix**: Add a backward-compat shim in `jsonError()`:
```ts
// In jsonError, also set the legacy flat shape for 1 release cycle:
return jsonResponse({
  success: false,
  error: { message: error },     // new shape
  error_string: error,           // legacy compat — remove next release
}, { ...init, status });
```
Or coordinate a deployment where frontend lands first, then backend. Document in the PR that this is a breaking change requiring explicit approval per `04-database-api-standards.md` §12.5.

---

### M6.6 — StatsPill SVG icon color is broken in production (not just lint)

**File**: `src/pages/courses/ui/CoursesPage.tsx:117`

**Problem**: The `[&_svg]:${defaultStatsColors.enrolled.icon}` template literal (`text-brand-500` etc.) is a **functional bug** (already flagged in 3.2 as styling, but the consequence is runtime-broken icons). Tailwind v4 scans source for complete class strings at build time. Runtime-concatenated `[&_svg]:text-brand-500` produces no CSS. The SVG icons render with `currentColor` (likely `#000` or inherited) instead of the branded token.

**Severity**: high (visible production breakage)

**Fix**: Same as 3.2 — use complete class strings in a `STATS_STYLES` const map. This is now grouped under 3.2 with elevated urgency.

---

### M6.7 — Two new backend endpoints deployed without tests

**Files**: `functions/api/v1/capabilities/user.ts` (new), `functions/api/v1/learning-paths/active.ts` (new)

**Problem**: `.codereview.yml` line 1810: "Every new module must have a corresponding unit test file... PRs that add new components or utilities without accompanying tests will be blocked from merge." Both new endpoints have zero test coverage. The `__tests__/` dir for capabilities doesn't even exist.

**Severity**: high

**Fix**: Add `functions/api/v1/capabilities/__tests__/user.test.ts` and `functions/api/v1/learning-paths/__tests__/active.test.ts`. Follow the pattern from `initialize.test.ts` (mock `requireAuth`, `createServiceSupabase`, test 401/403/500 error paths + success path).

---

### M6.8 — TOCTOU race condition in upsert functions (no unique constraint)

**Files**: `functions/api/v1/learning-paths/queries.ts` — `upsertLearningTrack` (lines 103-148) and `upsertLearningPath` (lines 169-210)

**Problem**: Both use check-then-act pattern (SELECT → decide UPDATE or INSERT). Between the SELECT and the INSERT, a concurrent request could insert a matching row, causing a unique constraint violation. The code comments acknowledge this: `// Query first because there is no unique constraint/index on (user_id, assessment_id, track)` and `// Mirror upsertLearningTrack: check first...`.

The fixes are structurally different so they need separate handling:

**`upsertLearningTrack`**: Add a DB unique constraint on `(user_id, assessment_id, track)`, then switch to `supabase.from("learning_tracks").upsert()` with `onConflict` to handle it atomically.

**`upsertLearningPath`**: The natural key is `(user_id, learning_track_id, role_id)`. Same fix: add unique constraint, switch to `upsert()`.

**Migration required**: Create a Supabase migration (`supabase/migrations/`) for the unique constraint. Per `04-database-api-standards.md`, this is a schema change (DDL) and belongs in a migration file.

**Severity**: high (potential silent data corruption under concurrent load)

---

### M6.9 — `useCourses` hook has no corresponding test

**File**: `src/entities/course/model/useCourses.ts` (new, untracked)

**Problem**: New module exported via entity public API, used by `CoursesPage.tsx`. Zero test coverage. Same `.codereview.yml` rule as M6.7 applies.

**Severity**: high

**Fix**: Create `src/__tests__/courses/hooks/useCourses.test.ts` (note: approved test structure uses `hooks/` per `.codereview.yml`). Test: returns loading/error/data states, enables only when accessToken is set, doesn't retry on 4xx.

---

### M6.10 — Unhandled JSON parse error in `courseApi.ts`

**File**: `src/entities/course/api/courseApi.ts:49`

```ts
const data: UserCapabilitiesApiResponse = await response.json();
```

**Problem**: If the response body is malformed JSON, `response.json()` throws. The first `response.json()` call (line 48) is inside an `if (!response.ok)` block and has `.catch(() => null)`. But this second call (line 49, success path) has no `.catch()`. The error bubbles up to TanStack Query's error boundary but is never logged at source.

**Severity**: medium

**Fix**: Wrap in try/catch or add `.catch()`:
```ts
const data = await response.json().catch(() => { throw new CourseApiError("Invalid JSON response from server"); });
```

---

### M6.15 — `.env.example` missing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

**File**: `lte/.env.example`

**Problem**: The backend functions need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for local development, but `.env.example` only documents frontend variables. New developers have no discoverable reference for what backend env vars are required.

**Severity**: medium (blocks local backend testing for new devs)

**Fix**: Add to `.env.example`:

```env
# Supabase (required for local backend functions)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### M6.16 — Theme missing `danger-*` semantic token family (blocks 3.1 fix)

**File**: `src/app/styles/index.css` — `@theme` block (lines 7-112)

**Problem**: Issue 3.1 proposes replacing `text-red-600` with `text-danger-600`, but `danger-*` tokens are not defined in the theme. Without adding them first, `text-danger-600` will produce a dead CSS class.

**Severity**: medium (blocks the 3.1 fix)

**Fix**: Add to the `@theme` block in `index.css`:

```css
/* ── Danger (red, for errors / destructive actions) ── */
--color-danger-50: #fef2f2;
--color-danger-100: #fee2e2;
--color-danger-200: #fecaca;
--color-danger-500: #ef4444;
--color-danger-600: #dc2626;
--color-danger-700: #b91c1c;
```

Also check if any other files reference `red-*` or `error-*` colors that should use `danger-*` instead.

---

### M6.17 — Inconsistent logger import path (`courseApi.ts` uses deep import)

**File**: `src/entities/course/api/courseApi.ts:6`

**Problem**: `.codereview.yml` rule "Use slice public APIs" says to prefer barrel imports (`@/shared`) over deep imports (`@/shared/config/logging`). `authStore.ts` uses the barrel (`import { getLogger } from "@/shared"`), but `courseApi.ts` uses a deep path (`import { getLogger } from "@/shared/config/logging"`). Inconsistent and violates the import consistency rule.

**Severity**: low (no runtime impact — both import forms resolve correctly)

**Fix**: Change to barrel import:

```ts
import { getLogger } from "@/shared";
```

This is already exported via `@/shared` → `export * from "./config"` → `export * from "../config/logging"`. No other barrel changes needed.

---

## Updated Dependency Graph (with all items)

```
Phase 0 (Infra)
  ├─ P0.1 apiClient  ──┬── unlocks 0 files directly
  │                     └── needed for future frontend-backend calls
  └─ P0.2 shared/ui/icons  ─── unlocks 4.0 (inline SVGs)

Phase 1 (FSD)
  ├─ 1.1 move authStore to entities/session  ─── unlocks 1.3
  ├─ 1.2 move learningPathApi to entities/  ─── independent
  └─ 1.3 fix entity→app import  ─── blocked on 1.1

Phase 2 (Error handling)
  ├─ 2.1 structured errors  ─── independent
  ├─ M6.2 missing error logging in CoursesPage  ─── independent
  ├─ M6.5 BREAKING ErrorResponse type shape  ─── requires coordinated deploy
  └─ M6.10 unhandled JSON parse error in courseApi  ─── independent

Phase 3 (Styling)
  ├─ 3.1 text-red-600 → text-danger-600  ─── independent
  ├─ 3.2 Tailwind v4 dynamic classes  ─── independent (ALSO FIXES M6.6 — broken icons)
  ├─ 3.3 CourseSkeleton semantic tokens  ─── independent
  └─ M6.4 ES2020 → ES2022  ─── independent

Phase 4 (Ponytail)
  ├─ 4.1 shared ApiError  ─── independent
  ├─ 4.2 remove useMemo  ─── independent
  ├─ 4.3 remove _userId  ─── independent
  ├─ 4.4 remove dead http.ts functions  ─── independent
  ├─ 4.5 remove manual retry in authStore  ─── independent
  └─ M6.1 accessToken! fix  ─── independent

Phase 5 (Validation)
  ├─ 5.1 backend env validation  ─── independent
  └─ M6.3 Zod response validation on frontend APIs  ─── independent

Phase 6 (Infrastructure) — REQUIRES DB MIGRATION
  └─ M6.8 TOCTOU race condition in upsert functions  ─── needs migration file + code change

Phase 7 (Testing gaps)
  ├─ M6.7 no tests for user.ts and active.ts endpoints  ─── independent
  └─ M6.9 no test for useCourses hook  ─── independent
```

```
Phase 3 (Styling)
  ├─ 3.1 text-red-600 → text-danger-600  ─── independent
  ├─ 3.2 Tailwind v4 dynamic classes  ─── independent (NOW ALSO FIXES M6.6 — broken icons in prod)
  ├─ 3.3 CourseSkeleton semantic tokens  ─── independent
  └─ M6.4 ES2020 → ES2022  ─── independent

Phase 4 (Ponytail)
  ├─ 4.1 shared ApiError  ─── independent
  ├─ 4.2 remove useMemo  ─── independent
  ├─ 4.3 remove _userId  ─── independent
  ├─ 4.4 remove dead http.ts functions  ─── independent
  ├─ 4.5 remove manual retry in authStore  ─── independent
  └─ M6.1 accessToken! fix  ─── independent (1-min change)

Phase 5 (Validation)
  ├─ 5.1 backend env validation  ─── independent
  └─ M6.3 Zod response validation on frontend APIs  ─── independent

Phase 2 (Error handling)
  ├─ 2.1 structured errors  ─── independent
  ├─ M6.2 missing error logging in CoursesPage  ─── independent
  └─ M6.5 BREAKING ErrorResponse type shape  ─── requires coordinated deploy
```

---

## Test Impact

| Change | Tests to update |
|--------|----------------|
| 1.1 move authStore | `src/__tests__/auth/store/authStore.test.ts` — update import path |
| 1.2 move learningPathApi | `src/__tests__/shared/api/learningPathApi.test.ts` — move + update import |
| 2.1 structured errors | `functions/api/v1/learning-paths/__tests__/initialize.test.ts` — update expected error code assertions |
| 3.2 Tailwind dynamic classes | No test change — purely CSS class naming |
| 4.2 remove useMemo | No test change — functional identity |
| 4.3 remove `_userId` | `functions/api/v1/capabilities/user.ts` — update caller signature |
| 4.5 remove manual retry | `authStore.test.ts` may need update if testing retry behavior |

---

## Files Not Modified

Clean passes from the changed set (no modifications needed but re-test after adjacent fixes):

| File | Status |
|------|--------|
| `functions/shared/types.ts` | ✓ valid (ErrorResponse shape flagged in M6.5) |
| `src/entities/course/model/types.ts` | ✓ valid (CourseRole removal clean — zero consumers) |
| `src/pages/courses/model/courseFilters.ts` | ✓ valid |
| `src/features/initialize-learning-path/model/*.ts` | ✓ valid |
| `src/features/initialize-learning-path/api/initializeLearningPath.ts` | ✓ valid (P0.1 would modernize but not required) |
| `src/__tests__/courses/components/CourseCard.test.tsx` | ✓ valid |
| `src/__tests__/courses/pages/Courses.test.tsx` | ✓ valid |

## Files Requiring Changes (20 total)

| File | Issues |
|------|--------|
| `functions/api/v1/capabilities/queries.ts` | 4.3, M6.8 |
| `functions/api/v1/capabilities/types.ts` | M6.7 (no test) |
| `functions/api/v1/capabilities/user.ts` | M6.7 (new, no test) |
| `functions/api/v1/learning-paths/queries.ts` | M6.8 (TOCTOU race) |
| `functions/api/v1/learning-paths/initialize.ts` | 2.1 (error codes) |
| `functions/api/v1/learning-paths/active.ts` | M6.7 (new, no test) |
| `functions/api/v1/learning-paths/__tests__/initialize.test.ts` | 2.1 (update assertions) |
| `functions/lib/http.ts` | 2.1, 4.4, M6.5 |
| `functions/shared/env.ts` | 5.1 (new file) |
| `src/app/store/authStore.ts` | 1.1 (move) |
| `src/entities/course/index.ts` | 1.3 (update import) |
| `src/entities/course/model/useCourses.ts` | 1.3, M6.1, M6.9 (no test) |
| `src/entities/course/api/courseApi.ts` | M6.3, M6.10 |
| `src/entities/course/ui/CourseCard.tsx` | P0.2 |
| `src/entities/course/ui/CourseSkeleton.tsx` | 3.3 |
| `src/features/initialize-learning-path/ui/LearningPathInitializer.tsx` | 1.3 (update import) |
| `src/pages/courses/ui/CoursesPage.tsx` | 3.1, 3.2, M6.2, 4.2 |
| `src/shared/api/index.ts` | P0.1 (rewrite) |
| `src/shared/types/auth.ts` | 1.2 |
| `lte/tsconfig.json` | M6.4 |
