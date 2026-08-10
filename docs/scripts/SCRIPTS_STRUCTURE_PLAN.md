# Scripts Directory — Proposed File Structure & Build Plan

> Reference: `docs/SCRIPT_CATALOG.md` for the full rule → script mapping.
> Source of truth for enforcement rules: `.codereview.yml`.
> **Note:** Newly created scripts must **NOT** be added to the CI workflow (`ci.yml`).
> They run locally (pre-commit) and are available as `npm run lint:*` commands for developers.

---

## 1. Why restructure

The current `scripts/` folder is flat (10 files) with four unrelated concerns mixed together
(validators, CI helper, setup bootstrap, hook guards). Adding the 16 catalog checks would push
it to 26+ files in one folder, and every validator would copy the same ~40-line recursive
file-walker from `detect-console-usage.js`.

This plan:
1. Groups scripts by responsibility.
2. Introduces a shared `walker.js` so each check stays small (~20–40 lines).
3. Centralizes allowlists/patterns in `codereview-rules.json`.
4. Keeps existing npm script names (`lint:files`, `lint:console`, `lint:lengths`) stable so
   `.husky/pre-commit` and developer muscle memory keep working.

---

## 2. Proposed file structure

```
scripts/
├── README.md                                  # index of all scripts + how to add a check
├── config/
│   └── codereview-rules.json                  # shared allowlists + patterns (single source of truth)
├── lib/
│   └── walker.js                              # shared traversal + findings reporter + exit codes
├── checks/                                    # one file per check -> npm run lint:*  (exit 0/1)
│   ├── validate-file-types.js                 # existing
│   ├── validate-file-lengths.js               # existing
│   ├── detect-console-usage.js                # existing
│   ├── validate-fsd-boundaries.js             # NEW 1
│   ├── validate-runtime-separation.js         # NEW 2
│   ├── validate-api-client.js                 # NEW 3
│   ├── validate-image-components.js           # NEW 4
│   ├── validate-design-tokens.js              # NEW 5
│   ├── validate-state-boundaries.js           # NEW 6
│   ├── validate-empty-catch.js                # NEW 7
│   ├── validate-naming-conventions.js         # NEW 8
│   ├── validate-endpoint-versioning.js        # NEW 9
│   ├── validate-secret-hygiene.js             # NEW 10
│   ├── validate-route-lazy.js                 # NEW 11
│   ├── validate-test-layout.js                # NEW 12
│   ├── validate-toaster-placement.js          # NEW 13
│   ├── validate-service-binding.js            # NEW 14
│   ├── validate-zod-boundaries.js             # NEW 15
│   └── validate-import-aliases.js             # NEW 16
├── tools/                                     # operational, non-blocking
│   ├── add-coverage-summary.js                # existing
│   └── setup-husky-cross-platform.js          # existing
└── hooks/                                     # git-hook helpers + verification (shell)
    ├── check-config-changes.sh                # existing
    ├── verify-config-integrity.sh             # existing (refresh stale checks)
    └── verify-setup.sh                        # existing (update to actual npm scripts)
```

---

## 3. Infrastructure files (create first)

### `scripts/config/codereview-rules.json`
**Purpose:** single source of truth for shared allowlists and patterns used by all checks.

```jsonc
{
  "allowedFetchFiles": [
    "src/shared/api/client.ts",
    "src/shared/api/authApi.ts"
  ],
  "allowedImageFiles": [
    "src/shared/ui/Image.tsx"
  ],
  "allowedCatchFiles": [],
  "excludedDirs": [
    "node_modules", ".git", "dist", "build", "coverage", ".wrangler", "__tests__"
  ],
  "excludedFilePatterns": [".test.", ".spec."],
  "authModuleFiles": [
    "src/shared/api/authApi.ts",
    "src/entities/session/model/authStore.ts",
    "functions/lib/auth.ts",
    "functions/lib/cookies.ts"
  ],
  "queryKeysRequireAuth": true
}
```

### `scripts/lib/walker.js`
**Purpose:** shared recursive file traversal + findings reporter + exit-code handling.
Every `checks/*.js` imports this and stays small.

```javascript
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export async function collectFiles(rootDirs, { excludedDirs, extensions }) { ... }
export async function scanLines(rootDirs, { excludedDirs, excludedFilePatterns, matchLine }) { ... }
export function reportFindings(findings, { headline, tip }) { ... } // grouped output, exit 0/1
export function exitWith(findings) { ... }
```

- **Returns:** `[{ file, line, code, message }]` per violation.
- **Exit:** `0` if no findings, `1` if findings exist (blocking).
- **Output:** grouped by file, `file:line -> code` lines, same style as current `detect-console-usage.js`.

---

## 4. Existing scripts — where they move & what changes

### `checks/validate-file-types.js` (existing → moved, refactor onto walker)
**Purpose:** only approved extensions (`.ts .tsx .json .md .wasm .css`) inside `src/` and `functions/`.
**Work:** move to `checks/`, rewrite to use `walker.collectFiles`, keep exit code + output format identical.

### `checks/validate-file-lengths.js` (existing → moved, refactor onto walker)
**Purpose:** no `.ts`/`.tsx` file exceeds 1000 lines.
**Work:** move to `checks/`, use `walker.scanLines`, keep `MAX_LINES = 1000`.

### `checks/detect-console-usage.js` (existing → moved, refactor onto walker)
**Purpose:** flag `console.*` in production code; allow the two logger files + tests.
**Work:** move to `checks/`, move `CONSOLE_PATTERNS` into `codereview-rules.json`, use `walker`.

### `tools/add-coverage-summary.js` (existing → moved as-is)
**Purpose:** post-test CI step; writes coverage report to `GITHUB_STEP_SUMMARY`.
**Work:** just move file. Not a lint gate. **Kept out of CI additions.**

### `tools/setup-husky-cross-platform.js` + `setup-husky.ps1` + `setup-husky.sh` (existing → moved)
**Purpose:** bootstrap/refresh git hooks (`pre-commit`, `pre-push`).
**Work:** move `.js` to `tools/`; keep `.ps1`/`.sh` beside it. Update embedded hook content to reference
the new `checks/` paths via the unchanged `npm run lint:*` names (no path edits needed in hooks).

### `hooks/check-config-changes.sh` (existing → moved)
**Purpose:** pre-push warning when critical config files (eslint/tsconfig/package.json) changed.
**Work:** move to `hooks/`. Keep behavior.

### `hooks/verify-config-integrity.sh` (existing → moved + repaired)
**Purpose:** verify critical configs aren't tampered (husky, eslint boundaries, strict tsconfig, CI/CODEOWNERS).
**Work:** move to `hooks/`. **Fix stale checks:** it greps `type-check`, `lint:js`, `build: "tsc && vite build"`,
`test:ci: "vitest run --coverage"`, `prepare: husky` — none match the current `package.json` (which uses
`typecheck`, `lint`, `build: "vite build"`, `test:ci: "vitest run"`). Update to current script names.

### `hooks/verify-setup.sh` (existing → moved + repaired)
**Purpose:** verify toolchain (node/npm, configs, hooks, workflows, docker, vscode, npm scripts).
**Work:** move to `hooks/`. Replace the `npm run type-check` / `npm run validate` / `npm run format` checks
(it references scripts that were removed) with real ones: `typecheck`, `lint:biome`, `test`.

---

## 5. NEW checks — one per file, purpose & exact work

### `checks/validate-fsd-boundaries.js` — NEW 1
**Codereview rule:** Public API with `index.ts`; Pages must use FSD slice segments; No upward imports (critical).
**Work:** detect deep imports that bypass slice barrels:
- Flag `import ... from "@/pages/<slice>/ui/<File>"`, `@/widgets/<slice>/ui/<File>`,
  `@/features/<slice>/model/...`, `@/entities/<slice>/model/...` where a barrel `index.ts` exists.
- Flag forbidden page sub-folders: `src/pages/components/`, `src/pages/hooks/`, `src/pages/utils/`.
- Flag upward imports: `entities -> features`, `features -> widgets`, `widgets -> pages`, `pages -> app`.
- Allowlist: `src/shared/**`, `src/__tests__/**` (tests may deep-import), config files.
- **Known violators today:** `src/widgets/dashboard/ui/DashboardContent.tsx` (deep `@/widgets/dashboard/*`),
  `src/app/router/AppRouter.tsx` (deep `@/pages/*/ui/*Skeleton`).

### `checks/validate-runtime-separation.js` — NEW 2
**Codereview rule:** Strict frontend–backend separation (critical).
**Work:** 
- Flag `import ... from "@functions/..."` anywhere inside `src/`.
- Flag `import ... from "@/"` or `from "../../src"` anywhere inside `functions/`.
- **Known violator today:** `src/__tests__/level-content/api/level-content-api.test.ts` imports
  `@functions/api/v1/courses/queries` and `/schemas`.

### `checks/validate-api-client.js` — NEW 3
**Codereview rule:** Use apiClient or ssoClient for backend communication (high).
**Work:**
- Flag raw `fetch(`/`axios(`/`XMLHttpRequest` in `src/` **outside** the files in `allowedFetchFiles`.
- Allowlist (`codereview-rules.json`): `src/shared/api/client.ts`, `src/shared/api/authApi.ts`.
- **Known violators today (review, likely move to allowlist as binary/resource fetches):**
  `src/entities/course/ui/ResourceContentViewer/DocxContentViewer.tsx`,
  `src/entities/course/ui/PptxContentViewer.tsx`, `src/entities/course/ui/ResourceContentViewer/types.ts`.

### `checks/validate-image-components.js` — NEW 4
**Codereview rule:** Use shared Image component for all images (high).
**Work:**
- Flag raw `<img` tags in `src/**/*.tsx` **outside** `allowedImageFiles` (`src/shared/ui/Image.tsx`).
- Exclude `**/*.test.*`, `**/*.spec.*`.
- **Current state:** clean (guardrail only — no violators yet).

### `checks/validate-design-tokens.js` — NEW 5
**Codereview rule:** Global Semantic Design Tokens Only (critical).
**Work:**
- Flag Tailwind arbitrary-value color utilities: `(bg|text|border|ring|shadow|fill|stroke|from|to|via)-\[#`.
- Exclude tests. Do not flag `@theme`/`tailwind.config.ts`/`index.css` (definition files).
- **Known violators today:** `src/features/xp-reward/ui/XpRewardModal.tsx` (`bg-[#f4fbf8]`, `border-[#e6f4ee]`, `bg-[#e3f6ed]`),
  `src/pages/login/ui/LoginPage.tsx` (`bg-[#f8fafc]`).

### `checks/validate-state-boundaries.js` — NEW 6
**Codereview rule:** Proper TanStack Query usage + Proper Zustand usage + query-key auth (critical/high).
**Work:**
- For every `useQuery({` in `src/`, flag a `queryKey:` that does NOT reference `userId` or `isAuthenticated`
  (unless the hook is not auth-gated).
- Flag `useAuthStore`/any zustand store imported in `features/*` that is not a session/user store — keeps
  server data out of client state (heuristic only; full dataflow is out of scope).
- **Known violators today:** `src/entities/course/model/useCapabilityLevels.ts` (`["capabilityLevels", capabilityCode]`),
  `useLevelContentData.ts` keys omit userId.

### `checks/validate-empty-catch.js` — NEW 7
**Codereview rule:** Correct Error Handling — no fallbacks / empty catch blocks (critical).
**Work:**
- Parse `catch {` / `catch (...) {` blocks; flag a block whose body is empty or contains only a comment
  (no `logger`, `throw`, `return`, `console`, function call).
- Allowlist files in `allowedCatchFiles` where intentional swallow-and-continue is documented.
- **Known near-violators today (commented swallow — verify):** `functions/lib/cookies.ts:15`,
  `functions/api/v1/courses/[levelId]/progress.ts:31`, `auth/refresh.ts:56`, `capabilities/queries.ts:300`.

### `checks/validate-naming-conventions.js` — NEW 8
**Codereview rule:** Enforce kebab-casing for directories and camel/PascalCasing for components (high).
**Work:**
- Flag any directory under `src/` (layers, slices, segments) containing uppercase/underscore chars.
- Flag component files not matching PascalCase; hook/util files not matching camelCase.
- **Known violators today:** `src/widgets/dashboard/CareerPaths/`, `src/widgets/dashboard/Achievements`,
  `src/widgets/dashboard/CapabilityGapMap/`, etc. (capitalized sub-folders under existing widgets).

### `checks/validate-endpoint-versioning.js` — NEW 9
**Codereview rule:** Endpoint Versioning — every endpoint must be `/api/v1/...` (critical).
**Work:**
- Verify every `functions/api/**` route file lives under `functions/api/v1/`.
- Flag frontend `fetch(`/`apiFetch(` URLs pointing at project backends that do NOT start with `/api/v1`.
- Allowlist external/third-party absolute URLs (`https://...`).

### `checks/validate-secret-hygiene.js` — NEW 10
**Codereview rule:** Do not expose secrets to frontend (critical) + No Hardcoded Values (critical).
**Work:**
- Flag in `src/`: `SUPABASE_SERVICE_ROLE_KEY`, `SERVICE_ROLE`, `SECRET`, `PRIVATE_KEY`, `JWT_` literals.
- Flag `VITE_` env reads of secret-named keys (`VITE_SUPABASE_SERVICE_ROLE`).
- Flag `createServiceSupabase`/`supabase` client creation imported into `src/`.
- Exclude `src/__tests__/**` where mocks are intentional; allow `import.meta.env` for public config only.
- Complements `.secretlint` (path-aware, not content-only).

### `checks/validate-route-lazy.js` — NEW 11
**Codereview rule:** Enforce React.lazy() for all route-level page imports + Suspense `<PageLoader/>` (high).
**Work:**
- In `src/app/router/AppRouter.tsx` (or any file containing `<Routes>`), flag **static** imports of
  `@/pages/...` that are not `React.lazy(...)`.
- Flag `<Suspense>` fallbacks that are bare strings or `<div>Loading...</div>` instead of `<PageLoader message="..."/>`.
- **Current state:** clean (all 8 pages lazy; skeletons on deep import still need FSD review — covered by script 1).

### `checks/validate-test-layout.js` — NEW 12
**Codereview rule:** Tests must use feature/responsibility folders (high).
**Work:**
- Flag test files placed directly under `src/__tests__/<feature>/` without a responsibility sub-folder
  (approved: `auth/{api,guards,pages,store}`, `dashboard/{api,hooks,layouts,pages,widgets}`, etc.).
- Flag test files directly under `src/__tests__/`.
- **Known violators today:** `src/__tests__/pages/settings/SettingsPage.test.tsx` (flat `pages/`),
  `src/__tests__/shell/...`, `src/__tests__/features/...` (old structure not in the approved list).

### `checks/validate-toaster-placement.js` — NEW 13
**Codereview rule:** Use unified global Toaster notifications (high).
**Work:**
- Flag `<Toaster` occurrences outside the single allowed file
  (`src/app/providers/AppProviders.tsx`).
- `toast.*` calls anywhere are fine; only component mounts are restricted.
- **Current state:** clean (`<Toaster />` only in `AppProviders.tsx`).

### `checks/validate-service-binding.js` — NEW 14
**Codereview rule:** Use typed Service Binding RPC for cross-worker communication (high).
**Work:**
- In `functions/`, flag REST-style `fetch(`/`https://` calls to an SSO worker/service URL.
- Verify cross-worker access uses `env.SSO_SERVICE.<method>()` only, and that calls are typed via
  `SsoRpcService` (`functions/shared/types.ts`).
- **Current state:** clean (`functions/lib/sso-client.ts` uses the binding).

### `checks/validate-zod-boundaries.js` — NEW 15
**Codereview rule:** Proper Zod Usage + Backend validation is mandatory (critical).
**Work:**
- For every `onRequestGet|Post|Put|Patch|Delete` handler in `functions/api/`, flag if no `.safeParse`/
  `.parse` of a schema occurs before any `supabase`/`fetch` DB or business call.
- Flag schema imports placed outside approved locations (`functions/schemas/`, `features/*/schemas/`,
  `entities/*/schemas/`, `shared/schemas/`).
- Exclude handlers that are pure auth/me endpoints (already validated centrally).

### `checks/validate-import-aliases.js` — NEW 16
**Codereview rule:** Use path alias `@/` for project imports (high).
**Work:**
- In `src/`, flag relative imports that cross FSD slice roots: `../../shared/...`, `../../../pages/...`,
  `../../../entities/...` etc. (multi-`../` traversal).
- Flag imports referencing `src/...` literally (`import ... from "src/shared/..."`) instead of `@/`.
- In `functions/`, flag relative imports crossing lib boundaries; prefer `@functions/...`.
- Exclude `src/__tests__/**` if policy allows relative test imports (decide in `codereview-rules.json`).

---

## 6. Wiring — package.json (new lint:* entries)

```jsonc
// only entries for the new checks (moved existing names stay the same)
"lint:fsd": "node scripts/checks/validate-fsd-boundaries.js",
"lint:runtime": "node scripts/checks/validate-runtime-separation.js",
"lint:apiclient": "node scripts/checks/validate-api-client.js",
"lint:image": "node scripts/checks/validate-image-components.js",
"lint:tokens": "node scripts/checks/validate-design-tokens.js",
"lint:state": "node scripts/checks/validate-state-boundaries.js",
"lint:catch": "node scripts/checks/validate-empty-catch.js",
"lint:naming": "node scripts/checks/validate-naming-conventions.js",
"lint:versioning": "node scripts/checks/validate-endpoint-versioning.js",
"lint:secrethy": "node scripts/checks/validate-secret-hygiene.js",
"lint:lazy": "node scripts/checks/validate-route-lazy.js",
"lint:testlayout": "node scripts/checks/validate-test-layout.js",
"lint:toaster": "node scripts/checks/validate-toaster-placement.js",
"lint:binding": "node scripts/checks/validate-service-binding.js",
"lint:zod": "node scripts/checks/validate-zod-boundaries.js",
"lint:alias": "node scripts/checks/validate-import-aliases.js"
```

> These run via `npx run-all lint:files lint:fsd lint:runtime ...` locally or through `.husky/pre-commit`.
> **They are intentionally NOT added to `.github/workflows/ci.yml`** per project decision.

---

## 7. CI note (important)

- Existing gates that STAY in `ci.yml`: `lint:files`, `lint:console`, `lint:lengths`, Biome, ESLint,
  Stylelint, Secretlint, Typecheck, Vitest, coverage summary.
- All 16 NEW checks are local-only (pre-commit / manual `npm run`).
- Path changes under the hood (e.g. `scripts/checks/validate-file-types.js`) must NOT change the
  npm script names referenced by `ci.yml`.

---

## 8. Build order (safe, incremental)

1. `scripts/config/codereview-rules.json` + `scripts/lib/walker.js`
2. Move existing 3 validators → `scripts/checks/` refactored onto `walker.js` (verify outputs match)
3. Move `tools/` + `hooks/` scripts; repair stale checks in `verify-config-integrity.sh`, `verify-setup.sh`
4. Update `package.json` paths + `.husky/pre-commit` (script names unchanged) + `docs/scripts/README.md`
5. Implement NEW checks in this order: 2 (critical), 5 (critical, easy), 1, 8, 12, 7, 15, 3, 6, 9, 10, 16, 11, 13, 14, 4
6. Run each `npm run lint:*` locally; then `npm run ci` to confirm still green
7. Add all 16 entries to `docs/SCRIPT_CATALOG.md` (already documented) and this plan file
