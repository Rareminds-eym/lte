# Dashboard API Implementation Plan

**Date**: 2026-07-28
**Status**: Plan
**Endpoint**: `GET /api/v1/dashboard`

---

## Contract: Response Shape

The endpoint returns the 7 existing frontend widget sections **unchanged** plus 2 new server-computed fields.

```typescript
// BFF-shaped for the existing frontend
interface DashboardResponse {
  // 7 existing sections (zero widget changes needed)
  careerTarget:      CareerTargetData;
  journey:           CurrentJourneyData;
  priorities:        TodaysPrioritiesData;
  capabilityGaps:    CapabilityGapItem[];
  upcomingFeedback:  UpcomingFeedbackData;
  careerPaths:       RecommendedCareerPathsData;
  achievements:      AchievementsData;

  // 2 new fields
  nextAction: NextAction;         // TRD §25.2 — server-computed
  xp:         XpSummary;          // aggregated XP counters
}
```

### New types

```typescript
interface NextAction {
  action: string;   // 'select_role' | 'resubmit' | 'review_feedback' | 'continue_stage'
                    // | 'submit_artifact' | 'start_stage' | 'improve_readiness'
  label: string;
  target?: string;
}

interface XpSummary {
  evidence: number;
  engagement: number;
  total: number;
  nextMilestone: number;
}
```

---

## Files to Create (5)

### 1. `functions/api/v1/dashboard/types.ts`

- `LearnerState` interface (mock for now, real DB later)
- `DashboardResponse` interface
- `NextAction` type
- `computeXpSummary()` helper
- `MOCK_LEARNER_STATE` constant
- `MOCK_DASHBOARD_RESPONSE` constant (moved from frontend `dashboardApi.ts`)
- Test data helpers

### 2. `functions/api/v1/dashboard/schemas.ts`

- Zod schema for future query param validation (empty now, ready for `?org_id=`)
- Zod schema for response shape validation (optional, can be used in tests)

### 3. `functions/api/v1/dashboard/next-action.ts`

Pure function `computeNextAction(learnerState: LearnerState): NextAction`

Implements the TRD §25.2 7-step priority waterfall:

```
1. No role assigned              → select_role
2. Resubmission required          → resubmit
3. Unread feedback                → review_feedback
4. In-progress stage              → continue_stage
5. Learning-complete, no artifact → submit_artifact
6. Next unlocked stage            → start_stage
7. All courses complete           → improve_readiness
```

Takes `LearnerState` (currently mocked, future: hydrated from DB tables).

### 4. `functions/api/v1/dashboard/queries.ts`

Stub file with typed function signatures for future DB queries:

```typescript
// Future: when progress tables exist, these will be implemented
export async function getLearnerState(supabase, userId, orgId): Promise<LearnerState>
export async function getCareerPaths(supabase, userId, orgId): Promise<RecommendedCareerPathsData>
// ...
```

Empty bodies for now. Makes the migration path explicit.

### 5. `functions/api/v1/dashboard/index.ts`

`onRequestGet` handler — the endpoint itself:

```typescript
export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  // 1. Authenticate — requireAuth(context.request, context.env)
  // 2. (Future) validate optional query params with Zod
  // 3. (Future) hydrate LearnerState from DB queries
  // 4. Compute nextAction = computeNextAction(MOCK_LEARNER_STATE)
  // 5. Compute xpSummary = computeXpSummary(MOCK_LEARNER_STATE)
  // 6. Merge MOCK_DASHBOARD_RESPONSE + nextAction + xpSummary
  // 7. Return jsonResponse<DashboardResponse>(merged)
}
```

Pattern matches existing `functions/api/v1/capabilities/index.ts`:
- `try/catch` wrapping
- `requireAuth` for auth
- `jsonResponse` / `jsonError` for responses
- Structured error logging via `logger`

---

## Files to Modify (2)

### 6. `src/entities/dashboard/model/types.ts`

Append to the existing `DashboardData` interface:

```typescript
export interface NextAction { ... }     // new
export interface XpSummary { ... }      // new

// Extend existing DashboardData:
export interface DashboardData {
  // ... existing 7 sections stay exactly as-is ...
  nextAction: NextAction;       // new
  xp: XpSummary;               // new
}
```

### 7. `src/entities/dashboard/api/dashboardApi.ts`

Replace the entire file. Remove `MOCK_DASHBOARD_DATA`. Wire to real endpoint:

```typescript
import { apiGet } from "@/shared/api";
import type { DashboardData } from "../model/types";

export const fetchDashboardData = async (): Promise<DashboardData> => {
  return apiGet<DashboardData>("/api/v1/dashboard");
};
```

### 8. `src/shared/api/index.ts` (add apiGet/apiPost wrappers)

Add typed HTTP method wrappers that inject auth headers from the auth store:

```typescript
import { useAuthStore } from "@/app/store";
import type { AuthUser } from "@/shared/types/auth";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error ?? response.statusText;
    throw new ApiError(message, response.status, body);
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(url: string): Promise<T> {
  return request<T>(url, { method: "GET" });
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(url: string): Promise<T> {
  return request<T>(url, { method: "DELETE" });
}

export { ApiError };
```

This is the **centralized HTTP client** that the codereview.yml mandates — all backend communication goes through it, auth headers are injected automatically, errors are standardized.

---

## Exports to Update

### 9. `src/shared/api/index.ts` — export all named wrappers

The barrel file should export everything. The existing `fetchJSON` can remain or be removed (nothing else uses it currently).

### 10. `src/entities/dashboard/index.ts` — no change needed

Already exports `*` from `./api/dashboardApi` and `./model/types`. New types (`NextAction`, `XpSummary`) are in `types.ts` so they automatically propagate.

---

## Corrections & Additions

### apiGet/Post Content-Type Handling

`request()` must NOT set `Content-Type: application/json` for GET/DELETE — some servers reject it:

```typescript
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Only set Content-Type for methods with bodies
  if (options.method && !["GET", "DELETE"].includes(options.method)) {
    headers.set("Content-Type", "application/json");
  }
  // ...
}
```

### Error Logging in apiClient

The `request()` function should log via the shared logger:

```typescript
import { getLogger } from "@/shared/config/logging";
const apiLogger = getLogger("apiClient");
// In error handler:
apiLogger.error("API request failed", { url, method: options.method, status: response.status });
```

### fetchJSON Removal

The existing `fetchJSON` function should be removed from `src/shared/api/index.ts` since `apiGet`/etc. replace it. Nothing else imports it currently. Removal avoids having two HTTP clients.

### CORS

Cloudflare Pages Functions handle CORS via `_headers` file or the `functions/middleware/cors.ts` (if it exists). The dashboard endpoint inherits whatever CORS config the rest of the API uses. No special CORS handling needed.

### Test File Paths (corrected)

The existing test files are at:

| Test file | Action |
|-----------|--------|
| `src/__tests__/dashboard/api/dashboardApi.test.ts` | **UPDATE** — mock data removed, test now mocks `apiGet` |
| `src/__tests__/dashboard/model/useDashboardData.test.tsx` | **UPDATE** — hook unchanged but API mock changes |
| `src/__tests__/dashboard/page/Dashboard.test.tsx` | **UPDATE** — page unchanged |
| `src/__tests__/dashboard/widgets/DashboardWidgets.test.tsx` | **UPDATE** — widgets unchanged |
| `src/__tests__/dashboard/layout/DashboardLayout.test.tsx` | **UPDATE** — layout unchanged |
| `functions/api/v1/dashboard/__tests__/dashboard.test.ts` | **NEW** — backend handler + next-action tests |

| Test file | What it covers |
|-----------|---------------|
| `functions/api/v1/dashboard/__tests__/dashboard.test.ts` | **NEW** — handler auth, mock response shape, error cases, next-action logic |
| `src/__tests__/dashboardApi.test.ts` | **MODIFY** — now tests real HTTP call (mocked via MSW/tanstack) |
| `src/__tests__/useDashboardData.test.tsx` | **UPDATE** — still valid, hook unchanged |
| `src/__tests__/Dashboard.test.tsx` | **UPDATE** — still valid, page unchanged |
| `src/__tests__/DashboardWidgets.test.tsx` | **UPDATE** — still valid, widgets unchanged |

Backend test structure follows the existing `functions/` pattern (Vitest).

---

## Codereview.yml Compliance Matrix

| Rule | Status | How |
|------|--------|-----|
| Endpoint versioning | ✅ | `/api/v1/dashboard` |
| requireAuth / withAuth | ✅ | `requireAuth()` from `functions/middleware/auth.ts` |
| TanStack Query | ✅ | `useDashboardData` unchanged — still uses `useQuery` |
| Zod validation | ✅ | Backend validates params; frontend validates response shape |
| Strict FSD layers | ✅ | handler in `functions/`, entity in `src/entities/dashboard/`, wrappers in `src/shared/api/` |
| No frontend-backend imports | ✅ | Backend mock is self-contained in `functions/` |
| apiGet/apiPost (not raw fetch) | ✅ | Added to `src/shared/api/index.ts`; dashboard uses `apiGet` |
| Logger usage | ✅ | Backend uses `logger` from `functions/lib/` |
| Tests required | ✅ | Backend test + existing frontend tests updated |
| apiGet auth header injection | ✅ | `request()` reads `accessToken` from `useAuthStore` |
| No `console.*` in production | ✅ | Uses `logger` utility |
| Shared stays business-agnostic | ✅ | `apiGet`/`apiPost` are generic HTTP wrappers, no dashboard logic |
| Entity owns domain types | ✅ | `DashboardData`, `NextAction`, `XpSummary` in `entities/dashboard/model/types.ts` |
| Page only composes widgets | ✅ | `Dashboard.tsx` already does this — no change |

---

## Migration Path (Future Phases)

| Phase | What | Trigger |
|-------|------|---------|
| **1** (now) | `GET /api/v1/dashboard` returns mock data, real auth, real pipeline structure | This plan |
| **2** | Progress DB migrations (13 tables) created as SQL files | When readiness/artifact/AI features are built |
| **3** | `queries.ts` functions swapped from mock to real Supabase queries | After migrations run |
| **4** | New sections added to response (`roadmap`, `courseProgress`, `sixEProgress`, `artifactStatus`, `aiFeedback`, `readiness`, `marketplace`) | When corresponding widgets are built |
| **5** | `nextAction` engine receives real `LearnerState` from DB instead of mock | After phase 2+3 |

---

## Implementation Order

```
1. src/shared/api/index.ts       → add apiGet/apiPost/apiPut/apiPatch/apiDelete + ApiError
2. functions/.../types.ts        → response types + mock data (move from frontend)
3. functions/.../next-action.ts  → computeNextAction() pure function
4. functions/.../schemas.ts      → Zod schemas
5. functions/.../queries.ts      → stub DB function signatures
6. functions/.../index.ts        → onRequestGet handler
7. functions/.../__tests__/...   → backend tests
8. src/.../model/types.ts        → add NextAction + XpSummary to DashboardData
9. src/.../api/dashboardApi.ts   → replace mock with real apiGet call
10. Run tests, verify
```