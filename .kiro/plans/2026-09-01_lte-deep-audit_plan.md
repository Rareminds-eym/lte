# LTE Industrial-Grade Deep Audit — Detailed Remediation Plan

**Date:** 2026-09-01
**Target:** `lte/` (Learner Transformer Engine — FSD + Cloudflare Pages Functions + Supabase + R2)
**Author:** Muse Spark — 10 parallel probes (5 primary + 5 deep) + internet ground-truth
**Mode:** Build — plan updated with 30yr lead product engineer lens (over-engineering vs gaps); edits gated behind **Approvals Required §**
**Standards:** IEEE 730-2026 (2026-08-21 Active, 80/75/85), ISO/IEC/IEEE 12207:2017, DORA 2026 Elite (multiple/day, <1h, 0–5% CFR, <1h MTTR), OWASP Top Ten 2025 (Nov 2025 current, +A09 SupplyChain/+A10 Mishandling), Cloudflare Workers 2026 (compatibility_date=today, nodejs_compat, streaming, waitUntil, bindings-over-REST, Hyperdrive for pg driver)
**Lead Product Lens:** 30yr product engineer — Ponytail (ladder: YAGNI→stdlib→native→installed dep→1-line→min code) + Cost vs Value for 3-week MVP (PRD/TRD North Star: 1 learner loop demo)

---

## 0. Verification Process (Mandatory)

```
- Sequential Thinking: Used — decomposed into 6 pillars (arch, security, quality/testing, Cloudflare, DB/API, prod/readiness) then 5 deep sweeps (frontend a11y/perf, DB per-migration, supply-chain, resilience, compliance)
- Architecture Review: Read lte/.kiro/architecture/* (MISSING — 0 files), lte/docs/architecture/ARCHITECTURE.md:1 (250L tree only), lte/graphify-out/GRAPH_REPORT.md:1 (4590 nodes/10056 edges vs lte/graphify-out/graph.json:1 raw 4115/9088 — 475 vendor drift), lte/graphify-out/wiki/index.md:1, lte/.kiro/adr/* (2/—), lte/README.md:1 (765L), lte/wrangler.toml:1, lte/vite.config.ts:1, lte/tsconfig.json:1, lte/package.json:1
- Internet Searches: 4 performed (IEEE 730-2026 → published 2026-08-21 supersedes 730-2014; DORA 2026 → Elite multiple/day <1h 0–5% <1h, 2025 retired 4-tier → 7 archetypes; OWASP Top Ten 2025 → Nov 2025 8th edition current; Cloudflare 2026 → Hyperdrive for pg driver, observability.enabled)
- Files Read: 90+ sampled — src/pages/level-content/ui/LevelContentPage.tsx:1, src/shared/store/xpModalStore.ts:1, src/shared/index.ts:1, functions/middleware/auth.ts:1, functions/lib/query-gateway/gateway.ts:1, functions/api/v1/artifacts/queries.ts:1/query-policies.ts:1, functions/lib/artifact-evaluator/artifact-evaluator.ts:1/index.ts:1, functions/lib/ai-engine/openrouter/client.ts:1, wrangler.toml:1, supabase/migrations/*.sql ×34, supabase/config.toml:1, supabase/README.md:1, .nvmrc:1, Dockerfile:2, biome.json:27, manifest.json:1, ci.yml:41, knip.json:36, .secretlintrc:1, TRD §9.6/§14
- Uncertainties: RLS intentionally declined per verifications/2026-08-10 H2 vs defense-in-depth; Hyperdrive intentional vs debt (Supabase JS is HTTP not pg); per-isolate limiter ponytail acknowledged; PRD v2.2 not on disk (glob 0) — doc debt
- Approvals Needed: RLS migration (DDL), Node 20→22 bump, observability enablement, docs RLS claim correction, god-file splits Phase 3 deletes, compatibility_date bump, bulkhead/Queue at scale, **Product: cut engagement +1 fail XP (PRD violation), delete 4 mock dashboard widgets, add Roadmap/Readiness wiring (1d each), keep vs delete viewer sprawl**
```

---

## 1. Executive Summary

**Overall Engineering: 6.0/10 — Staging-Ready, Not Industrial-Grade** (5.2 before false-positive correction → 6.0 after) · **Product Completeness (3-week MVP): 4.0/10** · **Over-Engineering: 4/10** (10=just right)

LTE’s engineering foundations are **elite** (FSD boundaries enforced, gateway ownership injection, artifact hardening with caps + assessability gate + exactly-one-latest, 88.9% lines coverage, 18 lint gates). Runtime operability is **prototype-grade** (no health, per-isolate metrics, per-isolate limiter, no load test, no CD/rollback, docs lie about RLS/ports). **Product is half-built, UI shell over-built** — one learner *can* `assessment→track→courses→levels→6E→artifact→AI→XP→readiness` via APIs, but *cannot* `pick role, see 6-month roadmap, see readiness breakdown, or get marketplace eligibility` from UI. Dashboard is 4 of 7 widgets fabricated (`dashboardApi.ts:16` `MOCK_DASHBOARD_DATA`).

98% fallout risk per Cortex 2024 is **observability + deploy**, not code quality — this plan fixes the gate in 3 phases without touching vendor or AI-prompt semantics. **Lead product take:** keep deterministic engine (`6E→artifact→AI→XP→readiness`), fix its 0-XP leak, expose what it already computes (roadmap, readiness breakdown, eligibility), and delete mock dashboard / engagement economy / viewer sprawl — 3-week ship.

| Pillar | Score | Verdict |
|--------|-------|---------|
| Architecture (FSD/DDD, ADRs, graph) | 6.5/10 | Strict boundaries, 2 low-severity cycles, missing `.kiro/architecture` (docs at wrong path), ADRs 2 but compliant |
| Security (OWASP 2025) | 6.5/10 | Gateway injection-proof, auth-client/core correct, 5 policies missing `ownership`, RLS 0 intentional but docs false, per-isolate limiter ponytail |
| Code Quality & Testing (IEEE 730-2026) | 6.0/10 | 88.9% lines, dual Vitest, functions 75≠85 (should 85), 0 E2E, god files >400L |
| Cloudflare 2026 | 6.0/10 | RPC memoized (sso-api) + streaming + bounded I/O exemplary; stale `2026-06-08` date, no `observability`/`wrangler types`, Hyperdrive **false P0** (Supabase JS is HTTP) |
| DB/API (Expand-Migrate-Contract) | 4.3/10 | Recent DDL/DML split exemplary; legacy 4× `TYPE jsonb` single-step, `20260801` DML+bad name, 9 tables no `updated_at` trigger, `SECURITY DEFINER` bypass |
| Prod Readiness (Cortex PRR, DORA) | 3.5/10 | Logs per-requestId but no sink, metrics per-isolate, no `/health`, no SLO/DORA 0/4, no runbooks/RACI, onboarding 404s |
| Frontend (WCAG/perf/resilience) | 4.6/10 | Render-phase setState + stale closure, WCAG systemic, chunk 2500 mask, single ErrorBoundary, PWA not installable |
| **Product Completeness (PRD FR1-FR16)** | **4.0/10** | Loop works via APIs, but roadmap 0, marketplace/consent 0, readiness UI 0, role picker 0, dashboard 4/7 mocks, GDPR delete 0 |
| **Over-Engineering (Ponytail)** | **4/10** | 19 lint gates, QueryGateway 750LOC for 1 impl, 7 manualChunks, 90 icons, 6 viewers, engagement XP 9 types — cost before value |

**What is already world-class — preserve:**
1. FSD + `eslint boundaries` + `steiger` + 18 `lint:*` gates + `validate-runtime-separation`/`endpoint-versioning` — zero `src↔functions` imports.
2. Mandatory `@rareminds-eym/auth-client@2.1.0` / `auth-core@3.0.0` + `SSO_SERVICE` service binding memoized per `env.SSO_SERVICE` ref (`middleware/auth.ts:10`, `[[path]].ts:8`) + `__Host-rm-refresh` `Secure/HttpOnly/SameSite=Strict`.
3. Query Gateway `gateway.ts:31` bans `select("*")`, `ownershipFilter:50/rejectRequestOwned:80/assertAllowedColumn:99`, `sanitize.ts:pickAllowedPayload`, `pagination max 50`.
4. Artifact hardening: `artifact-extractor` caps 50k/15p/20sheets + `artifact-file-guard` magic-bytes/zip-bomb + `readBodyWithCap 25MB` streaming + `uq_artifact_submissions_latest/is_latest` + `23505` idempotency + `rollback 437` R2 orphan cleanup + fallback never-pass (`artifact-evaluator.ts:80` score 0 human_review).

---

## 1.5 Lead Product Engineer Lens — 30 Years (Gaps vs Over-Engineering)

**Score:** Product 4.0/10 · Over-Engineering 4/10 (10=just right). Cost sink ~40% `functions/lib` is eval-hardening + gateway ceremony; dashboard/viewer polish burns week yet still mock. Cheapest win: wire `GET /api/v1/readiness` to Dashboard card (1d) + Roadmap timeline (1d, reuse `role_capability_sequence`) → 4.0→6.5 without new tables.

### Top 5 Gaps — BLOCKING 3-WEEK DEMO (PRD/TRD)

| # | Gap | PRD | Status | file:line |
|---|-----|-----|--------|-----------|
| **G1** | **6-Month Roadmap 0** | FR4 P0 | No UI, no endpoint `learner/roadmap` not in `functions/api/v1`, `AppRouter.tsx:33` no `/roadmap` | `LTE_3_Week_MVP_PRD:348` — month-wise focus/courses/artifacts never rendered; only `learning-paths/queries:504` string `duration "6 months"` |
| **G2** | **Marketplace eligibility + consent 0** | FR13 §16 P0 + GDPR | No `marketplace/*` handlers, no `consent` table, `readiness/index:341` no eligibility check | `PRD:621` eligibility 5 checks + `730` versioned consent; `grep marketplace|consent functions` 0 |
| **G3** | **Readiness UI 0** | FR12 | Backend `readiness/index:341` 30/25/25/10/10 + `missingEvidence:374` perfect but never mounted; `DashboardPage:120` merges only `%` ring | `PRD:606` band+components+actions not shown |
| **G4** | **Role picker 0** | FR3 P0 | Only auto `resolveActiveTrack learner-track.ts:99` + `LearningPathInitializer:26 ?trackId=` hack; no `GET /roles` picker | `PRD:343` learner/admin assignment not exposed |
| **G5** | **Dashboard mock + GDPR delete 0** | FR11 + §16 | `dashboardApi.ts:16` 5 gaps/3 priorities fabricated → `DashboardContent:23` 3-row grid lies; `settings/account.ts:37` only `inactive` soft-hide | `PRD:388` “actual progress not views” violated; GDPR erasure fails |

### Top 5 Over-Built — DELETE BEFORE LAUNCH

| # | Over-built | Location | Waste | file:line |
|---|------------|----------|-------|-----------|
| **O1** | **Artifact pipeline ~600LOC pre-LLM** | Extractor caps + file-guard magic-byte/zip-bomb + 3× buffer passes + R2 rollback envelope | P0 only plain-text; Office P1 default `human_review` `TRD §8.4` — 5 test files for 1 happy XLSX | `artifact-extractor.ts`, `artifact-file-guard.ts`, `queries:403` |
| **O2** | **6 viewers + heavy deps** | Pdf/Docx/Spreadsheet/Video/Image/Pptx + `mammoth/pdfjs/@file-viewer/pptx` | URL fallback sufficient `PRD:814` — `LevelContentPage:768` tabs burn week | `src/entities/course/ui/resource-content-viewer/*`, `package.json:7,15,18` |
| **O3** | **Widget city on mock** | 7 widgets `career-target-banner/gap-map/achievements 18 unlocked:151` | 4 widgets never receive real data (`fetchDashboardData:191` overwrites 3/7) | `dashboardApi:16`, `widgets/dashboard/*` |
| **O4** | **Engagement XP economy 9 types** | `streak_7/consistency_30/legacy/milestones/daily_login` + `xp-engine.core:22` + `dashboard/xp:60` | PRD P2 `257` post-MVP; `+1 on failure:12,16,18` **violates PRD 536 `0 XP` on fail** — readiness filters `progress:373` but UI celebrates failure | `functions/lib/xp-engine.core:22`, `xp-engine.progress:498` |
| **O5** | **Gateway 750LOC + 19 lint gates** | `query-gateway/` 35 policies + 19 `scripts/checks/*.js` + `package.json:36 22 lint:*` | `<15 tables` MVP — `supabase.from()` + RLS ships faster; `test:dev` 18 sequential + `ci.yml:41` `changed_files` dance dup `boundaries/biome/steiger` | `functions/lib/query-gateway/*`, `scripts/checks/*` |

### Keep / Cut / Defer (Ponytail — shortest path to demo)

**Keep (prove 1 learner loop):** Auth `middleware/auth:85`, `resolveActiveTrack:99`, `CoursesPage:45`→`Levels`→`LevelContentPage:235` 6E lock + `SilentContentTimer`, `submit:81`→`artifact-evaluator:655`→`XP:29`→`mastered:775`, `readiness:344`, `dashboard journey/xp` real.

**Cut now (−1 week, −lies, −bundle):** Engagement XP 9 types `xp-engine.core:22`, 5 viewers keep PDF/text only, 4 mock widgets `dashboardApi:16`, inert `Filter CoursesPage:222`/`Header:83` notification badge. Saves ~1500LOC + `+1 fail XP` misalignment.

**Defer (after loop flawless):** Roadmap `TRD-API-005`, Marketplace `§12`, Admin `028`, Manual-review UI, Hard delete/export, Offline KV, Browse-all catalog, Notifications.

**Concrete delete table (no behavior change):** QueryGateway→`db.ts 80L` **-600L**, lint 19→7 **-720L**, `manualChunks`+`projects` **-85L**, merge loggers **-100L**, icons 90→sprite **-1200L**, collapse XP `xp-engine.*` + HMAC **-90L** → **~2,800L + 90 files**.

---

## 2. Latest Ground-Truth Reference (What Changed Since Training Data)

| Standard | 2026 fact used as bar |
|----------|-----------------------|
| **IEEE 730-2026** `standards.ieee.org/ieee/730/10854` | Published **2026-08-21**, Active, supersedes 730-2014, harmonized `12207:2017`. Minimum SQA = **80% line / 75% branch / 85% function** (not 75). Ratchet > fixed threshold. |
| **DORA 2026** `dora.dev` + Gitrecap 2026-04-09 | Elite: deploy **on-demand multiple/day**, lead **<1h**, CFR **0–5%** (some sources 0–15% — 2025 recalibrated), MTTR **<1h**. 2025 report retired 4-tier → **7 archetypes**; last 4-tier 2024: Elite 19%/High 22%/Low 25%. Speed+stability correlated (973×/6570×). |
| **OWASP Top Ten 2025** `owasp.org/www-project-top-ten` | **Current is 2025** (Nov 2025, 8th edition, first since 2021). New **A09 Software Supply Chain Failures**, **A10 Mishandling of Exceptional Conditions**; A01 Access Control absorbs SSRF+CSRF. |
| **Cloudflare 2026** `developers.cloudflare.com/workers/best-practices` + `cloudflare/skills 2026-06-05` | `compatibility_date=today` + `nodejs_compat`, `wrangler types` (no hand-written Env), streaming (no `await text()` unbounded), `ctx.waitUntil` (no destructure), bindings-over-REST, service-bindings RPC `WorkerEntrypoint`, **Hyperdrive for `pg` driver only** (not Supabase JS/PostgREST), `observability.enabled + head_sampling_rate` + JSON logs |

---

## 3. Detailed Findings — Each Issue Properly Explained

### P0 — Block next prod cut

#### P0-1 Render-phase `setState` — `src/pages/level-content/ui/LevelContentPage.tsx:94` **CRITICAL**

**Current:**
```ts
if (levelModule?.id !== prevModuleId) {
  setPrevModuleId(levelModule?.id);
  setOptimisticCompletedStages([]);
  setSubmittedArtifactIds([]);
  setIsScenarioExpanded(false);
}
```
At top-level render, not inside `useEffect`. Under `StrictMode` (`main.tsx:24`) React double-invokes render → state setters fire during render → React warns *“Cannot update during an existing state transition”* and under fast nav (moduleNo 1→2) can loop. Also causes `optimisticCompletedStages` to reset even when `levelModule` is `undefined` briefly.

**Standard violated:** React Rules of Hooks; `00-core §5` fail-fast (validate before mutate).

**Fix:**
```ts
useEffect(() => {
  if (levelModule?.id && levelModule.id !== prevModuleId) {
    setPrevModuleId(levelModule.id);
    setOptimisticCompletedStages([]);
    setSubmittedArtifactIds([]);
    setIsScenarioExpanded(false);
  }
}, [levelModule?.id, prevModuleId]);
```

---

#### P0-2 Stale closure XP miscount — `src/pages/level-content/ui/LevelContentPage.tsx:708` **HIGH**

**Current:**
```ts
onXpEarned={(xpAmount, eventType) => {
  setTotalXpAmount((prev) => prev + xpAmount);
  addEvent({ totalXp: totalXpAmount + xpAmount, // ← captured stale
  });
}}
```
`totalXpAmount` is from closure at render time; two artifacts submitted in <100ms (queue `xpModalStore 100ms`) → second modal shows `initial+second` not `initial+first+second`. Correct pattern exists at `handleMarkStageDone onSuccess:544` using server `total`.

**Fix:**
```ts
onXpEarned={(xpAmount, eventType) => {
  setTotalXpAmount((prev) => {
    const next = prev + xpAmount;
    addEvent({ id: crypto.randomUUID(), xpAmount, totalXp: next, eventType, xpCategory: "evidence", onClose: () => triggerNavigationTransition("artifact_submit", null, null) });
    return next;
  });
}}
```

Also debounce `selectedContentForSync` `useEffect:145` `updateStage in_progress` on every `contentId` change — spam `POST /progress` on tab switch. Add 800ms debounce + `document.visibilityState==="visible"` guard.

---

#### P0-3 IDOR on demote — `functions/api/v1/artifacts/query-policies.ts:98` **HIGH**

**Current:**
```ts
export const artifactSubmissionDemotePolicy = {
  table: "artifact_submissions",
  operation: "update",
  updateColumns: ["is_latest","updated_at"],
  filters: ["id"], // ← no ownership
} as const;
```
`gateway.ts:50` only injects `user_id` when policy declares `ownership`. Called at `queries.ts:218` after ownership read, but policy reusable — future RPC could `demote` sibling’s submission via guessed UUID.

**Also:** `artifactSubmissionFileInsert:168`, `artifactMetaRead:153`, `artifactQuestionDetailsRead:160`, `moduleArtifactAccess:68` lack `ownership`.

**Fix:**
```ts
export const artifactSubmissionDemotePolicy = {
  table: "artifact_submissions",
  operation: "update",
  updateColumns: ["is_latest","updated_at"],
  filters: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;
// queries.ts:218
await qb.update(artifactSubmissionDemotePolicy, { auth:{userId}, data:{is_latest:false}, filters:[{column:"id",op:"eq",value:latest.id}] });
```
Add `ownership` to the four read policies or document as catalog-public with comment.

---

#### P0-4 `SECURITY DEFINER` privilege escalation — `supabase/migrations/20260812093636:4` **HIGH**

**Current:**
```sql
CREATE FUNCTION public.mark_xp_events_shown(p_event_ids UUID[], p_user_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE public.xp_events SET metadata=jsonb_set(...) WHERE id=ANY(p_event_ids) AND user_id=p_user_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.mark_xp_events_shown(UUID[],UUID) TO authenticated;
```
Missing `SET search_path=''` (compare `20260716092555:487` good) and trusts `p_user_id` param — any `authenticated` JWT can `supabase.rpc('mark_xp_events_shown',{p_event_ids:victimIds, p_user_id:victim})` bypassing gateway.

**Fix:**
```sql
CREATE OR REPLACE FUNCTION public.mark_xp_events_shown(p_event_ids UUID[], p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- derive from auth.uid(), ignore caller-supplied p_user_id unless equal
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.xp_events SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{modal_shown}','true'::jsonb)
  WHERE id=ANY(p_event_ids) AND user_id=auth.uid();
END; $$;
-- or drop p_user_id param entirely
```

---

#### P0-5 Docs lie (onboarding breaker) — `supabase/README.md:17/76/84`, `functions/README.md:3` **HIGH**

Missing `.kiro/architecture` is **partial** (docs exist at `docs/architecture/ARCHITECTURE.md` but wrong path per `00-core §1.2`). Real breakers are:

| Doc | Line | Claim | Reality | Impact |
|-----|------|-------|---------|--------|
| `supabase/README.md:17` | Port table | `54321/54322/54323` | `config.toml:11 54341/54347/54343` | `supabase start` studio 404 |
| `supabase/README.md:76` | Schema | `users/courses/lessons/enrollments/progress` | 28 tables `capabilities/levels/modules/.../xp_events` | Mental model wrong |
| `supabase/README.md:84` | `All tables have RLS enabled` | `grep ENABLE ROW` 0 | Incident misroutes |
| `functions/README.md:3` | `AWS Lambda/Firebase` | `wrangler.toml:1 Cloudflare Pages` | New hire follows AWS |

**Fix:** Rewrite tables from `supabase db diff`, correct ports, change RLS line to “RLS intentionally off — via service_role + gateway (see ADR-H2)”, rewrite `functions/README` to Cloudflare bindings `SSO_SERVICE/STORAGE_BUCKET`.

---

#### P0-6 Node triple drift — `.nvmrc:1 20` vs `package.json:77 >=22` vs `Dockerfile:2 node:20-alpine` vs `ci.yml:15 22.x` **HIGH**

Node 20 EOL 2026-04-30 — local/Docker run unpatched `workerd/biome` binaries vs CI.

**Fix:** `.nvmrc 22`, `Dockerfile FROM node:22-alpine`, `wrangler.toml:5 2026-06-08→2026-09-01`, `package.json:74 pages:dev --compatibility-date=2026-09-01`.

---

#### P0-7 `wrangler` in prod deps — `package.json:25` **MEDIUM-HIGH**

Bloats Pages Function bundle + `npm audit` surface.

**Fix:** `npm rm wrangler && npm i -D wrangler@4.120.1 --save-exact` (keep pinned `4.120.1`).

---

### P1 — Pre-GA hardening (real, but prior severity inflated)

#### P1-1 RLS 0 — defense-in-depth — `supabase/migrations/*` 0 policies **HIGH** (was CRITICAL) — **DECLINED per user 2026-09-01**

**Why downgraded:** Intentional per `verifications/2026-08-10 H2 Declined — no RLS, tables `GRANT ... TO authenticated` only, gateway `gateway.ts:193` sole `client.from`. User confirmed **no RLS for now**.

**Fix (docs-only, no DDL):** Rewrite `supabase/README.md:84` to “RLS intentionally off — via service_role + gateway (see verifications H2, plan 2026-09-01)”; keep `GRANT` as is. Revisit only if XSS/anon-key direct access becomes threat; then add `ENABLE ROW LEVEL SECURITY` in later phase (Fix A).

---

#### P1-2 CORS localhost in prod — `functions/middleware/auth.ts:35` **MEDIUM-HIGH**

```ts
approvedOrigins: ["https://lte.rareminds.in","http://localhost:8080","http://localhost:8789","http://127.0.0.1:8080", ...]
```
Same array for preview+prod — prod accepts `http://localhost`.

**Fix:**
```ts
const isProd = env.ENVIRONMENT==="production";
const approvedOrigins = isProd ? ["https://lte.rareminds.in"] : ["https://lte.rareminds.in","http://localhost:8080","http://localhost:8789","http://127.0.0.1:8080","http://127.0.0.1:8789"];
// + public/_headers
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Referrer-Policy: strict-origin-when-cross-origin
*/
```

---

#### P1-3 DML in migration + bad name — `supabase/migrations/20260801_publish_all_modules.sql:1` **MEDIUM** (was HIGH)

`UPDATE modules SET is_published=true` violates `04 §11.8.1` DDL-only (seed holds DML). Name `20260801` ≠ `YYYYMMDDHHMMSS` breaks lexical sort vs `20260805120000`. Small table → low lock, but breaks audit trail.

**Fix:** Move to `supabase/seed/production/seed_..._publish.sql`, rename migration to `20260801000000_publish_all_modules.sql` (DDL comment only).

---

#### P1-4 9 tables missing `updated_at` trigger — `20260729093954` **MEDIUM**

Catalog has `set_lte_timestamps:502` 11 tables, but 9 progress/artifact tables + `user_stage_progress` + `xp_events` have none. `artifact_submissions` demote sets `updated_at:219` manually, others don’t → dashboards stale, cache invalidation wrong. Split `set_lte_timestamps` vs `set_updated_at` diverges.

**Fix:** `CREATE TRIGGER trg_*_set_updated_at BEFORE UPDATE ON public.user_capabilities ... FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()` for 13 tables, unify on `set_lte_timestamps SET search_path=''`.

---

#### P1-5 Observability black box — `wrangler.toml` 0 `observability`, `functions/shared/logger.ts:24` human-readable, no `/health` **HIGH**

- No `[observability] enabled/logs.head_sampling_rate/traces` (`02-cloudflare §7.8` required).
- Logger ` [ISO][LEVEL][cat] msg {json}` not queryable in Log Explorer, no level gate (`debug` in prod vs `src/shared/config/logging.ts:33` gated), no `X-Request-Id`/`traceparent`.
- `nginx.conf:50` static health vs `TRD:1934 GET /api/v1/health {status, checks}` unimplemented (`grep health functions` 0).

**Fix:**
```toml
[observability]
enabled = true
logs.head_sampling_rate = 1
[observability.traces]
enabled = true
head_sampling_rate = 0.05
```
```ts
// functions/shared/logger.ts → JSON
globalThis.console.log(JSON.stringify({ level, message, category, timestamp, requestId, ...metadata }));
// functions/api/v1/health/index.ts
export async function onRequestGet({ env }: PagesContext<LteEnv>) {
  const [db, r2, sso] = await Promise.allSettled([
    createServiceSupabase(env).from("roles").select("id").limit(1).then(r=>!r.error),
    env.STORAGE_BUCKET.head("healthcheck"),
    env.SSO_SERVICE ? Promise.resolve(true) : Promise.reject(),
  ]);
  const checks = { database: db.status==="fulfilled"&&db.value, storage: r2.status==="fulfilled", sso: sso.status==="fulfilled" };
  return Response.json({ status: Object.values(checks).every(Boolean)?"healthy":"degraded", timestamp:new Date().toISOString(), checks }, { status: Object.values(checks).every(Boolean)?200:503 });
}
```

---

#### P1-6 WCAG systemic + PWA not installable — `biome.json:27`, `manifest.json:1`, `VideoContentViewer.tsx:104` **MEDIUM-HIGH**

- `biome.json` only `useButtonType:warn` (16 a11y rules off), `eslint` no `jsx-a11y`, tabs `743` no `role=tablist/aria-selected` + dot 1.5:1, drawers `893`/`DashboardLayout.tsx:124` no `Esc`/trap/`aria-modal`, `ToggleSwitch:62 role=switch aria-checked` lies, `VideoContentViewer:104 role=application` anti-pattern + sliders no `aria-valuenow`, `index.css:48 #9ca3af/#f9fafb 2.4:1` fails AA, `manifest` single `favicon.ico start_url:"."` → not installable.

**Fix:** `biome.json a11y:{useValidAria:error, useAriaPropsForRole:error, ...}` + `eslint-plugin-jsx-a11y`, tabs `role=tablist/aria-selected tabIndex`, drawer `Esc`+`focus-trap`+`aria-modal`, video `role=slider aria-valuenow/min/max`, manifest `192/512 maskable start_url:"/"`, `index.html` OG/canonical.

---

#### P1-7 Per-isolate limiter + uncovered endpoints — `rate-limiter.ts:17 Map` **MEDIUM** (was HIGH)

Ponytail `per-isolate memory only, no external sink. If cross-isolate dashboards needed, upgrade is queue/analytics write` (`metrics.ts:9`) — correct for Pages isolate model at <1k RPS. HIGH only at 100k spec (`LTE_3_Week_MVP_TRD:85`). Currently 2 endpoints limited (`constants.ts:30 10/min`), 10+ auth’d unlimited.

**Fix when needed:** `KV RATE_LIMIT_KV` token bucket + global `_middleware` 429 `Retry-After`.

---

#### P1-8 `debug_telemetry` + PII retention — `evaluation.ts:46`, `TRD §9.6` 30-day **MEDIUM**

Persist fixed (`artifact-evaluator.ts:711` nulls `rawPrompt` on persist), endpoint still returns charCounts/latency to any owner. `TRD §9.6` 30-day purge cron missing (`wrangler.toml` 0 `crons`), PII sent to OpenRouter verbatim (`artifact-extractor`).

**Fix:** Gate `evaluation.ts:46` to `ENV!=production` or `staff`, add `triggers crons ["0 2 * * *"]` purge, regex scrub before `callOpenRouterAI`.

---

#### P1-9 God files / ADR gap — `LevelContentPage 931`, `queries 965`, `.kiro/adr` 2 files **MEDIUM**

`50/fn` ideal vs team `1000/file` (`validate-file-lengths.js:8`) — all pass file cap; 931-page orchestration borderline but functional. ADRs 2 are compliant (Status/Date/Context/Decision/Consequences/Alternatives); gap is coverage (RLS-decline, two-DB split `20260716092555 228L`, vendored `xlsx@0.20.3` CVE, `is_latest` partial index, XP categories).

**Fix:** Split `LevelContentPage→useLevelContentOrchestrator+StageNavigator`, `queries→file/submission/evaluation`, backfill 4 ADRs from `verifications/2026-08-10`.

---

### P2 — Low / false-positive (explain why not P0)

#### P2-1 Import cycles — `src/shared` & `functions/lib/ai-engine` **LOW** (was CRITICAL)

Via barrel (`xpModalStore→@/shared`) and metrics (`openrouter/client→artifact-evaluator/metrics→index→evaluator→ai-engine`). Vite/ESM resolves, no runtime break. Fix is 1-line deep import (`xpModalStore.ts:2 from "@/shared/config/logging"`).

#### P2-2 `chunkSizeWarningLimit 2500` `vite.config.ts:74` **LOW**

Intentional to allow `pdfjs/xlsx` large vendor; default 500 would spam. Fix is split `framer-motion/zustand/auth` into `manualChunks`, lower to 500 only after.

#### P2-3 Hyperdrive “missing” **FALSE P0 — remove**

`supabase.ts:19 createClient(SUPABASE_URL,SERVICE_ROLE_KEY)` is **Supabase JS over PostgREST HTTP**, not `pg` wire. Cloudflare `Hyperdrive` docs: `Hyperdrive for external PostgreSQL/MySQL via pg driver`. TRD diagram aspirational; no latency penalty for HTTP. Keep as P2 only if migrating to `pg`.

#### P2-4 Retry/breaker/DLQ/saga **LOW** (was MEDIUM)

`openrouter/client.ts:25` linear 500ms single-retry is **ponytail** for 30s isolate limit; breaker/bulkhead/Queue consumer + saga transaction overkill for Pages+Supabase HTTP now. Keep sequential `qb.upsert/update/awardXp` + `cleanupUploadedObjects:624` best-effort; add Queue/outbox at 10× scale.

---

### 3.5 Product-Specific Deep Findings (Cost vs Value — 3-Week Lens)

- **Cost sink:** ~40% `functions/lib` LOC is eval-hardening (metrics `METRIC`, drift-stats, template isolation `ADR-006`) and gateway ceremony. Pilot 10 learners×3 artifacts exercises <5%.
- **Value leak:** Dashboard/viewer polish consumes frontend week yet still mock — demo cannot answer “what do I do next?” without readiness breakdown (`readiness:416` computes `improvementActions` never rendered).
- **Cheapest wins:** Wire `GET /api/v1/readiness` card (1d) + Roadmap timeline `role_capability_sequence` (1d) → 4.0→6.5 without new tables.
- **Risk if not cut:** `+1 on failure` teaches failure pays — directly violates `PRD:536 Failed artifacts receive 0 XP`.

## 4. False Positives Corrected

| Prior CLAIM | Verdict | Why |
|-------------|---------|-----|
| Graph `xlsx 1060` god | **False** — vendor `vendor/sheetjs` inflated; `eslint` ignores vendor, `vite alias` pins local | Ignore vendor in graph via `.graphifyignore` |
| Hyperdrive P0 | **False** — Supabase JS HTTP vs pg | Remove P0 |
| Cycles CRITICAL | **Partial** — exists but LOW severity | Downgrade |
| 50/fn CRITICAL | **Partial** — team cap 1000/file; React pages legit large | Downgrade to MEDIUM |
| RLS CRITICAL leak | **Partial** — intentional per `verifications H2`, gateway sole guard | HIGH + docs fix, not CRITICAL |
| Per-isolate HIGH | **Partial** — ponytail acknowledged, correct <1k RPS | MEDIUM |
| `^` devDeps hijack CRITICAL | **Partial** — devDeps with `lockfileVersion 3` + 997 integrity → `npm ci` safe | LOW |
| Chunk 2500 HIGH | **Partial** — intentional for large vendor | MEDIUM |
| `.dev.vars` real keys CRITICAL | **Partial** — `gitignored`, `git ls-files` clean, `git status --ignored` confirms | LOW (local only, not committed) |

Revised overall **5.2 → 6.0/10** after 1 false removed + 5 downgrades.

---

## 5. Phased Remediation Plan

### Approvals Required (gated — do not execute without explicit “approve X”)

1. **RLS — DECLINED per user 2026-09-01** — no `20260901000000_enable_rls.sql`; keep gateway sole guard per `verifications/2026-08-10 H2`, fix `supabase/README.md:84` to “RLS intentionally off — via service_role + gateway” and optionally revoke `GRANT UPDATE/DELETE TO authenticated` later
2. **Node 20→22 bump** — `.nvmrc/Dockerfile/wrangler compatibility_date` (breaks local `nvm use`)
3. **Observability enablement** — `wrangler [observability]` + Analytics Engine/Queue sink
4. **Docs RLS claim correction** — `supabase/README.md:84` (security disclosure)
5. **God-file splits Phase 3 deletes** — `queries→4`, `LevelContentPage` hook extraction (Contract)
6. **Bulkhead/Queue at scale** — KV/Queue not needed now; approve when to enable
7. **Product cuts** — Engagement XP 9 types (`xp-engine.core:22` +1 fail violates PRD 536), 4 mock dashboard widgets (`dashboardApi:16`), viewer sprawl (`package.json:7,15,18`) — delete now vs keep for demo
8. **Product wiring** — Roadmap `GET /api/v1/learner/roadmap` + Readiness breakdown card + Marketplace consent table (each 1d, reuses existing `role_capability_sequence`/`calculateReadiness`)

### Phase 0 — 0.5 day — Unblock PR gate (no infra secrets, no DDL) + Product ponytail cut

| Task | File:line | Change | Verify |
|------|-----------|--------|--------|
| Render-phase → `useEffect` | `LevelContentPage.tsx:94` | `if(id!==prev) setPrev` → `useEffect([id])` | `npm run typecheck && vitest run src/__tests__/level-content/pages/LevelContentPage.test.tsx` |
| Stale closure → functional | `LevelContentPage.tsx:708` | `totalXp: totalXpAmount+xp` → functional `prev=>next+addEvent(next)` | same |
| Deep import break cycle | `src/shared/store/xpModalStore.ts:2` | `from "@/shared"` → `from "@/shared/config/logging"` | `npm run lint:fsd` 0 cycles |
| AI-engine cycle break | `functions/lib/ai-engine/openrouter/client.ts:1` | `from "@functions/lib/artifact-evaluator"` → deep `from "@functions/lib/artifact-evaluator/metrics"` (already) or move `metrics` to `shared` | `graphify update .` cycles 0 |
| Node drift + date + wrangler move | `.nvmrc:1, Dockerfile:2, wrangler.toml:5, package.json:25` | `20→22`, `node:22-alpine`, `2026-09-01`, `wrangler` devDeps | `node -v` 22, `docker build` `EBADENGINE` 0 |
| Debounce `in_progress` | `LevelContentPage.tsx:145` | `updateStage` 800ms debounce + `visibilityState==="visible"` | manual tab switch no spam |
| **Product: fix 0-XP leak** | `functions/lib/xp-engine.core:12,16,18` | `+1` for `*_failed/fallback` → `0` (PRD 536) + remove `engagement` leak | `vitest run functions/lib/__tests__/xpEngine*` |
| **Product: delete mock widgets** | `src/entities/dashboard/api/dashboardApi:16`, `src/widgets/dashboard/*` | Remove `MOCK_DASHBOARD_DATA` gaps/priorities/achievements, keep `journey/xp/streak` real | `vitest run src/entities/dashboard` 0 mock |

**Gate:** `npm run ci` (typecheck + `lint:files/console/lengths/biome/secrets` + `lint` + `vitest run --coverage` lines ≥80 branches ≥75 funcs ≥85 after bump) + `lint:fsd` 0.

### Phase 1 — 1–2 days — Industrial completeness (needs approvals 1–4 + 7–8)

| Task | File:line | Change |
|------|-----------|--------|
| Demote ownership + 3 catalog policies | `query-policies.ts:98/168/153/160` | Add `ownership:{column:"user_id",...}` + `auth:{userId}` at call site `queries.ts:218` |
| Harden `mark_xp_events_shown` | `20260812093636:4` | `SET search_path=''` + `auth.uid()` check, revoke `authenticated` or keep with guard |
| Docs ports/schema | `supabase/README.md:17/76`, `supabase/config.toml:11 54341` | Sync table, correct 28-table list via `supabase db diff` |
| Docs platform + RLS claim | `supabase/README.md:84`, `functions/README.md:3` | Rewrite `functions/README` Cloudflare, RLS line to “intentionally off — gateway” per approval |
| CORS env-aware + headers | `functions/middleware/auth.ts:35`, `public/_headers` NEW | `isProd?[lte]:[lte+localhost]` + `_headers` HSTS/CSP |
| Observability | `wrangler.toml:1`, `functions/shared/logger.ts:24`, `functions/api/v1/health/index.ts NEW` | `[observability]` + JSON logger + `GET /api/v1/health` + `X-Request-Id` `http.ts:15` |
| vitest/codecov thresholds | `vite.config.ts:191`, `codecov.yml:14` | `functions 75→85`, `project 70→80` |
| DML move + rename | `20260801→20260801000000`, `supabase/seed/production/seed_..._publish.sql NEW` | Move `UPDATE` to seed, rename DDL comment |
| `updated_at` triggers | `20260729093954` 9 tables | `CREATE TRIGGER ... set_updated_at()` |
| PWA/SEO | `manifest.json:1`, `index.html:1` | `192/512 maskable start_url:"/"`, OG/canonical, `biome a11y:* error` |
| **Product: readiness card** | `functions/api/v1/readiness/index:341` → `src/pages/dashboard` | Wire existing breakdown (components/band/missingEvidence) to Dashboard card — 1d |
| **Product: roadmap timeline** | `role_capability_sequence` → `GET /api/v1/learner/roadmap` + `src/pages/roadmap` | Reuse `learning-paths/queries:504` query — 1d, lifts 4.0→6.5 |
| **Product: delete viewer sprawl** | `src/entities/course/ui/resource-content-viewer/*`, `package.json:7,15,18` | Keep PDF/text/viewer, delete Pptx/Docx/Spreadsheet/Video heavy deps |

**Gate:** `supabase db lint` RLS 0 vs policy count, `wrangler types --check` 0 drift, `/health` 200/503, `vitest --coverage` branches ≥80.

### Phase 2 — 3–5 days — Hardening + DORA (needs approvals 5–6)

| Task | Scope |
|------|-------|
| God-file splits (Expand) | `queries.ts→file-queries/submission-queries/evaluation-queries`, `artifact-evaluator→prompt/decision`, `LevelContentPage→useLevelContentOrchestrator` (keep old files, new imports) |
| Contract deletes (gated) | Delete legacy `is_latest` triggers, `*_text` cols after dual-write verified |
| Metrics sink + RED + SLO | `metrics.ts:102 waitUntil` → Queue/Analytics Engine, dashboard `p95<500ms error<1% 99.9%`, alert `error>1% p99>2×` |
| DORA `deploy.yml` + rollback | `wrangler pages deploy --env production` + `wrangler rollback`, `four-keys` export, `e2e` Playwright `auth→submit→evaluate→readiness` |
| k6 2× peak | `scripts/load-artifact-submit.js` hammer `POST /api/v1/artifacts/submit` 25MB edge |
| PII purge + scrub | `triggers crons ["0 2 * * *"]` + `scheduled.ts` purge `metadata 30d`, regex scrub before `callOpenRouterAI` |

**Gate:** k6 `<1%` error at 2× peak, Playwright E2E green, `graphify update .` from `lte/` (not `lte/lte`) cycles 0, codecov `80/85` strict.

### Phase 3 — Contract (explicit approval) — Legacy removal

- Drop `users.deleted_at` index add, drop `vector` extension until needed, enforce `npm audit --audit-level=high` + `knip` in CI, delete old `queries.ts` after Phase 2 verified.

---

## 6. Testing & Verification Gate (per phase)

```bash
npm run lint:files && npm run lint:console && npm run lint:lengths && npm run lint:biome && npm run lint:secrets && npm run lint && npm run typecheck && vitest run --coverage
# expect lines ≥80 branches ≥80 (after 75→80) funcs ≥85
biome ci --changed --since=origin/main # not count=0 on push fix
graphify update . # from lte/ only
wrangler types && tsc --noEmit -p tsconfig.app.json # binding drift 0
curl -i https://lte.rareminds.in/api/v1/health # 200/503
k6 run scripts/load-artifact-submit.js # 2× peak <1% error
```

---

## 7. Rollback Strategy (requires approval per `05-production`)

- **Phase 0:** `git revert HEAD` — no DB.
- **Phase 1:** DDL `ENABLE ROW` is reversible `DISABLE ROW` + `DROP POLICY`; if `GRANT` revoked and `authenticated` breaks, `supabase db reset --sql-paths` + `seed/production` re-run. Keep `20260801000000` as empty DDL comment if seed fails.
- **Phase 2:** Expand files keep old `queries.ts` until Contract; rollback is `git revert` + `wrangler pages deploy <prev>` + `wrangler rollback`. Queue DLQ retains metrics.

---

## 8. Appendix — File Inventory (audited)

- **34 migrations:** `20260716092555` … `20260812093636` (full table §4), 1 naming bad, 1 DML bad, 4 single-step `TYPE jsonb`.
- **9 grant files:** `20260718094500/22000000/28110000/28120000/29000000/30060648/31000000/31092000/31093000` all `TO authenticated` wide-open.
- **2 ADRs:** `2026-08-04-zod`, `2026-08-06-artifact-text-extraction` (both compliant, 5 sections).
- **Frontend hotspots:** `LevelContentPage.tsx:94/708`, `DesignCanvas.tsx:572`, `VideoContentViewer.tsx:104`, `manifest.json:1`, `vite.config.ts:74`.
- **Supply chain:** `lockfileVersion 3`, 997 `integrity`, 6 devDeps `^` (low), `.dev.vars:2` real `sb_secret/sk-or-v1` local-only.

**Next step:** Reply `approve phase 0` to apply Phase 0 now (incl. 0-XP leak + mock delete), or `approve phase 0-1` to include observability/docs/RLS + readiness/roadmap wiring. No Phase 1 edits until explicit approval — build mode active.

---

## 9. Appendix — Product Gaps (Lead Product 30yr — file:line index)

| # | Gap/Over-built | PRD | Evidence |
|---|----------------|-----|----------|
| G1 | Roadmap 0 | FR4 P0 | `AppRouter.tsx:33` no `/roadmap`, `functions/api/v1` 0 roadmap handler |
| G2 | Marketplace/consent 0 | FR13 §16 | `grep marketplace\|consent functions` 0, `supabase/migrations` 0 consent table |
| G3 | Readiness UI 0 | FR12 | `readiness/index:341` computes `components/missingEvidence/warnings` unused, `DashboardPage:120` only `%` |
| G4 | Role picker 0 | FR3 | `learner-track.ts:99`, `LearningPathInitializer:26` no picker |
| G5 | Mock dashboard + GDPR delete 0 | FR11 §16 | `dashboardApi:16` 5 gaps/3 priorities fabricated, `settings/account:37` only inactive |
| O1 | Extractor 600LOC pre-LLM | TRD §8.4 P1 | `artifact-extractor.ts`, `artifact-file-guard.ts` |
| O2 | 6 viewers + 3 heavy deps | PRD 814 | `resource-content-viewer/*`, `package.json:7,15,18` |
| O3 | Widget city mock | FR11 | `dashboardApi:16`, `widgets/dashboard/*` |
| O4 | Engagement XP 9 types | PRD P2 257 | `xp-engine.core:22` +1 fail violates PRD 536 |
| O5 | Gateway 750LOC + 19 lints | — | `functions/lib/query-gateway/*`, `scripts/checks/*` |
