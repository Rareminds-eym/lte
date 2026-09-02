import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";

interface ReadinessDisplay {
  score: number; // whole number, no decimals
  band: string;
  lastCalculated: string; // ISO 8601
  currentRole: { name: string; domain: string; family: string };
  components: {
    courseCompletion: { value: number; weight: 30 };
    artifactCompletion: { value: number; weight: 25 };
    aiAverageScore: { value: number; weight: 25 };
    xpAchievement: { value: number; weight: 10 };
    profileCompletion: { value: number; weight: 10 };
  };
  missingEvidence: string[];
  configWarnings: string[];
  improvementActions: string[]; // ordered by impact
}

const activeReadinessPathReadPolicy = {
  table: "learning_paths",
  operation: "read",
  select: `
    id,
    role_readiness_percentage,
    updated_at,
    role_id,
    roles (
      role_name,
      role_family_name,
      domain_name
    )
  `,
  filters: ["user_id", "is_latest"],
  sorts: ["updated_at"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const readinessLevelProgressReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["level_id"],
  filters: ["learning_path_id"],
} as const;

const readinessModulesReadPolicy = {
  table: "modules",
  operation: "read",
  columns: ["id", "module_no", "level_id"],
  filters: ["level_id", "is_active"],
  sorts: ["module_no"],
} as const;

const readinessLevelsReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["total_xp"],
  filters: ["id"],
} as const;

const readinessStagesReadPolicy = {
  table: "modules_content",
  operation: "read",
  columns: ["id", "module_id", "stage_name"],
  filters: ["module_id", "is_active"],
} as const;

const readinessArtifactsReadPolicy = {
  table: "module_artifacts",
  operation: "read",
  columns: ["id", "modules_content_id"],
  filters: ["modules_content_id", "artifact_type", "is_active"],
} as const;

const readinessModuleProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["module_status", "module_id"],
  filters: ["user_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 1000,
} as const;

const readinessArtifactSubmissionsReadPolicy = {
  table: "artifact_submissions",
  operation: "read",
  select: "id, status, artifact_id, module_artifacts ( id, artifact_type )",
  filters: ["user_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 1000,
} as const;

const readinessEvaluationFlowsReadPolicy = {
  table: "artifact_evaluation_flows",
  operation: "read",
  columns: ["score"],
  filters: ["submission_id", "is_current_stage"],
} as const;

const readinessXpReadPolicy = {
  table: "xp_events",
  operation: "read",
  columns: ["xp_amount"],
  filters: ["user_id", "xp_category"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 1000,
} as const;

const readinessProfileReadPolicy = {
  table: "user_profiles",
  operation: "read",
  columns: ["bio", "job_title", "skills"],
  filters: ["user_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const qb = createServiceQueryGateway(context.env);

    // 1. Fetch active learning path and join with roles — handle multiple is_latest paths (one per role)
    const paths = (await qb.read(activeReadinessPathReadPolicy, {
      auth: { userId },
      filters: [{ column: "is_latest", op: "eq", value: true }],
      sort: [{ column: "updated_at", ascending: false }],
      limit: 1,
    })) as Array<{
      id: string;
      updated_at: string;
      roles?: Record<string, unknown> | Array<Record<string, unknown>>;
    }> | null;
    const path = Array.isArray(paths) && paths.length > 0 ? paths[0] : null;

    if (!path) {
      return jsonError("No active learning path found", 404, {
        code: "NOT_FOUND",
        requestId,
      });
    }

    const roleData = (
      Array.isArray(path.roles) && path.roles.length > 0 ? path.roles[0] : path.roles
    ) as Record<string, unknown> | null;
    const currentRole = {
      name: (roleData?.["role_name"] as string) || "Unknown Role",
      domain: (roleData?.["domain_name"] as string) || "Unknown Domain",
      family: (roleData?.["role_family_name"] as string) || "Unknown Family",
    };

    // 2. Identify the levels in this learning path
    const levelProgressRows = (await qb.read(readinessLevelProgressReadPolicy, {
      filters: [{ column: "learning_path_id", op: "eq", value: path.id }],
    })) as Array<{ level_id: string }> | null;

    interface RequiredModule {
      id: string;
      module_no: number;
      level_id: string;
    }

    interface RequiredArtifact {
      id: string;
      moduleId: string | undefined;
      moduleNo: number;
    }

    const levelIds = levelProgressRows?.map((r) => r.level_id) || [];
    let requiredModules: RequiredModule[] = [];
    let requiredArtifacts: RequiredArtifact[] = [];
    let expectedEvidenceXp = 0;

    if (levelIds.length > 0) {
      // Fetch modules for these levels
      const modules = (await qb.read(readinessModulesReadPolicy, {
        filters: [
          { column: "level_id", op: "in", value: levelIds },
          { column: "is_active", op: "eq", value: true },
        ],
        sort: [{ column: "module_no", ascending: true }],
      })) as RequiredModule[] | null;

      if (modules) {
        requiredModules = modules;
      }

      // Fetch expected evidence XP from the levels
      const levelsData = (await qb.read(readinessLevelsReadPolicy, {
        filters: [{ column: "id", op: "in", value: levelIds }],
      })) as Array<{ total_xp: number | null }> | null;

      if (levelsData) {
        expectedEvidenceXp = levelsData.reduce((sum, lvl) => sum + (lvl.total_xp || 0), 0);
      }

      // Fetch required mandatory artifacts for these levels
      const moduleIds = requiredModules.map((m) => m.id);
      if (moduleIds.length > 0) {
        const stages = (await qb.read(readinessStagesReadPolicy, {
          filters: [
            { column: "module_id", op: "in", value: moduleIds },
            { column: "is_active", op: "eq", value: true },
          ],
        })) as Array<{ id: string; module_id: string; stage_name: string | null }> | null;

        const stageIds = stages?.map((s) => s.id) || [];
        if (stageIds.length > 0) {
          const artifacts = (await qb.read(readinessArtifactsReadPolicy, {
            filters: [
              { column: "modules_content_id", op: "in", value: stageIds },
              { column: "artifact_type", op: "eq", value: "final" },
              { column: "is_active", op: "eq", value: true },
            ],
          })) as Array<{ id: string; modules_content_id: string }> | null;

          if (artifacts) {
            requiredArtifacts = artifacts.map((art) => {
              const stage = stages?.find((s) => s.id === art.modules_content_id);
              const moduleId = stage?.module_id;
              const mod = moduleId ? requiredModules.find((m) => m.id === moduleId) : undefined;
              return {
                id: art.id,
                moduleId,
                moduleNo: mod?.module_no || 0,
              };
            });
          }
        }
      }
    }

    // 3. Component Calculations
    // A. Course Completion (30%)
    const modulesProgress = (await qb.read(readinessModuleProgressReadPolicy, {
      auth: { userId },
    })) as Array<{ module_status: string | null; module_id: string }> | null;

    const totalModules =
      requiredModules.length > 0 ? requiredModules.length : modulesProgress?.length || 0;
    const masteredModules = modulesProgress
      ? modulesProgress.filter((m) => {
          const isMastered = m.module_status === "mastered" || m.module_status === "completed";
          if (requiredModules.length > 0) {
            return isMastered && requiredModules.some((rm) => rm.id === m.module_id);
          }
          return isMastered;
        }).length
      : 0;
    const courseCompletion = totalModules > 0 ? (masteredModules / totalModules) * 100 : 0;

    // B. Artifact Completion (25%)
    const artifactSubmissions = (await qb.read(readinessArtifactSubmissionsReadPolicy, {
      auth: { userId },
    })) as Array<{
      id: string;
      status: string;
      artifact_id: string;
      module_artifacts?: Record<string, unknown> | Array<Record<string, unknown>>;
    }> | null;

    const finalSubmissions = (artifactSubmissions || []).filter((s) => {
      const ma =
        Array.isArray(s.module_artifacts) && s.module_artifacts.length > 0
          ? s.module_artifacts[0]
          : s.module_artifacts;
      const typedMa = ma as Record<string, unknown> | null;
      return typedMa?.["artifact_type"] === "final";
    });

    const requiredArtifactIds = requiredArtifacts.map((a) => a.id);
    const totalMandatoryArtifacts =
      requiredArtifacts.length > 0 ? requiredArtifacts.length : finalSubmissions.length || 0;
    const acceptedMandatoryArtifacts = finalSubmissions.filter((s) => {
      const isAccepted = s.status === "accepted";
      if (requiredArtifactIds.length > 0) {
        return isAccepted && requiredArtifactIds.includes(s.artifact_id);
      }
      return isAccepted;
    }).length;
    const artifactCompletion =
      totalMandatoryArtifacts > 0
        ? (acceptedMandatoryArtifacts / totalMandatoryArtifacts) * 100
        : 0;

    // C. AI Authoritative Score (25%)
    const acceptedFinalSubmissions = finalSubmissions.filter((s) => {
      const isAccepted = s.status === "accepted";
      if (requiredArtifactIds.length > 0) {
        return isAccepted && requiredArtifactIds.includes(s.artifact_id);
      }
      return isAccepted;
    });

    const submissionIds = acceptedFinalSubmissions.map((s) => s.id);
    let aiAverageScore = 0;
    if (submissionIds.length > 0) {
      const flows = (await qb.read(readinessEvaluationFlowsReadPolicy, {
        filters: [
          { column: "submission_id", op: "in", value: submissionIds },
          { column: "is_current_stage", op: "eq", value: true },
        ],
      })) as Array<{ score: number | null }> | null;

      const scores = (flows || [])
        .map((f) => f.score)
        .filter((s): s is number => typeof s === "number");
      if (scores && scores.length > 0) {
        aiAverageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    // D. XP Achievement (10%)
    const xpData = (await qb.read(readinessXpReadPolicy, {
      auth: { userId },
      filters: [{ column: "xp_category", op: "eq", value: "evidence" }],
    })) as Array<{ xp_amount: number | null }> | null;

    const evidenceXpEarned = xpData?.reduce((sum, item) => sum + (item.xp_amount ?? 0), 0) || 0;
    const xpAchievement =
      expectedEvidenceXp > 0 ? Math.min((evidenceXpEarned / expectedEvidenceXp) * 100, 100) : 0;

    // E. Profile Completion (10%)
    const profile = (await qb.read(readinessProfileReadPolicy, {
      auth: { userId },
      result: "maybeSingle",
    })) as { bio?: string | null; job_title?: string | null; skills?: unknown } | null;

    let completedFields = 0;
    const totalFields = 3;
    if (profile) {
      if (profile.bio && profile.bio.trim().length > 0) completedFields++;
      if (profile.job_title && profile.job_title.trim().length > 0) completedFields++;
      if (profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
        completedFields++;
      }
    }
    const profileCompletion = (completedFields / totalFields) * 100;

    // 4. Calculate overall score & band
    const score = Math.round(
      courseCompletion * 0.3 +
        artifactCompletion * 0.25 +
        aiAverageScore * 0.25 +
        xpAchievement * 0.1 +
        profileCompletion * 0.1,
    );

    let band = "Not Ready";
    if (score >= 80) band = "Job Ready";
    else if (score >= 60) band = "Internship Ready";
    else if (score >= 40) band = "Learning in Progress";

    // 5. Compute missing evidence, config warnings, and improvement actions
    const missingEvidence: string[] = [];
    const configWarnings: string[] = [];
    const improvementActions: { text: string; impact: number }[] = [];

    // Catalog Completeness Warnings
    if (expectedEvidenceXp === 0) {
      configWarnings.push("Expected XP target not configured");
    }
    if (requiredModules.length === 0) {
      configWarnings.push("No modules configured for role");
    }
    if (requiredArtifacts.length === 0) {
      configWarnings.push("No mandatory artifacts configured for role");
    }

    // Gap analysis for required modules
    for (const mod of requiredModules) {
      const prog = modulesProgress?.find((p) => p.module_id === mod.id);
      const isCompleted = prog?.module_status === "mastered" || prog?.module_status === "completed";

      if (!isCompleted) {
        missingEvidence.push(`Module ${mod.module_no} not completed`);

        // Impact of completing this module: goes from mastered -> mastered + 1
        const currentPercent = (masteredModules / totalModules) * 100;
        const nextPercent = ((masteredModules + 1) / totalModules) * 100;
        const impact = (1 / totalModules) * 100 * 0.3; // 30% weight

        improvementActions.push({
          text: `Master Module ${mod.module_no} to gain +${impact.toFixed(1)} score points (${Math.round(currentPercent)}%->${Math.round(nextPercent)}% course completion)`,
          impact,
        });
      }

      // Check if a mandatory artifact is required for this module
      const art = requiredArtifacts.find((a) => a.moduleId === mod.id);
      if (art) {
        const sub = finalSubmissions.find((s) => s.artifact_id === art.id);
        if (!sub) {
          missingEvidence.push(`Module ${mod.module_no} artifact not submitted`);

          const impact = (1 / totalMandatoryArtifacts) * 100 * 0.25; // 25% weight
          improvementActions.push({
            text: `Submit artifact for Module ${mod.module_no} to gain +${impact.toFixed(1)} score points`,
            impact,
          });
        } else if (sub.status !== "accepted") {
          missingEvidence.push(`Module ${mod.module_no} artifact not accepted`);

          const impact = (1 / totalMandatoryArtifacts) * 100 * 0.25; // 25% weight
          improvementActions.push({
            text: `Submit artifact for Module ${mod.module_no} to gain +${impact.toFixed(1)} score points`,
            impact,
          });
        }
      }
    }

    // Profile completion improvement action
    if (profileCompletion < 100) {
      const missingCount = totalFields - completedFields;
      const impact = (missingCount / totalFields) * 100 * 0.1; // 10% weight
      improvementActions.push({
        text: `Complete profile fields to gain +${impact.toFixed(1)} score points`,
        impact,
      });
    }

    // Evidence XP improvement action
    if (expectedEvidenceXp > 0 && evidenceXpEarned < expectedEvidenceXp) {
      const gapXp = expectedEvidenceXp - evidenceXpEarned;
      const impact = (gapXp / expectedEvidenceXp) * 100 * 0.1; // 10% weight
      improvementActions.push({
        text: `Earn more Evidence XP to gain +${impact.toFixed(1)} score points`,
        impact,
      });
    }

    // Sort improvement actions descending by impact
    const orderedActions = improvementActions
      .sort((a, b) => b.impact - a.impact)
      .map((act) => act.text);

    const payload: ReadinessDisplay = {
      score,
      band,
      lastCalculated: path.updated_at,
      currentRole,
      components: {
        courseCompletion: { value: Math.round(courseCompletion), weight: 30 },
        artifactCompletion: { value: Math.round(artifactCompletion), weight: 25 },
        aiAverageScore: { value: Math.round(aiAverageScore), weight: 25 },
        xpAchievement: { value: Math.round(xpAchievement), weight: 10 },
        profileCompletion: { value: Math.round(profileCompletion), weight: 10 },
      },
      missingEvidence,
      configWarnings,
      improvementActions: orderedActions,
    };

    return jsonResponse(payload);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to construct readiness display data", error, { requestId });
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
