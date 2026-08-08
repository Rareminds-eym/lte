# XP System — Complete Audit

> **Audit Date**: 2026-08-06  
> **Scope**: All engagement XP events stored in `xp_events`  
> **Status**: All 9 engagement events fully implemented ✅

---

## 1. Database Schema — `xp_events` Table

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `users.id` |
| `event_type` | `xp_event_type` (enum) | The specific event that fired |
| `xp_category` | `xp_category` (enum) | `evidence` or `engagement` |
| `xp_amount` | integer | XP points awarded |
| `source_type` | varchar(50) | Table name of the originating record |
| `source_id` | uuid | ID from the source table |
| `idempotency_key` | varchar(unique) | Prevents double-awarding |
| `metadata` | jsonb | Extra event context (login_date, streak info, etc.) |

---

## 2. Core Idempotency Enforcement

All XP awards go through `awardXp()` in [`xp-engine.core.ts`](../functions/lib/xp-engine.core.ts).  
Every insert has a unique `idempotency_key`. A Postgres `23505` constraint violation (duplicate key) is silently caught and treated as "already awarded" — so it **never double-awards**.

---

## 3. Engagement Events Detail

### 3a. `daily_login` (+1 XP/day)

| Field | Value |
|---|---|
| **XP Amount** | +1 |
| **Category** | `engagement` |
| **source_type** | `users` |
| **source_id** | Today's date string `YYYY-MM-DD` |
| **Idempotency Key** | `login:{userId}:{YYYY-MM-DD}` |
| **Trigger** | SSO exchange (`/api/v1/auth/sso/exchange`) and token refresh (`/api/v1/auth/refresh`) |
| **Pattern** | Fire-and-forget — never blocks auth response |
| **Function** | `triggerDailyLogin()` inside `triggerDailyLoginWithEngagement()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### 3b. `profile_completed` (+50 XP, once lifetime)

| Field | Value |
|---|---|
| **XP Amount** | +50 |
| **Category** | `engagement` |
| **source_type** | `users` |
| **source_id** | `userId` |
| **Idempotency Key** | `profile:{userId}` (no date — one per user ever) |
| **Trigger** | Profile settings `PUT /api/v1/settings/profile` when `profileStrength === 100` |
| **Function** | `completeProfile()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### 3c. `streak_7_day` (+5 XP, repeats every 7 days)

| Field | Value |
|---|---|
| **XP Amount** | +5 |
| **Category** | `engagement` |
| **source_type** | `xp_events` |
| **source_id** | The specific date `YYYY-MM-DD` on which the 7th/14th/21st... login lands |
| **Idempotency Key** | `streak7:{userId}:{YYYY-MM-DD}` |
| **Trigger** | After every `daily_login` is awarded; streak counts consecutive login days from `xp_events` metadata |
| **Logic** | Reads all `daily_login` rows → extracts `metadata.login_date` → deduplicates → sorts descending → counts consecutive days → awards on every multiple of 7 |
| **Reset** | Any missed day resets consecutive count to 0; must rebuild from scratch |
| **Function** | `checkAndAwardStreak()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### 3d. `consistency_30_day` (+30 XP, per new 30-day run)

| Field | Value |
|---|---|
| **XP Amount** | +30 |
| **Category** | `engagement` |
| **source_type** | `xp_events` |
| **source_id** | The start date of the 30-day streak (so a new run gets a new key) |
| **Idempotency Key** | `consistency30:{userId}:{streakStartDate}` |
| **Trigger** | After every `daily_login`; same login history scan as streak |
| **Logic** | Same consecutive day counter; fires when `consecutiveDays >= 30`; `streakStartDate` = today − (consecutive−1) days |
| **Reset** | Break → rebuild → different `streakStartDate` → different key → can earn again |
| **Function** | `checkAndAwardConsistency()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### 3e. `legacy_consistency_bonus` (+20 XP, once per calendar year after 4+ months gap)

| Field | Value |
|---|---|
| **XP Amount** | +20 |
| **Category** | `engagement` |
| **source_type** | `users` |
| **source_id** | `currentYear` (e.g. `"2026"`) |
| **Idempotency Key** | `legacy_bonus:{userId}:{YYYY}` |
| **Trigger** | After every login, checks `users.last_activity_at` |
| **Logic** | Computes gap between `now` and `last_activity_at`; if `> 120 days` → award; `last_activity_at` is updated by `syncSsoShadowData` on every SSO exchange |
| **Function** | `checkAndAwardLegacyBonus()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### 3f. `readiness_milestone_25/50/75/100` (+10/20/30/100 XP)

| Field | Value |
|---|---|
| **XP Amounts** | 25% → +10, 50% → +20, 75% → +30, 100% → +100 |
| **Category** | `engagement` |
| **source_type** | `roles` |
| **source_id** | `roleId` |
| **Idempotency Key** | `milestone25/50/75/100:{userId}:{roleId}` (once per role per user ever) |
| **Trigger** | Automatically called at the end of every `calculateReadiness()` execution |
| **Logic** | Checks all four thresholds `<= current score`; awards all that have been crossed; idempotency prevents re-awarding if readiness drops and comes back |
| **Function** | `evaluateMilestones()` called from `calculateReadinessInternal()` |
| **Recalculation Triggers** | `completeStage`, `evaluateArtifact`, `evaluateFallback`, `adminOverrideArtifact`, `completeCourseOnTime`, `completeCapability`, manual `POST /api/v1/readiness/calculate` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### 3g. `promotional_xp` (Dynamic XP)

| Field | Value |
|---|---|
| **XP Amount** | Dynamic (Configured on demand) |
| **Category** | `engagement` |
| **source_type** | Any/Configured |
| **source_id** | `sourceId` |
| **Idempotency Key** | `promo:{userId}:{sourceId}` |
| **Trigger** | Optional custom promotions or admin manual additions |
| **Logic** | Directly invoked when executing custom promotional code |
| **Function** | None (direct database entry via core `awardXp()`) |
| **Status** | ⚠️ Core configured, but API trigger wiring is not implemented |

---

## 3.1. Evidence Events Detail

### `stage_completed` (+1 XP)

| Field | Value |
|---|---|
| **XP Amount** | +1 |
| **Category** | `evidence` |
| **source_type** | `user_stage_progress` |
| **source_id** | `userStageProgressId` |
| **Idempotency Key** | `stage:{userId}:{sourceId}` |
| **Trigger** | `POST /api/v1/courses/:levelId/modules/:moduleNo/stages/progress` when a stage is marked complete |
| **Function** | `completeStage()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### `practice_artifact_accepted` (+2 XP)

| Field | Value |
|---|---|
| **XP Amount** | +2 |
| **Category** | `evidence` |
| **source_type** | `artifact_submissions` |
| **source_id** | `submissionId` |
| **Idempotency Key** | `practice:{userId}:{sourceId}` |
| **Trigger** | AI or manual evaluator accepts a practice artifact submission |
| **Function** | `evaluateArtifact()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### `practice_artifact_failed` (+1 XP)

| Field | Value |
|---|---|
| **XP Amount** | +1 |
| **Category** | `evidence` |
| **source_type** | `artifact_submissions` |
| **source_id** | `submissionId` |
| **Idempotency Key** | `practice_fail:{userId}:{sourceId}` |
| **Trigger** | AI or manual evaluator rejects a practice artifact submission |
| **Function** | `evaluateArtifact()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### `final_artifact_accepted_1/2/3` (+20/15/10 XP)

| Field | Value |
|---|---|
| **XP Amount** | Attempt 1: +20, Attempt 2: +15, Attempt 3+: +10 |
| **Category** | `evidence` |
| **source_type** | `artifact_submissions` |
| **source_id** | `submissionId` |
| **Idempotency Key** | `final:{userId}:{sourceId}` |
| **Trigger** | AI or manual evaluator accepts a mandatory final artifact submission |
| **Function** | `evaluateArtifact()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### `final_artifact_failed` (+1 XP)

| Field | Value |
|---|---|
| **XP Amount** | +1 per failed attempt |
| **Category** | `evidence` |
| **source_type** | `artifact_submissions` |
| **source_id** | `submissionId` |
| **Idempotency Key** | `final_fail:{userId}:{sourceId}` |
| **Trigger** | AI or manual evaluator rejects a mandatory final artifact submission |
| **Function** | `evaluateArtifact()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### `manual_eval_accepted` (+5 XP)

| Field | Value |
|---|---|
| **XP Amount** | +5 |
| **Category** | `evidence` |
| **source_type** | `artifact_submissions` |
| **source_id** | `submissionId` |
| **Idempotency Key** | `manual:{userId}:{sourceId}` |
| **Trigger** | Admin manually overrides artifact status to "accepted" / fallback path success |
| **Function** | `evaluateFallback()` or `adminOverrideArtifact()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### `fallback_eval_failed` (+1 XP)

| Field | Value |
|---|---|
| **XP Amount** | +1 |
| **Category** | `evidence` |
| **source_type** | `artifact_submissions` |
| **source_id** | `submissionId` |
| **Idempotency Key** | `fallback_fail:{userId}:{sourceId}` |
| **Trigger** | Fallback evaluation path fails for a final artifact |
| **Function** | `evaluateFallback()` |
| **Status** | ✅ Fully implemented, wired, and tested |

---

### `course_completed_on_time` (+10 XP)

| Field | Value |
|---|---|
| **XP Amount** | +10 |
| **Category** | `evidence` |
| **source_type** | `user_capability_level_progress` |
| **source_id** | `levelProgressId` |
| **Idempotency Key** | `course:{userId}:{sourceId}` |
| **Trigger** | Triggered when a course/level is completed before the target timeline |
| **Function** | `completeCourseOnTime()` |
| **Status** | ⚠️ Core implemented, but API trigger wiring is missing |

---

### `fast_track_capability` (+15 XP)

| Field | Value |
|---|---|
| **XP Amount** | +15 |
| **Category** | `evidence` |
| **source_type** | `user_capability_level_progress` |
| **source_id** | `levelProgressId` |
| **Idempotency Key** | `fasttrack:{userId}:{sourceId}` |
| **Trigger** | Triggered when a capability is passed via fast-track assessment |
| **Function** | `completeCapability()` with `isCapstone = false` |
| **Status** | ⚠️ Core implemented, but API trigger wiring is missing |

---

### `capstone_completed` (Custom XP)

| Field | Value |
|---|---|
| **XP Amount** | Custom (Passed dynamically depending on role config) |
| **Category** | `evidence` |
| **source_type** | `user_capability_level_progress` |
| **source_id** | `levelProgressId` |
| **Idempotency Key** | `capstone:{userId}:{sourceId}` |
| **Trigger** | Fired when a capstone project evaluation is marked as pass |
| **Function** | `completeCapability()` with `isCapstone = true` |
| **Status** | ⚠️ Core implemented, but API trigger wiring is missing |

---

---

## 4. Call Chain — How Engagement is Triggered on Login

```
User Logs In (SSO or Token Refresh)
   │
   ├─ POST /api/v1/auth/sso/exchange
   │    └─ triggerDailyLoginWithEngagement() [fire-and-forget]
   │
   └─ POST /api/v1/auth/refresh
        └─ triggerDailyLoginWithEngagement() [fire-and-forget]

triggerDailyLoginWithEngagement()
   ├─ triggerDailyLogin()          → saves daily_login to xp_events
   ├─ checkAndAwardStreak()        → saves streak_7_day if multiple of 7
   ├─ checkAndAwardConsistency()   → saves consistency_30_day if ≥ 30 days
   └─ checkAndAwardLegacyBonus()  → saves legacy_consistency_bonus if gap > 120 days
```

---

## 5. Readiness Score Call Chain

```
Any progress-impacting event fires
   │
   ├─ completeStage()
   ├─ evaluateArtifact()
   ├─ evaluateFallback()
   ├─ adminOverrideArtifact()
   ├─ completeCourseOnTime()
   ├─ completeCapability()
   └─ POST /api/v1/readiness/calculate (manual, rate-limited 5/min)
        │
        └─ triggerReadinessRecalculation()
             └─ calculateReadiness()   → updates learning_paths.role_readiness_percentage
                  └─ evaluateMilestones()
                       ├─ readiness_milestone_25 if score ≥ 25
                       ├─ readiness_milestone_50 if score ≥ 50
                       ├─ readiness_milestone_75 if score ≥ 75
                       └─ readiness_milestone_100 if score ≥ 100
```

---

## 6. Readiness Score Formula (PRD §11.1 — Frozen)

| Component | Weight | Calculation Rule |
|---|---|---|
| Course Completion | 30% | `mastered_modules / required_modules × 100` |
| Artifact Completion | 25% | `accepted mandatory artifacts / required mandatory artifacts × 100` |
| AI Average Score | 25% | Average accepted evaluation score across mandatory artifacts |
| XP Achievement | 10% | `earned_evidence_xp / expected_evidence_xp × 100` (capped at 100) |
| Profile Completion | 10% | Percentage of mandatory profile fields completed |

**Formula:**
```
Readiness Score = Round(
  course_completion × 0.30 +
  artifact_completion × 0.25 +
  ai_average_score × 0.25 +
  xp_achievement × 0.10 +
  profile_completion × 0.10
)
```

**Readiness Bands:**

| Score Range | Band |
|---|---|
| ≥ 80 | Job Ready |
| ≥ 60 | Internship Ready |
| ≥ 40 | Learning in Progress |
| < 40 | Not Ready |

---

## 7. Summary — All Events Implemented

| Event | Amount | Category | Implemented | Trigger Point | Tested |
|---|---|---|---|---|---|
| `daily_login` | +1/day | engagement | ✅ | SSO exchange + token refresh | ✅ |
| `profile_completed` | +50 (once ever) | engagement | ✅ | `PUT /settings/profile` when strength = 100% | ✅ |
| `streak_7_day` | +5 per 7-day milestone | engagement | ✅ | After `daily_login` fire | ✅ |
| `consistency_30_day` | +30 per new 30-day run | engagement | ✅ | After `daily_login` fire | ✅ |
| `legacy_consistency_bonus` | +20 (once/year, gap > 120 days) | engagement | ✅ | After `daily_login` fire | ✅ |
| `readiness_milestone_25` | +10 (once per role) | engagement | ✅ | After every `calculateReadiness()` | ✅ |
| `readiness_milestone_50` | +20 (once per role) | engagement | ✅ | After every `calculateReadiness()` | ✅ |
| `readiness_milestone_75` | +30 (once per role) | engagement | ✅ | After every `calculateReadiness()` | ✅ |
| `readiness_milestone_100` | +100 (once per role) | engagement | ✅ | After every `calculateReadiness()` | ✅ |

> **All 9 engagement events are fully implemented, correctly wired, and unit tested.**  
> All data is stored in `xp_events` with the correct `xp_category = 'engagement'` and enforced idempotency keys.

---

## 8. Key Files Reference

| File | Role |
|---|---|
| [`xp-engine.core.ts`](functions/lib/xp-engine.core.ts) | `XP_AMOUNTS`, `XP_CATEGORIES`, `generateIdempotencyKey`, `awardXp` |
| [`xp-engine.engagement.ts`](functions/lib/xp-engine.engagement.ts) | All engagement trigger functions |
| [`xp-engine.progress.ts`](functions/lib/xp-engine.progress.ts) | Readiness calculator + milestone trigger wiring |
| [`xp-engine.artifacts.ts`](functions/lib/xp-engine.artifacts.ts) | Evidence XP for stages and artifact evaluations |
| [`xp-engine.ts`](functions/lib/xp-engine.ts) | Re-export barrel for all sub-modules |
| [`exchange.ts`](functions/api/v1/auth/sso/exchange.ts) | SSO login → `triggerDailyLoginWithEngagement` wiring |
| [`refresh.ts`](functions/api/v1/auth/refresh.ts) | Token refresh → `triggerDailyLoginWithEngagement` wiring |
| [`profile.ts`](functions/api/v1/settings/profile.ts) | Profile PUT → `completeProfile` wiring |
| [`calculate.ts`](functions/api/v1/readiness/calculate.ts) | Manual readiness recalculation endpoint (5/min rate limit) |
| [`index.ts`](functions/api/v1/readiness/index.ts) | GET readiness display with component breakdown |
| [`xpEngine.engagement.test.ts`](functions/lib/__tests__/xpEngine.engagement.test.ts) | Unit tests for all engagement functions |

---

## 9. Complete XP Events Implementation & Wiring Checklist

This checklist tracks the status of all **22 XP event types** defined in the system. It highlights whether each event type is implemented in the core engine, fully wired to API endpoints or background triggers, and backed by automated unit tests.

| Event Type | Category | Core Engine | API / Trigger Wiring | Automated Tests | Notes / Trigger Point |
|---|---|:---:|:---:|:---:|---|
| `stage_completed` | Evidence | ✅ | ✅ | ✅ | `POST /api/v1/courses/.../stages/progress` when a learning stage is successfully completed. |
| `practice_artifact_accepted` | Evidence | ✅ | ✅ | ✅ | Fired on successful evaluation of a practice artifact submission. |
| `practice_artifact_failed` | Evidence | ✅ | ✅ | ✅ | Fired on failed evaluation of a practice artifact submission. |
| `final_artifact_accepted_1` | Evidence | ✅ | ✅ | ✅ | Fired on the first successful final artifact evaluation. |
| `final_artifact_accepted_2` | Evidence | ✅ | ✅ | ✅ | Fired on the second successful final artifact evaluation (e.g., resubmission). |
| `final_artifact_accepted_3` | Evidence | ✅ | ✅ | ✅ | Fired on subsequent successful final artifact evaluations. |
| `final_artifact_failed` | Evidence | ✅ | ✅ | ✅ | Fired when a final artifact evaluation fails. |
| `manual_eval_accepted` | Evidence | ✅ | ✅ | ✅ | Fired when a fallback/manual reviewer override evaluation passes. |
| `fallback_eval_failed` | Evidence | ✅ | ✅ | ✅ | Fired when a fallback/manual evaluation fails. |
| `daily_login` | Engagement | ✅ | ✅ | ✅ | Fired on first SSO exchange or token refresh of the day. |
| `profile_completed` | Engagement | ✅ | ✅ | ✅ | Fired during `PUT /settings/profile` when profile strength reaches 100%. |
| `streak_7_day` | Engagement | ✅ | ✅ | ✅ | Evaluated after `daily_login` for repeating 7-consecutive-day streaks. |
| `consistency_30_day` | Engagement | ✅ | ✅ | ✅ | Evaluated after `daily_login` for repeating 30-consecutive-day streaks. |
| `readiness_milestone_25` | Engagement | ✅ | ✅ | ✅ | Auto-evaluated in `calculateReadiness()` when score crosses 25%. |
| `readiness_milestone_50` | Engagement | ✅ | ✅ | ✅ | Auto-evaluated in `calculateReadiness()` when score crosses 50%. |
| `readiness_milestone_75` | Engagement | ✅ | ✅ | ✅ | Auto-evaluated in `calculateReadiness()` when score crosses 75%. |
| `readiness_milestone_100` | Engagement | ✅ | ✅ | ✅ | Auto-evaluated in `calculateReadiness()` when score crosses 100%. |
| `legacy_consistency_bonus` | Engagement | ✅ | ✅ | ✅ | Evaluated after login when returning after a >120 day inactivity gap. |
| `course_completed_on_time` | Evidence | ✅ | ❌ | ✅ | **Engine Ready but unwired**: Core function `completeCourseOnTime()` is implemented and tested, but not triggered by any production event. |
| `fast_track_capability` | Evidence | ✅ | ❌ | ✅ | **Engine Ready but unwired**: Implemented and tested inside `completeCapability()`, but not triggered by any production event. |
| `capstone_completed` | Evidence | ✅ | ❌ | ✅ | **Engine Ready but unwired**: Implemented and tested inside `completeCapability()`, but not triggered by any production event. |
| `promotional_xp` | Engagement | ❌ | ❌ | ❌ | **Not Implemented**: Defined in base amounts config mapping, but has no core helper or API wiring. |

