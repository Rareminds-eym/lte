# 2026-08-05 Staged-Changes Code Review Audit — Verification Report

## Scope and method

Full audit of the staged change set on `lte` branch `dev` (15 files, ~550 lines of
real code + generated graphify artifacts) against the workspace standards
(`.kiro/steering/*.md`) and `lte/.codereview.yml`.

Method: 4 parallel audit subagents (backend/API, frontend FSD/state/UI, SQL/database,
security/hygiene) + independent re-verification of every Critical/High finding.
Read-only; no tests executed, no fixes applied.

Staged set classification:

- **Generated graphify artifacts (3):** `graphify-out/.graphify_root`,
  `graphify-out/graph.json`, `lte/graphify-out/lte-callflow.html` — all three are problem files.
- **Real code (12):** `functions/api/v1/capabilities/{queries,types}.ts`,
  `functions/api/v1/capabilities/__tests__/queries.test.ts`,
  `functions/api/v1/courses/types.ts`,
  `src/__tests__/courses/pages/CourseDetail.test.tsx`,
  `src/__tests__/pages/course-detail/dynamicLevels.test.ts` (new),
  `src/entities/course/api/courseApi.ts`,
  `src/pages/course-detail/model/dynamicLevels.ts`,
  `src/pages/course-detail/ui/CourseLevelCard.tsx`,
  `supabase/migrations/20260805120000_add_levels_total_xp_column.sql` (new),
  `supabase/seed/{dev,production}/seed_lte_catalog_15_e_content_xp_rewards.sql` (new; renumbered from 14 to the next free slot after the dev slot-14 collision).

## 🔴 Critical — blocks merge

| # | Finding | Rule | Fix |
|---|---------|------|-----|
| C1 | `src/__tests__/courses/pages/CourseDetail.test.tsx:221` still asserts a button named `"Continue →"`; the code now renders `"Start →"` for unlocked levels (`src/pages/course-detail/model/dynamicLevels.ts:39`, `CourseLevelCard.tsx` card + list variants render `{actionText}`). **Confirmed failing at runtime** (`npx vitest run` on the file: 1 failed — "Unable to find role button name Continue →"). | Test correctness | Change assertion to `{ name: "Start →" }` |
| C2 | **12 typecheck errors introduced by this change** (reproduced with `npm run typecheck`; all in staged-added/new lines; `tsconfig.app.json` includes `src/**/*.ts{,x}` + `functions/**/*.ts` with no test exclusion; `ci.yml:92` runs `npm run typecheck`):<br><br>`functions/api/v1/capabilities/__tests__/queries.test.ts:316,335` — TS2532 `result[0]` possibly undefined (the 2 NEW backend tests; `noUncheckedIndexedAccess` is on). Subagent audit cleared this file — wrong.<br>`src/__tests__/courses/pages/CourseDetail.test.tsx:185` — TS2741 `totalXp` missing: `CapabilityLevel.totalXp` is a **required** field (`z.number().nullish().transform()` makes the output type `number \| undefined`, non-optional), so every existing mock must now add `totalXp`.<br>`src/__tests__/pages/course-detail/dynamicLevels.test.ts:7,71,97` — TS2741 `status` missing (3 mocks); `:84,85,86,91,92,110` — TS2532 `cards[0]` possibly undefined (same index-access flag). | Testing / CI | Fix all 12: add `status: "published"` to 3 mocks, add `totalXp` to the `CourseDetail.test.tsx:185` mock, use non-null assertions or `.at(0)!`/`[0]!` on the 8 index-access sites (or `expect(cards[0]).toBeDefined()` guards) |
| C3 | **(missed by initial audit)** Type asymmetry: frontend `CapabilityLevel.totalXp` is required `number \| undefined`; backend `functions/api/v1/capabilities/types.ts:82` declares it optional `totalXp?: number`. Accepts the same values; only matters for object construction (which is why mocks fail). Recommend making the zod field `.optional().nullable()`-style input/output parity once mocks are fixed. | Contract consistency | Info — no fix needed for merge, align on next schema touch |

## 🟠 High

| # | Finding | Rule | Fix |
|---|---------|------|-----|
| H1 | **Wrong artifact committed**: staged `lte/graphify-out/lte-callflow.html` (4,982 lines) is the stray **nested** artifact at `lte/lte/graphify-out/` — exactly the path trap documented in workspace `AGENTS.md` ("`graphify update ./lte` from the workspace root triggers a nested `lte/lte/graphify-out/` output"). The correct root build `graphify-out/lte-callflow.html` is gitignored (`.gitignore:52`); the nested copy escapes the root-anchored pattern (`git check-ignore` exit 1 — verified). | AGENTS.md graphify rules | `git restore --staged lte/graphify-out/lte-callflow.html` and delete `lte/lte/`. If a callflow artifact is wanted, generate from `lte/` root — but `.gitignore` deliberately keeps only `graph.json`, so drop it |
| H2 | `graphify-out/.graphify_root` now contains `lte` (verified) — graph regenerated from the wrong root; `graphify query/path/explain` will resolve paths under nonexistent `lte/lte/` and fail. | AGENTS.md | Restore to `.` and regenerate: `graphify update .` from inside `lte/` |
| H3 | **Backfill gap** in `seed_lte_catalog_15_e_content_xp_rewards.sql:5` (renamed from 14; dev slot 14 was already taken by `seed_lte_catalog_14_artifact_question_response_types_20260805.sql`) — `WHERE xp_reward IS NULL OR xp_reward = 0` skips rows already ≥ 1, so their trigger never fires and `levels.total_xp` stays 0 (wrong XP on level cards). In-place `supabase db push` deployments never run seeds at all → all levels show "0 XP". Fresh `db reset` self-heals (seed 10 inserts rows with NULL xp_reward; seed 15 touches 100%). | 04-database-api-standards §11.2 (Expand-Migrate-Contract Phase 2 backfill) | `UPDATE public."e_content" SET "xp_reward" = 1 WHERE "xp_reward" IS DISTINCT FROM 1;` — still DML-only, idempotent, fires trigger for every non-1 row |
| H4 | *(pre-existing, outside diff — resolved in this branch)* `functions/api/v1/courses/[capabilityCode]/levels/[levelId]/index.ts` — dev trusted `userId` from the query string (`:21`) and returned per-user progress. Anyone with a guessed userId could read another user's progress. **Branch fix verified**: `requireAuth` added (index.ts:16), userId derived from `user.sub`, route params zod-validated via `CapabilityLevelParamsSchema`; frontend no longer sends `?userId=`. | .codereview.yml "Use approved authentication middleware" (critical) | Already applied — no follow-up ticket needed |

## 🟡 Medium

| # | Finding | Rule | Fix |
|---|---------|------|-----|
| M1 | New test under unapproved `src/__tests__/pages/` root. Approved roots: `auth, courses, dashboard, level-content, level-modules, features, shared, shell` — no `pages/`. | .codereview.yml "Tests must use feature/responsibility folders" (high) | Move to `src/__tests__/courses/pages/dynamicLevels.test.ts` (where `CourseDetail.test.tsx` lives) |
| M2 | Test deep-imports `@/entities/course/api/courseApi` and `@/pages/course-detail/model/dynamicLevels`; neither `CapabilityLevel` nor `mapApiLevelsToCards` is exported from its slice `index.ts` (production code has the same pre-existing pattern). | .codereview.yml "Use slice public APIs" (high) | Export both from slice roots; import from `@/entities/course` and `@/pages/course-detail` |
| M3 | Trigger UPDATE branch (`20260805120000_add_levels_total_xp_column.sql:20–27`) resolves only `NEW.modules_content_id` — reassigning an item to another module leaves the **source level stale**. Structural deletes (`modules`/`modules_content` cascade-delete `e_content`; DELETE branch JOINs an already-deleted row → NULL target) leave phantom XP with no self-healing path. Low practical exposure (static catalog), permanent once it happens. | 04 §11 correctness | On `OLD.modules_content_id IS DISTINCT FROM NEW.modules_content_id`, recompute both levels; mirror trigger on `modules`/`modules_content` or document as known limitation |
| M4 | *(pre-existing)* `capabilityCode` route param not zod-validated at boundary — `functions/api/v1/capabilities/[capabilityCode]/levels.ts:15` (`context.params["capabilityCode"] ?? ""`). Impact mitigated (lookup key scoped to caller's role; mismatch → 404) but violates mandatory boundary validation. | .codereview.yml "Backend validation is mandatory" (critical) | Zod-parse params (mirror `courses/[capabilityCode]/levels/[levelId]/index.ts:14`) |

## 🟢 Low / Info

- **L1** — `functions/api/v1/courses/types.ts:136`: `LevelRow.total_xp` is a dead type addition — `getLevelWithModules` doesn't select it and `LevelDetailsResponse` doesn't expose it. Wire it in or drop it. ("Do not create empty architecture for hypothetical future use", medium)
- **L2** — `functions/api/v1/capabilities/queries.ts:147`: `(row as { total_xp?: number })` type assertion — no named row type exists in the module (supabase client is generic-less). Add a `LevelRow` interface in capabilities types and type the mapper.
- **L3** — Migration header missing steering-mandated documentation fields (`-- Phase: / -- Breaking: / -- Rollback: / -- Deployment order:` per 04 §11.7). Above repo norm (most migrations have no header), below steering.
- **L4** — `ADD CONSTRAINT chk_levels_total_xp` (migration line 7) has no `IF NOT EXISTS` (PG doesn't support it) — a manual rerun against a migrated DB errors with `duplicate_object`, breaking the file's otherwise-idempotent pattern (`ADD COLUMN IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, `CREATE OR REPLACE FUNCTION`). schema_migrations tracking makes rerun unlikely.
- **L5** — Raw color utilities `bg-white` / `text-white` added at `CourseLevelCard.tsx:314,323`; tokens `bg-surface-primary` / `text-content-inverse` exist in `@theme`. Same raw pattern pre-exists in the file (lines 151/160), so consistent with file convention — but token-compliant equivalents are one-word swaps. No hex codes or arbitrary values anywhere in the diff.
- **L6** — *(pre-existing)* Raw `error.message` leaked in 500 responses on capabilities routes (`[capabilityCode]/levels.ts:50–52` returns it; `index.ts:38–41` catches without logging); `queries.ts:126–128` catch assigns without `logger.error`. Touched code path (`capabilities/[capabilityCode]/levels.ts`) itself logs via `apiLogger.error` with requestId — compliant.
- **L7** — Hygiene gaps around artifacts: `.gitignore:52` pattern is root-anchored so any future nested run re-produces a stageable stray; secretlint gates (`.husky/pre-commit`, `ci.yml`) don't scan committed `.html`/`.json`/`.graphify_root` artifacts (currently clean; F4-style silent pass risk).
- **INFO** — `totalXp?: number` optional vs always-present value (`?? 0`, column NOT NULL DEFAULT 0): make non-optional once migration is applied everywhere (no behavior change).
- **INFO** — New backend tests don't assert the select column list (mock ignores select string), so a regression dropping `total_xp` from the select wouldn't fail them. Optional: assert `select` called with `total_xp`.
- **INFO** — Query key lacks user ID (`useCapabilityLevels.ts:31` `["capabilityLevels", capabilityCode]`) — pre-existing, not touched; no cache-key change needed for the added field (stale cache renders `undefined` → "0 XP").
- **INFO** — Zod schema inline in `api/courseApi.ts` vs `entities/*/schemas/` — pre-existing repo-wide convention; the added transform is coherent (`nullish → undefined`; `?? 0` renders "0 XP").
- **INFO** — Review button `success-*` → `brand-*` and `outline` → `primary` styling changes look intentional (matches card variant); "✓ Completed" success badge retained.
- **INFO** — "1 XP per content item" business rule exists only as a hardcoded seed constant; `xp_events.xp_amount` is a separate XP model — worth an ADR whether card total should equal awarded XP. Seed 14 also overwrites deliberately-set values (e.g. 50/25) in non-reset environments.

## ✅ Verified clean

- **Auth**: touched endpoint `GET /api/v1/capabilities/:capabilityCode/levels` uses `requireAuth` (repo-approved SSO middleware, product check); no manual JWT/cookie parsing in the change.
- **Endpoint versioning**: `/api/v1/...` on all touched routes.
- **Body validation**: `POST /api/v1/capabilities` zod-validates before DB access (pre-existing).
- **No console / debugger / TODO / secrets**: entire staged code diff clean (single `console.error` is inside generated `lte-callflow.html` — artifact, not code). `.env`, `.dev.vars`, `dist/`, `coverage/`, `node_modules` untracked + gitignored.
- **Migration**: DDL-only (trigger-body UPDATE is runtime, not migration-time DML); `SET search_path = ''` with fully-qualified `public.*` refs; no trigger duplication/recursion; `NOT NULL DEFAULT 0` is metadata-only add on PG 11+; naming `YYYYMMDDHHMMSS_...` correct; transactional `BEGIN/COMMIT`. Local DB: `total_xp` column verified present (migration already applied locally).
- **Seeds**: DML-only, idempotent, correct `supabase/seed/{dev,production}/` placement and `seed_lte_catalog_NN_` naming; byte-identical dev/prod matches repo convention.
- **FSD**: `pages/course-detail` imports only entities/features/shared; no upward imports; slice `index.ts` files exist (`pages/course-detail/index.ts`, `ui/index.ts`, `entities/course/index.ts`).
- **Frontend/backend separation**: zero `functions/` imports in `src/` and vice versa; contract duplicated per rules.
- **API client**: `courseApi.ts` uses `apiFetch`; no plain `fetch(`, `supabase.`, `localStorage` in changed files.
- **TanStack Query**: server data not copied into Zustand; loading states restricted to the 3 allowed types (skeletons, no custom spinners).
- **Design tokens**: every color used is defined in `src/app/styles/index.css` `@theme`; no hex/arbitrary values; Tailwind-only, no custom CSS.
- **Mobile-first**: card defaults to `flex-col`; page grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; no desktop-first patterns in the diff.
- **Tests**: `.test.ts` correct for pure logic; new backend tests exercise both mapped value and default path; new frontend test covers statuses, target level, duration (hrs + min), XP formatting, "0 XP" branch; no residual references to removed `unlockRequirement`/`"Complete Level"` anywhere in `src/__tests__/` (grep-verified).
- **Backend test placement**: colocated `__tests__/` next to source — deviates from steering letter (`functions/__tests__/`) but matches all 7 existing backend suites (no `functions/__tests__/` exists); not in `src/__tests__/`, so no strict violation.

## Summary

- **Merge-blocking:** C1 (test fails — confirmed at runtime), C2 (12 typecheck errors — reproduced; incl. 2 in the backend test suite the subagent audit cleared), H1, H2 (unstage/regenerate graphify artifacts), H3 (one-line seed WHERE fix).
- **Should-do with this change:** M1, M2 (test placement + public-API exports), L1–L4.
- **Follow-up tickets:** H4 (unauthenticated progress endpoint), M3 (trigger coverage on moves/structural deletes), L6 (error message disclosure), L7 (ignore/secretlint coverage of nested artifact paths), XP-rule ADR.
- **Not caused by this change:** all pre-existing findings (H4, M4, L6, query-key/userId gap, inline schemas) — reported for completeness; the diff does not regress them.

## Post-audit re-verification (2026-08-05, after review challenge)

Empirical gate runs that corrected/confirmed the subagent findings:

| Gate | Command | Result |
|------|---------|--------|
| Runtime test | `npx vitest run src/__tests__/courses/pages/CourseDetail.test.tsx` | **FAIL — 1 failed** (`CourseDetail.test.tsx:221`, button "Continue →" not found) → C1 confirmed |
| Typecheck | `npm run typecheck` | **FAIL — 12 errors, all in staged test files** → C2 confirmed and expanded (was reported as 2, actual 12: queries.test.ts:316,335; CourseDetail.test.tsx:185; dynamicLevels.test.ts:7,71,84-86,91,92,97,110) |
| XP rendering wiring | `grep xp HEAD:CourseLevelCard.tsx` (8 hits) + working tree | `xp?: string` prop and both render sites (lines 128–131, 293–296) **pre-existed**; this change populates it via `mapApiLevelsToCards` — feature complete, no gap |

Corrections to initial report: (1) C2's scope was materially understated — the backend
subagent explicitly cleared `queries.test.ts` ("compiles fine") and the frontend agent
reported only 2 of 9 errors in `dynamicLevels.test.ts`; (2) the `totalXp` field is
**required** in the frontend zod output type, which is why every existing `CapabilityLevel`
mock now fails typecheck — root cause worth fixing in the schema (make it optional output
or add mocks).

## Fix execution (2026-08-05, approved scope: Batches 1–3 + drop L1)

| Item | Change applied | Status |
|------|----------------|--------|
| C1 | `CourseDetail.test.tsx:221` — assertion `"Continue →"` → `"Start →"` | ✅ |
| C2 (12 errors) | `queries.test.ts:316,335` → `result[0]?.totalXp`; `CourseDetail.test.tsx:185` mock + `totalXp: 0`; `dynamicLevels.test.ts` + `status: "published"` (3 mocks) + `cards[i]?.` (6 sites; `?.` chosen over `!` to keep biome `noNonNullAssertion` clean) | ✅ |
| H1 | Unstaged stray `lte/graphify-out/lte-callflow.html`; deleted nested `lte/lte/` dir (fuseblk mount needed retry on absolute path) | ✅ |
| H2 | `graphify-out/.graphify_root` restored to `.`; `graphify update .` from lte root → 2249 nodes, 4063 edges, 149 communities; graph.json re-staged; callflow HTML regenerated at correct (gitignored) location | ✅ |
| H3 | Both seeds: `WHERE "xp_reward" IS DISTINCT FROM 1` — fires the sync trigger for every non-1 row, heals all levels | ✅ |
| L3 | Migration header added (`-- Phase: 1 of 3 (Expand) / Breaking / Rollback / Context / Deployment order`) | ✅ |
| L1 | Dropped dead `LevelRow.total_xp` from `courses/types.ts` — file now matches HEAD, drops out of diff | ✅ |
| L4 | Left as-is (chosen): schema_migrations prevents reruns | — |
| M1/M2/L5, L2, H4, M3, M4, L6 | Out of scope (per decision); H4/M3/M4/L6 remain follow-up tickets | — |

### Post-fix gate results (all run 2026-08-05)

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `npm run typecheck` | **PASS — 0 errors** |
| Touched tests | `npx vitest run` (CourseDetail, dynamicLevels, capabilities queries) | **PASS — 3 files / 24 tests** |
| Full suite + coverage | `npx vitest run --coverage` | **PASS — 87 files, 721 passed, 1 skipped; no threshold errors** |
| Full suite (post `?.`) | `npx vitest run` | **PASS — 87 files, 721 passed, 1 skipped** |
| Biome | `npx biome check .` | **PASS — 0 errors, 0 warnings** |
| ESLint | `npx eslint .` | **PASS** |
| Secretlint | `npx secretlint "src/**/*" "functions/**/*"` | **PASS** |
| File types / lengths / console | `npm run lint:files` / `lint:lengths` / `lint:console` | **PASS** |

Final staged set: 12 files (stray HTML artifact removed; `courses/types.ts` reverted to
HEAD). All fixes left uncommitted per decision.

## Second-pass self-audit (2026-08-05) — gaps found on re-check

Re-verified every layer not covered by the original subagent split (xp data flow at the
page level, seed numbering, DB trigger state via live query, docs coverage, JSDoc
convention, function-size rule, final staged diff). Three pre-existing, repo-wide gaps
the earlier audit missed — none introduced by this change, none blocking:

| # | Gap | Rule | Status |
|---|-----|------|--------|
| S1 | No JSDoc/TSDoc on public APIs — `functions/api/v1/capabilities/queries.ts` included. Codebase-wide: **0 files** in `functions/` + `src/` contain `/**`, so the rule is universally unenforced | 00-core-standards §1.2 "All Public APIs: Must have JSDoc/TSDoc" | Pre-existing; team-wide follow-up (not fixing one file — inconsistent) |
| S2 | `getLevelsForCapability` is 51 lines vs 50-line max; the diff pushed it 49→51 | 00-core-standards §1.1 | Pre-existing; borderline |
| S3 | No API documentation exists for the capabilities/levels endpoints in `docs/` — nothing to update for the new `totalXp` field | 00-core-standards §1.2 / README standard | Pre-existing; repo-wide |

Verified NOT missed (close calls): xp flows end-to-end (`CourseDetailPage.tsx:300`
`{...level}` spread → card renders `xp` at both card/list sites); seed 15 is the next
free slot after 14 (dev slot 14 was already taken by `seed_lte_catalog_14_artifact_question_response_types_20260805.sql`, so the XP-reward seed was renumbered to 15); dev/prod seeds byte-identical; live DB query confirms
`trg_sync_level_total_xp` + `sync_level_total_xp` applied; `.kiro/` is tracked so the
verification doc belongs in the staged set; migration intact after header edit; full
`npm run lint` (eslint + stylelint) passes; final staged diff contains all 12 fix sites
(4× `status`, 6× `?.`, `totalXp: 0`, `Start →`, 2× `result[0]?.`) — 13 files, nothing
stray.

## Follow-up execution (2026-08-05, post-audit "continue")

Audit follow-ups worked in priority order. Fixes applied and verified (typecheck 0
errors; 45/45 tests in affected suites — level-modules, level-content, capabilities
levels; biome + full lint clean):

| Finding | Fix | Files |
|---------|-----|-------|
| H4 — unauthenticated `GET /courses/:capabilityCode/levels/:levelId` trusted arbitrary `?userId=` query param, exposing any user's per-module progress | Mirrored the authenticated sibling route `courses/[levelId]/index.ts`: `requireAuth` + `user.sub`, dropped query param, added `AuthError` handling + requestId/error codes | `functions/api/v1/courses/[capabilityCode]/levels/[levelId]/index.ts`; frontend cleanup: removed dead `userId` param from `fetchLevelDetails` (also absent from `useLevelDetails` query key — was already half-dead), `useLevelDetails`, `LevelModulesPage` caller; `levelContentApi.ts`, `useLevelContentData.ts`, `LevelModulesPage.tsx` |
| M4 — `capabilityCode` route param not zod-validated in `capabilities/[capabilityCode]/levels.ts` (raw `context.params` read) | Added `CapabilityCodeParamsSchema` (`z.string().trim().min(1)`), 400 `VALIDATION_ERROR` on failure; simplified 404 branch | `functions/api/v1/capabilities/schemas.ts`, `functions/api/v1/capabilities/[capabilityCode]/levels.ts` |

Remaining, deferred as tickets (not applied — reasons below):

| Finding | Reason deferred |
|---------|-----------------|
| L6 — raw `error.message` in 500 responses repo-wide | Cross-cutting change across ~20 endpoints; existing convention pairs it with `apiLogger.error`; fixing one endpoint would be inconsistent — team-wide decision |
| L2 — `(row as { total_xp?: number })` cast in `queries.ts` | Cast is correct; real fix is regenerating Supabase types (`supabase gen types`) which requires CLI approval |

### M3 — APPLIED (2026-08-05, user approval "do A")

Folded into the same (unreleased) migration `20260805120000_add_levels_total_xp_column.sql`:
`sync_level_total_xp()` now dispatches on `TG_TABLE_NAME` (modules / modules_content /
e_content), and two new triggers were added:
`trg_sync_level_total_xp_modules` (AFTER INSERT/UPDATE/DELETE on `modules`) and
`trg_sync_level_total_xp_modules_content` (AFTER INSERT/UPDATE/DELETE on
`modules_content`). Module moves between levels and structural deletes now
recompute both affected levels (UPDATE handles OLD + NEW level_ids).
Migration header updated (description, rollback, deployment order).
NOTE: local dev DB still runs the pre-M3 function — needs `supabase db reset`
(explicit approval required) to reconcile objects + migration history.
