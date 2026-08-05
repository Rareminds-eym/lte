# Plan: CI Hardening + Coverage Threshold Enforcement (lte/)

**Date**: 2026-08-04
**Branch**: `feat/settings-module` (all work stays **uncommitted** per user decision)
**Scope**: `lte/` subproject of skill-echosystem

---

## 1. Objective

Land the settings-module audit fixes and repo-wide coverage work as a **CI-green** change set by closing every verified gap found in the deep self-check:

1. All 6 CI gates must pass (lint:files, lint:console, lint:lengths, biome ci, eslint, secretlint) plus typecheck and `vitest run --coverage` with thresholds **80% lines / 75% branches / 75% functions / 80% statements**.
2. No test lost, no behavior change (source edits only where a diagnostic requires it).
3. Knowledge graph (`lte/graphify-out/`) refreshed and verified.
4. Documentation per repo standards (ADR + .kiro docs).

---

## 2. Verified Current State (measured, not assumed)

### 2.1 Coverage (final full run, lcov-parsed)
- **Lines 86.02%** (2222/2582) ✓ target 80%
- **Branches 76.48%** (1881/2513) ✓ target 75% (margin 1.48pp)
- **Functions 77.24%** ✓ target 75% (margin 2.24pp)
- **Statements ~86%** ✓ target 80%
- Suite: **74 test files, 689 passed, 1 skipped**; typecheck clean; eslint clean; secretlint clean

Per-file claims verified from `coverage/lcov.info`:
| File | Lines | Branches |
|---|---|---|
| settings/account.ts | 100 | 100 |
| settings/password.ts | 100 | 100 |
| settings/profile.ts | 100 | 98.9 |
| settings/schemas.ts | 100 | — |
| lib/auth.ts | 100 | 93.8 |
| lib/env.ts | 100 | 100 |
| lib/xp-engine.ts | 100 | 100 |
| courses/queries.ts | 100 | 98.8 |
| capabilities/queries.ts | 100 | 100 |
| learning-paths/queries.ts | 100 | 98.0 |
| courses/…/stages/progress.ts | 100 | 92.9 |
| src/…/ResourceContentViewer/types.ts | 100 | 94.1 |
| lib/sso-client.ts | 100 | 92.6 (pre-existing) |

### 2.2 CI gate results (run exactly as CI does)

| Gate | Result | Detail |
|---|---|---|
| `npm run lint:files` | ✅ | all approved extensions |
| `npm run lint:console` | ✅ | exits 0 by design; no findings |
| `npm run lint:lengths` | ❌ **RED** | `functions/api/v1/courses/__tests__/queries.test.ts` (1356 ln), `functions/lib/__tests__/xpEngine.test.ts` (1670 ln) — cap is 1000; nothing else pre-existing |
| `npx biome ci --changed --since="origin/main" .` | ❌ **RED** | **1 error**: format violation `functions/lib/__tests__/xpEngine.test.ts` (present even at committed HEAD). Untracked new test files are invisible to `--changed` today but WILL error once committed (see 2.3) |
| eslint (changed files) | ✅ | clean |
| secretlint (changed files) | ✅ | clean |
| `npm run typecheck` | ✅ | clean |

### 2.3 Biome diagnostics inventory (blanket `biome check`, 24 changed files)
- **12 errors** = formatter × ~9 files + organizeImports × 4 (all in test files; all auto-fixable)
- **7 warnings** = noNonNullAssertion ×2 (`issues[0]!` at password.ts:26, profile.ts:145 — mine), noExplicitAny ×2 (xpEngine.test.ts:31,51), stale `biome-ignore` ×3 (capabilities/queries.test.ts:18, learning-paths/queries.test.ts:34, stages/progress.test.ts:30)
- **16 infos** = useLiteralKeys (profile.ts:94-96 & 222-225 ×8, courses/queries.test.ts ×6 — caused by TS4111 bracket fix, xpEngine.test.ts:193, password.test.ts:28) + pre-existing branch files from other work (middleware/auth.ts:22, SettingsPage.tsx:167-170, env.ts:8, Achievements.tsx:61, LevelModuleList.tsx:108, capabilities/[capabilityCode]/levels.ts:15) — **info level, non-blocking**

### 2.4 Process findings
- `graphify update ./lte` (run today) was a **silent no-op**: no graphify artifact modified today; `lte/graphify-out/graph.json` still dated 2026-08-03. Root graph (`skill-echosystem/graphify-out/`) untouched since 2026-07-25.
- Nested tracked junk dir `lte/lte/graphify-out/` exists (only `lte-callflow.html`, modified, uncommitted) — pre-existing, predates this session.

---

## 3. Open Decisions (need user answer before Phase C)

1. **Nested `lte/lte/graphify-out/`**: `git rm` (delete) or leave? — tracked dir, deletion needs approval.
2. **Info-level findings in other work's files** (2.3 last bullet): fix (dot-access conversions — expands blast radius into unrelated in-flight work) or leave to owners? Non-blocking either way.
3. **ADR** for Zod input validation: create or skip? (recommended: create)
4. **NEW — Formatter conflict (confirmed empirically 2026-08-04)**: husky `lint-staged` runs `biome check --write` **then** `prettier --write`; prettier's output (single quotes per `.prettierrc`) **fails `biome ci`** (biome.json defaults → double quotes). Cycle test on a scratch file through the exact lint-staged order left `biome ci` with 1 format error. Corollary: committed files (e.g. sso-client.ts) fail `prettier --check` → commits bypass hooks. **CI (biome) is the de-facto formatter authority.** Options: (a) reorder lint-staged to prettier → biome (committed state = biome = CI green) — recommended, 1-line change; (b) drop prettier from the ts pipeline in lint-staged; (c) leave repo config untouched — files stay biome-clean, prettier stays broken repo-wide (pre-existing condition, flag to team).

---

## 4. Phase A — CI-Blocking Fixes (required for green)

### A1. Split `functions/api/v1/courses/__tests__/queries.test.ts` (1356 → ≤1000 lines each)

1. Create `functions/api/v1/courses/__tests__/helpers.ts` containing:
   - `QueryResult`, `MockChain`, `ChainOptions` interfaces, `mockChain()`, `makeSupabase()`, `ok()`, `err()`, `levelRow`, `moduleRow` (moved verbatim)
   - **New type** `interface MockChains extends Record<string, MockChain>` with declared optional props: `capabilities`, `user_capability_level_progress`, `user_module_progress`, `user_stage_progress`, `modules_content`, `module_artifacts`
   - `levelChains()`, `moduleDetailsChains()`, `upsertUpstream()`, `moduleProgressChains()`, `stageProgressChains()` moved with `Record<string, MockChain>` → `MockChains` return types
   - Rationale: declared props make **dot access legal for tsc** (kills TS4111 — the bracket fix I applied earlier) **and** satisfies biome `useLiteralKeys` (kills 6 infos) — no suppressions needed. `makeSupabase` keeps accepting `Record<string, MockChain>` so `chains[table]` index access still typechecks.
2. Replace the single file with 5 per-function test files, importing helpers:
   - `getLevelWithModules.test.ts` (lines ~143–448 → ~300)
   - `getModuleDetails.test.ts` (~600–772 → ~170)
   - `upsertLevelProgress.test.ts` (~787–1002 → ~215)
   - `upsertModuleProgress.test.ts` (~1022–1135 → ~115)
   - `upsertStageProgress.test.ts` (~1160–end → ~200)
3. Convert all `chains["key"]` back to `chains.key` (now tsc-legal).
4. **Preserve all 63 `it()`s** — verify by count after split.
5. `helpers.ts` naming: no `.test.` in filename → vitest will not execute it as a suite; it is fully covered (imported by all suites).

### A2. Split `functions/lib/__tests__/xpEngine.test.ts` (1670 → ≤1000 lines each)

1. Extract harness to `functions/lib/__tests__/xpEngine.helpers.ts` (mock supabase/query chains, row fixtures, `createMockQueryChain`, `createChain`, etc.).
2. Split by domain (74 `it()`s total, count-verified after split):
   - `xpEngine.awardXp.test.ts` — awardXp + completeStage (~lines 76–699)
   - `xpEngine.evaluateArtifact.test.ts` — evaluateArtifact (~lines 700–end)
   - `xpEngine.misc.test.ts` — evaluateFallback, completeCourseOnTime, completeCapability, triggerDailyLogin, completeProfile, evaluateMilestones, adminOverrideArtifact, calculateReadiness
3. This rewrite eliminates the committed HEAD format error at line 1.
4. While touching the harness, **type the mock chains** (fixes B3 at the same time — see Phase B).

### A3. Biome format + organizeImports (`biome check --write`) — DONE for changed set 2026-08-04

Run on every new/changed test file (auto-fixes the 12 errors):
- `src/__tests__/entities/course/ResourceContentViewer/types.test.ts`
- `functions/lib/__tests__/auth.test.ts`, `env.test.ts`, `sso-client.test.ts`
- `functions/api/v1/capabilities/__tests__/queries.test.ts`
- `functions/api/v1/learning-paths/__tests__/queries.test.ts`
- `functions/api/v1/courses/[levelId]/modules/[moduleNo]/stages/__tests__/progress.test.ts`
- `functions/api/v1/settings/__tests__/*.test.ts` (incl. pre-existing profile.test.ts format issue)
- All new split files from A1/A2

**Do NOT run `--write` on source files** (profile.ts etc. get hand fixes in Phase B; formatter only if no hand edit needed).

**Status 2026-08-04**: `biome check --write` already applied to all 8 format-needed files (types.test.ts, auth.test.ts, capabilities/queries.test.ts, stages/progress.test.ts, courses/queries.test.ts, learning-paths/queries.test.ts, profile.test.ts, password.test.ts). Re-verified: changed set = **1 error** (xpEngine.test.ts format — killed by A2 rewrite), 4 warnings, 18 infos. `types.test.ts` and `auth.test.ts` fail `prettier --check` — EXPECTED (formatter conflict, see Decision 4); biome is the CI authority.

---

## 5. Phase B — Quality Polish (warnings/infos in branch-owned files)

### B1. profile.ts useLiteralKeys ×8 (lines 94-96, 222-225)
- Root cause: `user_metadata` cast `as Record<string, unknown>` (sso-client.ts:192) → bracket access required by tsc, flagged by biome.
- Fix: define `interface UserMetadata { skillPassportVerified?: unknown; skill_passport_verified?: unknown; twoFactorEnabled?: unknown; loginAlertsEnabled?: unknown; … }` at the cast boundary (sso-client.ts:192) and in profile.ts where metadata is sourced; cast once, then use **dot access** (`metadata.skillPassportVerified`). Behavior identical (`=== true` semantics preserved). Bracket access on the `getMetaString(metadata, ["phone", …])` string arrays stays (not flagged).

### B2. `issues[0]!` non-null assertions ×2 (password.ts:26, profile.ts:145)
- Replace `parsed.error.issues[0]!.message` → `parsed.error.issues[0]?.message ?? "Invalid input"`.
- No coverage impact (global thresholds only; adds one unreachable-ish branch, tolerated — same class as the accepted profile.ts:77 v8 quirk).

### B3. xpEngine harness `Record<string, any>` ×2 (xpEngine.test.ts:31,51)
- Replace with typed chain interfaces (mirror of the courses `MockChain` style: `select`/`update`/`then` typed via `ReturnType<typeof vi.fn>` or explicit signatures).
- Removes biome `noExplicitAny` AND the `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments (dead weight).

### B4. Stale `biome-ignore` comments ×3
- Remove `// biome-ignore lint/suspicious/noThenProperty: mock promise resolution` from capabilities/queries.test.ts:18, learning-paths/queries.test.ts:34, stages/progress.test.ts:30 (biome reports them unused).

### B5. password.test.ts:28 useLiteralKeys
- Dot access (verify the key's type first; if index signature, keep brackets — info-level, non-blocking).

### B6. (A1 bonus) courses bracket→dot conversion removes the 6 useLiteralKeys infos I introduced.

---

## 6. Phase C — Process & Documentation

### C1. Knowledge graph refresh (verified)
- From `skill-echosystem/` root: `graphify update ./lte`
- **Verify it landed**: `ls -lt lte/graphify-out/graph.json` — mtime must be today, and git status must show the change. If it no-ops again, investigate CLI usage (project-path resolution, key requirement — tool prints "set GEMINI_API_KEY…" tip for semantic extraction) and report honestly instead of claiming success.
- Root `graphify-out/` (Jul 25): only refresh if decision 3 scope includes root changes (nothing root-side changed this session — defer unless user asks).
- Decision 1 pending: `git rm` nested `lte/lte/graphify-out/` or leave.

### C2. ADR (pending decision 3)
- `.kiro/adr/YYYY-MM-DD_zod-api-input-validation.md`: Context (audit found untyped/partial validation in settings endpoints), Decision (Zod `.strict()` schemas + `safeParse` → 400 `VALIDATION_ERROR` with `details: issues`), Consequences (strict contracts, duplicate frontend types by design per 8.2 separation rule), Alternatives (manual validation — rejected; superstruct — rejected).

### C3. Temporary docs (repo standard placement)
- `.kiro/plans/2026-08-04_ci-hardening-coverage_plan.md` — mirror of this file (if kept at root, note divergence)
- `.kiro/summaries/2026-08-04_ci-hardening-coverage_summary.md` — after execution
- `.kiro/verifications/2026-08-04_ci-hardening-coverage_verification.md` — final gate results

---

## 7. Phase D — Final Verification Gate (exact CI parity, in order)

```bash
# 1. Repo-level validators
npm run lint:files
npm run lint:console
npm run lint:lengths

# 2. Biome exactly as CI
npx biome ci --changed --since="origin/main" .   # expect: 0 errors (warnings ok)

# 3. ESLint — every changed .ts/.tsx file (CI pattern)
grep -E '\.(ts|tsx)$' <changed files> | xargs -0 npx eslint --max-warnings 0

# 4. Secretlint — every changed file (CI pattern)
xargs -a <changed files> npx secretlint --no-glob --format github

# 5. Typecheck
npm run typecheck

# 6. Full coverage run (thresholds enforced: 80/75/75/80)
npx vitest run --coverage
```

**Pass criteria**
- All commands exit 0
- Coverage: lines ≥80%, branches ≥75%, functions ≥75%, statements ≥80%
- Test files: **≥79** (74 + 5 splits + 2–3 xpEngine splits), total tests **≥689 + 1 skipped — zero tests lost** (per-file `it(`/`test(` counts summed before/after)
- `git status`: only intended files; all changes remain uncommitted

---

## 8. Out of Scope (deliberately, per approved plan)

- `[levelId]/progress.ts` (28.6% branches) and `modules/[moduleNo]/progress.ts` (28.6%) — courses endpoints, not in approved plan
- Dead branches courses/queries.ts:161 (`|| []`) and :598 (`requiredLevelNum > 0`) — flagged for product decision
- Source design notes (already reported): learning-paths/queries.ts:225-229 silent L1 default + uncapped gap_score; capabilities/queries.ts:40 first-join-row; progress.ts:67 null FK
- Untested UI viewers/hooks (ResourceContentViewer components, useCapabilityLevels, useLevelContentData) — global thresholds met without them
- profile.ts:77 v8 coverage quirk (98.88% branches ceiling — accepted, behavior pinned by tests)

---

## 9. Execution Order

A1 → A2 → A3 → B1 → B2 → B3 → B4 → B5 → C1 → D (full gate) → C2/C3 (docs) → final git status review → report.

Estimated impact: ~15 files created, ~10 files edited, 0 source behavior changes except B1/B2 (both behavior-preserving).
