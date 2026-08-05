# 2026-08-04 CI-Hardening & Coverage — Implementation Summary

## Scope
Close every verified CI gap in the `feat/settings-module` change set and ship the
settings-module test coverage work with a fully green CI parity gate. All changes remain
**uncommitted** (per decision).

## Deliverables

### Test coverage (Phase 2, carried over)
- Coverage targets enforced in `vite.config.ts` (80/75/75/80) and CI (`npx vitest run --coverage`).
- Final: **80 test files, 689 passed + 1 skipped** — zero tests lost. All-files coverage:
  **stmts 85.34 / branch 76.74 / funcs 77.71 / lines 86.17** (thresholds met).
- New tests: settings (account/password/profile/schemas), auth/env/sso-client,
  xp-engine (74 it), courses queries (63 it), capabilities, learning-paths, stages,
  ResourceContentViewer/types.ts.

### CI gap fixes (Phase A)
- `lint:lengths` (1000-line cap) was failing on two files — **split**:
  - `courses/__tests__/queries.test.ts` (1356 ln) → `helpers.ts` + 5 per-function test files.
  - `lib/__tests__/xpEngine.test.ts` (1670 ln) → `xpEngine.helpers.ts` + 3 domain files.
- **Formatter conflict resolved** (new finding): lint-staged ran `biome --write` then
  `prettier --write`; prettier output (single quotes) failed `biome ci` (double quotes).
  Reordered `.lintstagedrc.json` to `prettier → eslint → biome` so the committed state
  matches the CI authority (biome). Verified empirically with a lint-staged cycle test.
- `biome ci --changed` was failing on format for the whole change set — all files now clean:
  **0 errors, 9 infos** (down from 1 error + 4 warnings + 18 infos).

### Polish (Phase B)
- `profile.ts`: `UserMetadata` interface at the metadata cast boundary → dot access,
  8 `useLiteralKeys` infos eliminated, tsc-safe under `noPropertyAccessFromIndexSignature`.
- `issues[0]!` → `issues[0]?.message ?? "Invalid input"` (password.ts, profile.ts).
- `xpEngine.helpers.ts`: `Record<string, any>` chains → typed `XpMockChain` interface
  (2 `noExplicitAny` warnings eliminated).
- 3 stale `biome-ignore` comments removed (interface declarations don't trigger the rule).
- `password.test.ts`: `Record<string,string>` + bracket access → native `Headers` +
  `.set()` (fixes the tsc-vs-biome conflict cleanly).

### Process (Phase C)
- `graphify update ./lte` verified landed (graph.json mtime 2026-08-04).
- Nested junk dir `lte/lte/graphify-out/` removed (tracked, deleted).
- ADR-005 (Zod input validation) created.

## Left to owners (per decision)
- Info-level `useLiteralKeys` in other in-flight work: `SettingsPage.tsx:167-170`,
  `middleware/auth.ts:22`, `env.ts:8`, `Achievements.tsx:61`, `LevelModuleList.tsx:108`,
  `capabilities/[capabilityCode]/levels.ts:15`. Non-blocking (info level).
- Dead branches flagged earlier (courses/queries.ts:161 `|| []`, :598) — product decision.
- Root monorepo `graphify-out/` (07-25) untouched — out of lte scope.
