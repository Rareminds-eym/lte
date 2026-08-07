import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";

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

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const supabase = createServiceSupabase(context.env);

    // 1. Fetch active learning path and join with roles
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select(`
        id,
        role_readiness_percentage,
        updated_at,
        role_id,
        roles (
          role_name,
          role_family_name,
          domain_name
        )
      `)
      .eq("user_id", userId)
      .eq("is_latest", true)
      .maybeSingle();

    if (pathError) throw pathError;

    if (!path) {
      return jsonError("No active learning path found", 404, {
        code: "NOT_FOUND",
        requestId,
      });
    }

    const roleData = Array.isArray(path.roles) ? path.roles[0] : path.roles;
    const currentRole = {
      name: roleData?.role_name || "Unknown Role",
      domain: roleData?.domain_name || "Unknown Domain",
      family: roleData?.role_family_name || "Unknown Family",
    };

    // 2. Identify the levels in this learning path
    const { data: levelProgressRows } = await supabase
      .from("user_capability_level_progress")
      .select("level_id")
      .eq("learning_path_id", path.id);

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
      const { data: modules } = await supabase
        .from("modules")
        .select("id, module_no, level_id")
        .in("level_id", levelIds)
        .eq("is_active", true)
        .order("module_no", { ascending: true });

      if (modules) {
        requiredModules = modules;
      }

      // Fetch expected evidence XP from the levels
      const { data: levelsData } = await supabase
        .from("levels")
        .select("total_xp")
        .in("id", levelIds);

      if (levelsData) {
        expectedEvidenceXp = levelsData.reduce((sum, lvl) => sum + (lvl.total_xp || 0), 0);
      }

      // Fetch required mandatory artifacts for these levels
      const moduleIds = requiredModules.map((m) => m.id);
      if (moduleIds.length > 0) {
        const { data: stages } = await supabase
          .from("modules_content")
          .select("id, module_id, stage_name")
          .in("module_id", moduleIds)
          .eq("is_active", true);

        const stageIds = stages?.map((s) => s.id) || [];
        if (stageIds.length > 0) {
          const { data: artifacts } = await supabase
            .from("module_artifacts")
            .select("id, modules_content_id")
            .in("modules_content_id", stageIds)
            .eq("artifact_type", "final")
            .eq("is_active", true);

          if (artifacts) {
            requiredArtifacts = artifacts.map((art) => {
              const stage = stages?.find((s) => s.id === art.modules_content_id);
              const mod = requiredModules.find((m) => m.id === stage?.module_id);
              return {
                id: art.id,
                moduleId: stage?.module_id,
                moduleNo: mod?.module_no || 0,
              };
            });
          }
        }
      }
    }

    // 3. Component Calculations
    // A. Course Completion (30%)
    const { data: modulesProgress } = await supabase
      .from("user_module_progress")
      .select("module_status, module_id")
      .eq("user_id", userId);

    const totalModules = requiredModules.length || modulesProgress?.length || 1;
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
    const { data: artifactSubmissions } = await supabase
      .from("artifact_submissions")
      .select("id, status, artifact_id, module_artifacts ( id, artifact_type )")
      .eq("user_id", userId);

    const finalSubmissions = (artifactSubmissions || []).filter((s) => {
      const ma = Array.isArray(s.module_artifacts) ? s.module_artifacts[0] : s.module_artifacts;
      return ma?.artifact_type === "final";
    });

    const requiredArtifactIds = requiredArtifacts.map((a) => a.id);
    const totalMandatoryArtifacts = requiredArtifacts.length || finalSubmissions.length || 1;
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
      const { data: flows } = await supabase
        .from("artifact_evaluation_flows")
        .select("score")
        .in("submission_id", submissionIds)
        .eq("is_current_stage", true);

      const scores = flows?.map((f) => f.score).filter((s) => s !== null) as number[];
      if (scores && scores.length > 0) {
        aiAverageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    // D. XP Achievement (10%)
    const { data: xpData } = await supabase
      .from("xp_events")
      .select("xp_amount")
      .eq("user_id", userId)
      .eq("xp_category", "evidence");

    const evidenceXpEarned = xpData?.reduce((sum, item) => sum + item.xp_amount, 0) || 0;
    const xpAchievement =
      expectedEvidenceXp > 0 ? Math.min((evidenceXpEarned / expectedEvidenceXp) * 100, 100) : 0;

    // E. Profile Completion (10%)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("bio, job_title, skills")
      .eq("user_id", userId)
      .maybeSingle();

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
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
