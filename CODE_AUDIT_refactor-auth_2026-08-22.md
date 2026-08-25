# Deep Code Audit — `refactor/auth` vs `dev`

| | |
|---|---|
| **Repository** | `lte/` (Cloudflare Pages + Pages Functions, FSD frontend) |
| **Branch audited** | `refactor/auth` @ `ed07fe9` |
| **Base** | `dev` @ `162c340` (2026-08-11) |
| **Commits ahead** | 8 |
| **Audit date** | 2026-08-22 |
| **Ruleset** | `lte/.codereview.yml` (branch's own updated version, per audit decision) |
| **Diff size** | ~4,200 lines across 67 files (excluding vendored xlsx ~28k lines and generated `graphify-out/`) |
| **Method** | 5 parallel review scopes (backend auth/edge · frontend auth/state core · UI/pages/features · tests/config/deps · follow-up restatement) + dedicated backend-endpoints review (`journey`, `readiness`, `preview`, `capabilities`, `profile`, xlsx import sites) + cross-cutting diff greps + independent verification of every critical claim |

## Branch Themes

1. Migration from npm-published `@rareminds-eym/auth-client@1.0.12` / `auth-core@2.1.2` to local monorepo packages via `file:` links, plus new `identity-client`, `sso-gateway`, `entitlements` packages
2. Deletion of legacy auth surface: `functions/api/v1/auth/{logout,me,refresh}.ts`, `functions/lib/cookies.ts`, `functions/lib/sso-client.ts`, frontend `src/shared/api/authApi.ts` (+ their tests)
3. SSO code exchange rewritten: gateway delegation in `[[path]].ts`, blocking LTE product provisioning call
4. Industrial-grade resilience work (global error handlers, TanStack retry policy, ApiError metadata, ErrorBoundary additions, waitUntil fixes)
5. Vendored xlsx (`vendor/sheetjs/xlsx-0.20.3/`) replacing CDN tarball dependency
6. Settings profile-strength progress bar styling alignment

---

## Verification Results

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) | ✅ PASS |
| `npx vitest run` | ✅ 131 files, **1163 passed / 1 skipped** (197.6s) |
| Dangling refs to deleted modules (`lib/sso-client`, `lib/cookies`, `v1/auth/logout\|me\|refresh`, `shared/api/authApi`) | ✅ None in code (stale `.md` docs only) |
| `console.*` added in diff (src/, functions/) | ✅ Zero |
| Arbitrary hex color utilities added (`text-[#…]` etc.) | ✅ Zero |
| `supabase.auth.*` usage added | ✅ Zero |

### Disproven Subagent Claim

One subagent reported "password-validation test gutted" as CRITICAL. **Verified false**: `functions/api/v1/settings/__tests__/password.test.ts` was rewritten and *expanded* (~5 → 9 cases, adding error-leak, default-message, and sanitized-failure checks). Discarded.

---

# 🔴 CRITICAL

## C1 — Build is non-portable: `file:` dependencies point outside the repo

> **STATUS: RESOLVED (2026-08-24, verified by container build).** Packages published to GitHub Packages (`auth-client@2.0.0`, `auth-core@3.0.0`, `identity-client/sso-gateway/entitlements@1.0.0`); `package.json` repointed to exact registry versions; `package-lock.json` regenerated (zero sibling-path entries, registry `resolved` + integrity for all five); clean `npm ci` verified. **Post-resolution sweep found and removed six stale vite aliases** (`vite.config.ts:20-25`) that still hard-wired all `@rareminds-eym/*` imports to the sibling checkout — the bundler bypassed node_modules entirely, so builds remained non-portable until deleted. Dockerfile additionally fixed for registry auth (`--secret id=npm_token`, install-stage-only) **and** a pre-existing outDir mismatch (`/app/build` → `/app/dist`; vite emits `dist/`). End-to-end `docker build` verified green in a container with no sibling checkout present.

**Location**: `package.json:8-13`

```json
"@rareminds-eym/auth-client": "file:../skill-echosystem-packages/auth-client",
"@rareminds-eym/auth-core": "file:../skill-echosystem-packages/auth-core",
"@rareminds-eym/identity-client": "file:../skill-echosystem-packages/identity-client",
"@rareminds-eym/sso-gateway": "file:../skill-echosystem-packages/sso-gateway",
"@rareminds-eym/entitlements": "file:../skill-echosystem-packages/entitlements"
```

**Evidence (verified)**:
- `../skill-echosystem-packages/` exists locally only; it is outside this repo and not fetched by CI.
- `.github/workflows/ci.yml`: single `actions/checkout@v4` (line 19) → `npm ci` (line 30). No sibling checkout step. `npm ci` fails or resolves broken links on any machine without the sibling checkout.
- `Dockerfile`: `COPY package*.json ./` (line 7) → `RUN npm ci` (line 10) runs **before** any other source is copied → unresolvable.
- `package-lock.json` contained 5 `"resolved"` entries pointing at `../skill-echosystem-packages/*`.

**Rule violated**: Dependency security / portability (`.codereview.yml` stack + workspace standards).

**Fix applied**: publish to private registry (GitHub Packages via `.npmrc` + `NPM_TOKEN`), exact-version pins, lockfile regen, `scripts/publish-packages.sh` helper, Docker build-secret wiring.

## C2 — Media viewers have no ErrorBoundary: render-phase crash unmounts entire app

**Location**: `src/entities/course/ui/resource-content-viewer/ResourceContentViewer.tsx:40-45` (mounts `PdfContentViewer.tsx`)

The lazy PDF viewer is wrapped only in `<Suspense fallback={<ViewerFallback/>}>`. There is **zero `<ErrorBoundary>` anywhere under `resource-content-viewer/`**, so a render-phase or lazy-chunk-load crash propagates to the single root boundary in `AppProviders.tsx:8` and unmounts the whole application.

Note: the diff's *added* async try/catch correctly covers canvas render promises (verified clean); this gap is specifically render-phase/lazy-chunk crashes.

**Rule violated**: "Granular UI Error Boundaries & Blast Radius Containment" (critical) — media viewers are explicitly named.

**Fix**: wrap each lazy viewer branch inside `ResourceContentViewer` with its own `<ErrorBoundary FallbackComponent={…}>` offering contextual recovery (e.g., "open resource in new tab" retry).

---

# 🟠 HIGH

## H1 — Provisioning failure still issues a session; provisioning writes non-atomic

**Locations**: `functions/api/v1/auth/sso/exchange.ts:63-88` → `sso-worker/src/index.ts:2289-2358`

- `exchange.ts` makes `provisionLteAccess` a **blocking** RPC but treats failure as non-fatal: logs and swallows both the `{success:false}` return (line 67) and thrown errors (line 78), then issues tokens + refresh cookie anyway. The code comment (line 60) admits subsequent `get_jwt_claims()` rotation "may still fail until fixed" → user holds a session whose next rotation breaks.
- The provisioning implementation executes **4 sequential PostgREST calls with no transaction**: products upsert → membership lookup → `organization_products` upsert (:2325) → `membership_products` upsert (:2344); each step just returns `{success:false}` on failure — org can get the product while the membership doesn't, or vice versa.

**Rule violated**: "Multi-Table Transactional Integrity" (critical); semantic status/fail-fast.

**Fix**: collapse into one Postgres RPC called once, or implement compensating rollback saga. On failure, either fail the exchange (503 + requestId) or register a `waitUntil` retry instead of issuing a known-bad session.

## H2 — Gateway outage masquerades as 404

**Location**: `functions/[[path]].ts:38-44`

On gateway dispatch failure the error is logged via `apiLogger.error`, then execution falls through to `jsonError("Not Found", 404)` — browser auth clients receive a misleading 404 during a server-side outage. The yml explicitly names "falling through to 404 during SSO dispatch" as a violation pattern for silent catches.

**Fix**: inside the catch, `return jsonError("Authentication service unavailable", 502, { requestId })` instead of continuing.

## H3 — Stage-lock redirect regression on LevelContentPage

**Location**: `src/pages/level-content/ui/LevelContentPage.tsx:264-268`

Rewritten lock-correction effect:

```ts
fallbackStage = (prev.get("stage")?.toLowerCase() as LteStage | null) || routeFirstIncompleteStage;
if (prev.get("stage") === fallbackStage) return prev;
```

When any stage param exists it always early-returns — which is exactly the locked case (`isRouteStageLocked && routeFirstIncompleteStage`). Deep-linking a locked stage now renders its content instead of redirecting to the first incomplete stage (dev behavior). Additionally the bare `as LteStage` cast skips the existing `isLteStageName()` validator.

**Fix**: when locked, unconditionally set the param to `routeFirstIncompleteStage`; validate pre-existing values with `isLteStageName()` before trusting them.

## H4 — sync-shadow partial commits after OAuth code consumption

**Location**: `functions/lib/sync-shadow.ts:166-216` (with interaction at `exchange.ts:114-118`)

`users` upsert (:183) and `subscription_cache` upsert (:210) run sequentially with no atomicity; second-write failure leaves partially committed shadow state. Because exchange surfaces that as a 500 **after** the SSO code was already consumed, the client gets neither refresh cookie nor a retryable flow (idempotent upserts only heal on next login).

**Fix**: move both writes into a single Postgres RPC, or explicitly document idempotent-retry semantics and make the endpoint tolerant.

## H5 — Silent catch swallows logout transport errors

**Location**: `src/entities/session/model/authStore.ts:165-167`

```ts
} catch { // Ignore logout transport errors }
```

Zero logging; server-side session may remain live while the client silently reports logged-out. Violates "Strict Prohibition of Empty or Silent Catch Blocks" for network I/O.

**Fix**: add `logger.warn("Logout transport failed", …)` inside the catch (keep the `finally` cleanup, which correctly runs `queryClient.clear()`).

## H6 — Raw `fetch()` bypasses approved API client in authStore.exchangeCode

**Location**: `src/entities/session/model/authStore.ts:98-121`

`await fetch("/api/v1/auth/sso/exchange", {…})` is a raw fetch to a project endpoint — no timeout, no tracing, no standard error parsing; the manual response parser (:115-120) throws plain `Error(msg)`, discarding HTTP status/code/requestId. Flagged independently by two scopes. This is the sole raw-fetch violation; the rest of the migration routes through approved clients.

**Fix**: route through `apiFetch("/api/v1/auth/sso/exchange", { method:"POST", credentials:"include", body })` and rethrow the resulting `ApiError` (or use an approved auth-client exchange method).

---

# 🟡 MEDIUM

| # | Location | Issue | Fix |
|---|----------|-------|-----|
| M1 | `functions/api/v1/auth/sso/exchange.ts:48-50` | Raw `err.message` from SSO binding RPC returned verbatim to client on the 401 path (info disclosure; shape carried over from dev) | Log full detail server-side; return generic `"Authentication failed"` + `requestId` |
| M2 | `exchange.ts:39,63` | Direct `SSO_SERVICE.exchangeAuthorizationCode()` / `.provisionLteAccess()` RPC calls have **no timeout** (gateway and auth-core internal paths set `ssoRequestTimeoutMs: 5000`; these raw calls have nothing) — hung SSO worker stalls the isolate | Race against bounded timeout (~8s) or reuse shared typed client that enforces it |
| M3 | `exchange.ts` (whole file) | No rate limiting on OAuth code-exchange endpoint; yml explicitly lists "auth exchanges"; existing `middleware/rate-limiter.ts` unused here; each request now costs more due to blocking provisioning (pre-existing gap, worsened by this change) | Apply existing limiter backed by KV/DO (not in-memory Map) |
| M4 | `functions/[[path]].ts:19-35`, `functions/middleware/auth.ts:10-54` | `createAuth`/`createSsoGateway` re-instantiated **per request** — defeats any per-instance JWKS cache in auth-core, adds extra `getJwks` RPC subrequest per authenticated request against the 32-subrequest budget | Memoize at module level keyed by binding reference; keep `resetAuthInstance()` for tests |
| M5 | `src/entities/session/model/authStore.ts:63-69,141-147` | When `authClient.getMe()` fails, stores `isAuthenticated: true` with `user: null`; route gates keyed on `isAuthenticated` render user-dependent screens against a null user | Only set `isAuthenticated:true` when `identityResult.status === "succeeded"` (or force logout on identity failure) |
| M6 | `src/entities/course/model/useCapabilityLevels.ts:28` | `queryKey: ["capabilityLevels", capabilityCode]` omits user identity — any account switch without full logout serves previous learner's levels (logout clear covers full logout only) | Add `userId` from `useAuthStore((s)=>s.user?.id)` to key |
| M7 | Multiple modules (see Missing Tests section) | Zero test coverage for heavily rewritten/new critical-path code: exchange, gateway routing, apiFetch prod path, queryClient retry policy | Prioritize exchange + gateway + client prod path |
| M8 | `functions/api/v1/auth/__tests__/` empty; spa-fallback tests pass only because mock env omits `SSO_SERVICE` | Deleted `me.test.ts` never replaced; new gateway delegation branch untested | Add `exchange.test.ts` (provisioning failure paths, cookie flags, waitUntil) + gateway-routing tests for `[[path]].ts` |
| M9 | `src/shared/api/authClient.ts:4-7` | Hardcoded `namespace:"lte-auth"`, `csrf:{name:"X-RM-CSRF",value:"1"}` inline instead of `shared/config` | Move constants to `@/shared/config` |
| M10 | `src/entities/session/model/authStore.ts:3-4`, `src/main.tsx:5`, `src/features/start-assessment/ui/StartAssessmentButton.tsx:3` | Deep imports bypass slice barrels (`@/shared/api/authClient`, `@/shared/config/logging`) though all re-export via `index.ts` | Import via `@/shared/api` / `@/shared/config` / `@/shared` |

---

# 🔵 LOW

| # | Location | Issue |
|---|----------|-------|
| L1 | `functions/shared/types.ts:20,101-115` | `LteEnv.SSO_SERVICE: unknown` + `[key:string]:unknown` index signature — typo'd RPC method name compiles fine (strict `SsoRpcService` deleted). Drop index signature; declare exact method set |
| L2 | `exchange.ts:91-94` | Cookie name/attrs/max-age (`__Host-rm-refresh`, `Secure;HttpOnly;Path=/;SameSite=Strict`, `604800`) hand-rolled, duplicating sso-gateway's `cookie-codec` constants (names verified consistent today) |
| L3 | `exchange.ts:26-33,128-134` | Malformed/non-JSON body throws out of `readJsonObject` into outer catch → 500 `AUTH_EXCHANGE_FAILED`; bad client body is 4xx territory. Wrap in own try/catch returning 400 |
| L4 | `exchange.ts:39-46` | Direct RPC calls pass no `correlationId`/traceparent (auth-core's internal `getJwks({correlationId})` does this correctly); only outer catch generates requestId. Generate one per request, propagate |
| L5 | `functions/lib/env.ts:27` + `wrangler.toml [vars]` | Dead config: `COOKIE_DOMAIN` validated/declared but nothing consumes it since `cookies.ts` deleted. Remove from schema/types/wrangler vars |
| L6 | `functions/[[path]].ts:16` | Exact-match exclusion `pathname !== "/api/v1/auth/sso/exchange"` lets trailing-slash `/exchange/` be consumed and rejected by gateway instead of reaching handler. Normalize pathname or use `startsWith` |
| L7 | `src/shared/api/client.ts:21` | `process.env["NODE_ENV"] === "test"` relies on bundler define-replacement in browser source. Verified prod build dead-code-eliminates it (string absent from `dist/assets/*.js`), but an unreplaced hit inside `catch` would raise `process is not defined` masking original error. `import.meta.env.MODE === "test"` alone suffices |
| L8 | `authStore.ts:92-93` | Logs first 10 chars of OAuth `code`/`state` (`code: \`${params.code.substring(0,10)}...\``). Log presence booleans only |
| L9 | `src/shared/config/logging.ts:110` | Object branch does `JSON.stringify(error)` → throws on circular refs, and `logger.error` runs inside main.tsx global handlers → circular rejection reason would crash telemetry path. Wrap in try/catch fallback `"[unserializable error object]"` |
| L10 | `SilentContentTimer.tsx:42-44` | `.catch(() => { /* non-blocking */ })` satisfies keepalive-handler requirement but violates strict no-silent-catch; nothing records beacon failure rates. Log via centralized logger |
| L11 | `SettingsPage.tsx:330-349` | Inline IIFE in JSX for profile-strength block although `getProfileStrengthTier` already extracted. Hoist consts above `return` |
| L12 | `functions/lib/sync-shadow.ts:91,95-99` | Full user email logged (pre-existing lines untouched by diff; new hunks correctly log userId only). Hash/truncate |
| L13 | `functions/middleware/auth.ts:6-8` | `resetAuthInstance()` documented no-op kept solely for test-call compatibility. Drop once tests stop invoking |
| L14 | `vite.config.ts:122-131` | vitest forced fully serial (`maxWorkers/minWorkers:1`, `fileParallelism:false`) — legitimate flake containment but linear CI slowdown as suites grow; `retry:0`/`watch:false` correct. Revisit if CI exceeds time budget |
| L15 | `tsconfig.json` | Missing trailing newline; xlsx paths mapping + `allowArbitraryExtensions` otherwise sound for both bare import and `.mjs/.d.mts` pair |
| L16 | `wrangler.toml:39-44` | `SSO_WORKER_LOCAL_URL`/`SKILLPASSPORT_INTERNAL_URL` localhost values sit in `[vars]` block labeled `ENVIRONMENT="production"` (pre-existing pattern; diff only `127.0.0.1`→`localhost`). Confirm env-override story or move to non-prod vars |
| L17 | `public/_redirects` | Effectively dead config: `[[path]].ts` catch-all intercepts every request before `_redirects` applies; if Functions were ever removed, file lacks the Function's `ASSET_PATH_PATTERN` guard so missing assets would also 200-as-HTML. Keep as belt-and-braces fallback; none required |
| L18 | `src/features/README.md:56` | Stale doc reference to deleted `authApi.ts`. Update tree |
| L19 | `functions/api/v1/auth/__tests__/` | Empty directory left on disk (harmless post-push; delete locally) |
| L20 | graph hygiene | `graphify-out/graph.json` churn (~116k generated lines) committed in PR noise — consider ignoring generated graph output or committing snapshots out-of-band |
| L21 | `functions/api/v1/dashboard/journey.ts:55-104` | `findOpenLevel` orders by `updated_at DESC` in DB **and** re-sorts the filtered rows in memory (redundant), and the dropped `sequence_no` ordering means equal-timestamp ties now resolve nondeterministically; comparator is NaN-prone if `updated_at` were ever null (DB NOT NULL assumed). Behavior also changed from sequence-based to recency-based open-level selection — product-visible, currently untested (gap #12) | Remove redundant sort or add secondary `.order("id")`; add journey contract test |
| L22 | `functions/api/v1/settings/profile.ts:253-262` | `typeof context.waitUntil === "function"` guard silently skips XP-task registration when absent (only possible in non-Pages test envs; production Pages always provides it). Acceptable defensiveness; note it means XP award depends on env shape | Informational |
| L23 | `Dockerfile` (pre-existing on dev, surfaced by C1 fix) | Copied `/app/build` while Vite emits `outDir: "dist"` — docker build failed at the asset COPY after npm ci began succeeding. **Fixed** alongside C1 (`/app/dist`); nginx.conf confirmed path-agnostic | Resolved |
| L24 | `vite.config.ts:20-25` (found during C1 container verification) | Six aliases bound all `@rareminds-eym/*` imports to the sibling checkout, bypassing node_modules — made builds non-portable even after the registry migration. **Removed**; packages resolve via published `main`/`exports` (incl. `./internal` subpath). Verified by green in-container build + local build + full test suite | Resolved |

## Remediation status update (2026-08-24)

Phase 1+2 executed: H1 fail-closed 503 shipped (lte side), H2 502, H3 redirect restored + regression test, H5 logged, C2 viewer boundaries + test, M1/M2/M4/M5/M6/M9/M10 fixed, H6 implemented as sanctioned pre-auth client path (`apiPreAuthFetch`) since `authClient.request()` requires an access token and cannot serve pre-auth exchange. New suites: exchange (8), gateway routing (5), client prod-path/pre-auth (6), queryClient policy (3), viewer blast-radius (1), stage-lock regression (1). C1 fully closed incl. vite alias removal + Docker verification. **Still open**: sso-worker atomic RPC for provisioning writes (cross-repo, H1 root cause), M3 KV rate limiting, remaining LOW items.

---

# ⚠️ Out-of-Scope Observations (flagged while reading)

- `sso-worker/src/index.ts:2289-2358` — `provisionLteAccess` non-atomicity lives in the SSO worker repo (see H1).
- `functions/api/v1/settings/password.ts:40-47` — if `SSO_SERVICE.changePassword` is absent/non-function, endpoint returns `success:true` without changing anything (silent no-op success). Pre-existing/out-of-diff-scope; flagged for auth reviewers.
- Out-of-scope query keys (`capabilityLevels`, level-details) omit userId but are catalog-scoped and covered by logout clear (informational).

---

# 🧪 Missing Tests (mandatory-test rule gaps)

Changed/added modules with **no corresponding coverage**:

1. `functions/api/v1/auth/sso/exchange.ts` — entire module (provisioning failure paths, cookie flags, waitUntil)
2. `functions/[[path]].ts` — SSO-gateway delegation branch
3. `src/shared/api/client.ts` — rewrite untested; prod path never exercised (`isTestEnv` branch removal recommended while adding tests)
4. `src/shared/lib/queryClient.ts` — retry policy + QueryCache/MutationCache listeners
5. `src/shared/config/logging.ts` — new non-Error-object/string branches (`logging.test.ts` untouched)
6. `src/app/providers/AuthInitializer.tsx` — three new branches
7. `src/entities/session/model/authStore.ts` — partial: clear-on-logout assertion, getMe-degraded path, subscribe transition
8. `src/pages/level-content/ui/LevelContentPage.tsx` — retry/stage-fallback changes, suite not updated (**especially important given H3 regression**)
9. `src/entities/course/ui/resource-content-viewer/PdfContentViewer.tsx`
10. `functions/lib/sync-shadow.ts`
11. `functions/api/v1/courses/resources/preview.ts`
12. `functions/api/v1/dashboard/journey.ts` — ordering/error branches
13. `functions/api/v1/readiness/calculate.ts` — 404 contract branch
14. `src/main.tsx` — global error/rejection handlers (bootstrap; low priority)
15. `src/shared/api/authClient.ts` — trivial 10-line wrapper (acceptable-as-trivial)

Properly deleted **with** their tests (rule satisfied): `authApi.ts`, `sso-client.ts`, `me/refresh/logout.ts`. Note: `cookies.ts` cookie logic moved inline into untested `exchange.ts`.

Test placement otherwise compliant: all touched frontend suites sit under `src/__tests__/<feature>/<responsibility>/`; `.test.ts/.tsx` split by content; functions tests co-located near modules (accepted pattern). Lazy-route rule vacuously satisfied (no React.lazy in router yet); changed suites correctly use `waitFor` (e.g., `AuthInitializer.test.tsx:105,115,131,140`). `setupTests.ts` additions guarded and scoped (existence checks + try/catch around `isSecureContext`/location overrides).

---

# ✅ Verified Clean (per ruleset)

## Backend auth & edge

- **Gateway delegation**: `createSsoGateway` via `env.SSO_SERVICE` intercepts `/api/auth/*` + `/api/v1/auth/*` minus exchange; `approvedOrigins` covers prod + local dev whitelist; CSRF config matches frontend authClient (`X-RM-CSRF: 1`); gateway errors logged via `apiLogger.error` (fall-through caveat = H2)
- **No manual JWT/cookie handling**: middleware delegates entirely to `createAuth().authenticate/.requireProduct`; `extractBearerToken` reads only `Authorization` header; no JWT decode/signature verification/cookie parsing anywhere in scope; no user IDs trusted from bodies
- **Approved middleware**: `artifacts/_middleware.ts` runs `requireAuth` once, maps `AuthError` → clean 401/403; all `api/v1/*` handlers consume via barrel
- **Sanitized 500s (new code)**: outer catch returns `"Internal server error during authentication"` + `AUTH_EXCHANGE_FAILED` + `requestId`; full detail to `ssoLogger.error` (exception: M1 401 path)
- **Supabase error inspection**: both `maybeSingle()` lookups in `sync-shadow.ts` now destructure/check `error` before treating data; upserts inspect `error`
- **Status codes (partial)**: 400 missing fields, 401 exchange, 403 product gate, 404 API fallback; no `200 {success:false}` anywhere in scope
- **waitUntil**: XP background task has internal `.catch` + `ssoLogger.error`, registered via guarded `context.waitUntil(bgTask)` — fixes dev's floating promise
- **Versioning/env**: endpoint stays `/api/v1/...`; env validated via Zod aggregate error (per-request, correct pattern given Pages bindings are request-scoped)
- **Logging hygiene**: no raw `console.*` in scoped functions files; structured `FunctionLogger` categories; new log lines contain userId, never tokens
- **Typed Service Binding RPC**: cross-worker calls are `env.SSO_SERVICE.method()` RPC; wrangler.toml confirms `entrypoint="SsoWorker"`; method names verified against actual worker exports; no REST fetch fallback
- **Deletion completeness**: zero dangling code references to `lib/sso-client`, `lib/cookies`, `v1/auth/logout|me|refresh`, `authApi.ts` (matches only in stale docs); `getJwks`/`exchangeAuthorizationCode`/`provisionLteAccess` all exist on real worker; refresh genuinely migrated to auth-client proactive/single-flight refresh (`client.ts:120`)

## Frontend auth & state core

- **Logout purge (best-in-class)**: `queryClient.clear()` unconditional in `finally` (authStore.ts:167-168) + belt-and-braces `authClient.subscribe` listener clearing cache on `unauthenticated`/`destroyed` transitions (:181-192)
- **Rich ApiError**: carries `code`, `details`, `requestId` (ApiError.ts:5-7); client extracts from top-level and nested `{error:{...}}` shapes (client.ts:64-91); zero `.message.includes(...)` substring matching in hooks/boundaries
- **TanStack policy**: retry fn refuses all 4xx ApiError statuses + aborts, allows exactly 1 retry otherwise (queryClient.ts:24-41); `QueryCache`/`MutationCache` onError listeners wired (:8-18); mutation idempotency keys correct in `useSubmitArtifact` — useRef key reused across retries, reset in onSuccess (:12-22), sent as `Idempotency-Key` header
- **State separation**: session store holds identity + lifecycle flags only; small store co-located at `entities/session/model/` with proper barrel; no TanStack data copied into Zustand
- **QueryKey partitioning**: dashboard/courses/submission-evaluation keys include `userId` (exceptions logged as M6/observation)
- **Approved clients**: every backend call except H6 routes through `apiGet/apiPost/apiFetch → authClient.request`; remaining raw fetches are external document-preview URLs and a test-gated fallback
- **Global handlers**: `window.addEventListener("error")` + `"unhandledrejection"` registered at bootstrap (main.tsx:9-19) through centralized logger with filename/lineno metadata
- **Logging**: all diff-introduced logging uses `getLogger(...)` categories; env gating intact (PROD filters debug); new `unknown` overload handles non-Error reasons safely; no emails/tokens logged in new lines
- **Import/separation discipline**: no `src/ → functions/` imports anywhere; FSD direction clean (entities→shared only); `@/` alias throughout diff; deep-import exceptions logged as M10
- **Token hygiene**: accessToken fully removed from Zustand (old `setAccessToken` surface excised incl. App.tsx `registerTokenGetter`); no token material in localStorage (only XP-toast IDs); exchange posts `credentials:"include"`; refresh stays HttpOnly-cookie via auth-client v2

## UI / pages / features / entities

- **PdfContentViewer async pipeline fully guarded**: canvas render promise wrapped in try/catch inside useEffect; `isActive` mount flag checked after every await; AbortError filtered; transitions to dedicated `"error"` status with actionable fallback + logger (async half of the boundary rule satisfied; render-phase gap = C2)
- **CourseDetailPage**: levels section wrapped in local `<ErrorBoundary FallbackComponent={ErrorFallback}>`; retries via `void refetchLevels()`, not reload; skeleton-only loading states; barrel imports
- **DashboardPage**: error precedence reordered before `needsAssessment`; `window.location.reload()` replaced with shared Button + `refetch()` + `role="alert"`; stale-data-with-background-error renders cached content gracefully; localStorage guards are permitted parse-only try/catch
- **StartAssessmentButton**: sync failure handled (logger + `toast.error()`); toast imported from `@/shared/ui`; Toaster confirmed mounted only in AppProviders root
- **useSubmitArtifact**: idempotency-key policy exactly per spec; goes through approved `apiFetch`; server-state stays in TanStack Query
- **useCapabilityLevels**: custom retry skips 4xx (401/403/404), caps network retries at 2; gated on auth + active learning path; Zod validation at API boundary; `accessToken` fallback removal consistent with refactor (userId-in-key exception = M6)
- **SettingsPage styling**: tier styling uses only semantic tokens (`text-success-600`, `from-brand-600`, …); no arbitrary hex/rgb; static Tailwind-scannable class strings; `transition-all` width pattern kept (IIFE nit = L11)
- **No native `<img>`** tags added or present in any scoped changed file; shared Image component with `priority` exported from `@/shared/ui`
- **FSD discipline**: no feature-to-feature imports; no entity→feature/widget/page imports; pages compose only (page-local helpers are composition, not generic components); mobile-first responsive classes

## Backend endpoints (dedicated review of remaining diffs)

- **`readiness/calculate.ts:68-76`** — fixes a pre-existing rule violation from dev: `200 {success:false, "No active learning path"}` converted to proper `404` + `code:"LEARNING_PATH_NOT_FOUND"` + `requestId` (exactly the yml's blessed example); catch sanitized to generic 500
- **`dashboard/journey.ts`** — both Supabase queries now destructure and throw on `error` (fixes dev's ignored-error pattern); raw `error.message` leak in catch removed → sanitized 500; open-level selection moved from string-compared `updated_at` reduce to DB ordering (nits = L21)
- **`capabilities/index.ts`** — requestId generation added; Zod safeParse retained; 400 now carries machine code; raw `errorMessage` 500 replaced with sanitized response + `apiLogger.error` with roleId context
- **`capabilities/user.ts`** — raw `error.message` 500 replaced with sanitized response
- **`courses/resources/preview.ts`** — outbound proxy fetch now bounded via `AbortSignal.timeout(15_000)` (rule satisfied); previously-silent `catch {}` now logs via `apiLogger.warn/error` before generic 502; host allowlist untouched
- **`settings/profile.ts`** — XP fire-and-forget promise wrapped in internal `.catch` + guarded `context.waitUntil(task)` — implements the waitUntil rule verbatim (nit = L22)
- **`artifacts/file-validation.ts:175`, `lib/artifact-evaluator/artifact-extractor.ts:127`** — vendored-xlsx import path swaps only, semantics unchanged

## Tests / config / deps

- **`.codereview.yml` self-modification**: additions-only/tightening (adds LTE-specific performance/testing/structure/ui/state/error-handling/auth rules dated 2026-07-24) — **zero relaxed pre-existing rules**
- **Vendored xlsx wired correctly in all contexts** (content not reviewed): production build — explicit vite alias `xlsx`→`vendor/sheetjs/xlsx-0.20.3/xlsx.mjs` + `manualChunks` retargeted from `node_modules/xlsx/` to vendor path; tests — bare specifier aliased to `src/__mocks__/viewerLibs.ts` while three functions suites import vendor file directly by relative path; types — tsconfig `paths["xlsx"]` → vendored `types/index.d.ts` + `allowArbitraryExtensions` for `.mjs/.d.mts` pair; functions sources use in-project relative dynamic imports (`file-validation.ts:175`, `artifact-extractor.ts:127`) so wrangler/esbuild needs no alias. CDN tarball dependency eliminated — supply-chain improvement
- **Pinning discipline achieved**: every dep/dev-dep exact (all `^` removed); wrangler 4.110.0→4.120.1 routine bump within v4
- **`pages:dev` `sso-api#SsoWorker`** entrypoint suffix consistent with `wrangler.toml:25`; both sides of local dev updated together
- **eslint.config.js bans intact**: `no-console:"warn"` retained for source (:40), disabled only for tests/logger files (:82-94, unchanged); `boundaries/dependencies` layering rules fully intact (:46-79); sole change adds `"vendor"` to ignores (:9) — correct for third-party code
- **`.env.example` clean**: only delta `127.0.0.1`→`localhost` for `VITE_SKILLPASSPORT_URL`; no hosts/tokens/keys introduced; optional graphify vars commented
- **wrangler.toml**: Pages-only (no Worker deploy, respects `workers_allowed:false`); sane compatibility date; no secrets committed (localhost-var nit = L16)
- **Password test suite**: rewritten & expanded (~5 → 9 cases incl. no-leak, default-message, sanitized-failure checks) — disproves subagent "gutted" claim
- **Deletions-with-tests rule**: authApi/sso-client/me-refresh-logout removed together with their suites

---

# Remediation Order

1. **Before merge (blockers)**: C1 file:-dependency portability (CI `ci.yml:30` + Docker `Dockerfile:10` fail today without sibling checkout) · C2 viewer ErrorBoundary · H2 one-line 502 · H3 stage-lock behavioral regression · decide H1/H4 atomicity strategy (single RPC vs saga) · H5 one-line log
2. **Same PR**: M1-M6, M8/M9/M10 (all small diffs) + test coverage for exchange/gateway-routing/client-prod-path/queryClient
3. **Fast follow**: remaining LOW items, M7 remainder, password-binding no-op observation, revisit vitest parallelism (L14)

---

*Generated by automated multi-agent audit (5 parallel review scopes) + manual verification. All severities mapped to `lte/.codereview.yml` rule titles. No source files were modified during this audit.*
