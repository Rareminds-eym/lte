/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */

import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import { publishSnapshotTables } from "./ingestion/publish-snapshot-tables";
import { calculateHash } from "./ingestion/snapshot-serializer";
import Logger, { getErrorMessage } from "./logger";

export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  const authenticateSSORequest = dependencies.authenticate;

  const logger = new Logger("LTELifecycleAPI");

  async function POST(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user)
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );

      const body = await request.json();
      const { action } = body;

      switch (action) {
        case "RETIRE_COURSE":
          return await setLevelActive(body.courseId, false, user.userId);
        case "REACTIVATE_COURSE":
          return await setLevelActive(body.courseId, true, user.userId);
        case "PUBLISH_COURSE_LEVEL":
          return await publishCourseLevel(body.courseId, user.userId);
        case "ROLLBACK_COURSE_VERSION":
          return await restoreCourseVersion(body, user.userId);
        case "RENAME_CANONICAL_CODE_WITH_ALIAS":
          return HttpResponse.json(
            {
              success: false,
              error:
                "Canonical alias table is not part of the approved one-table versioning scope.",
            },
            { status: 410 },
          );
        default:
          return HttpResponse.json(
            { success: false, error: `Unsupported lifecycle action: ${action}` },
            { status: 400 },
          );
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Lifecycle action failed", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  async function publishCourseLevel(
    courseId: string | undefined,
    userId: string,
  ): Promise<HttpResponse> {
    if (!courseId)
      return HttpResponse.json({ success: false, error: "courseId is required" }, { status: 400 });

    const { data: level, error } = await supabaseLTE
      .from("levels")
      .update({
        status: "published",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", courseId)
      .select("id, level_code, status, is_active")
      .single();

    if (error || !level) throw new Error(`Failed to publish course level: ${error?.message}`);

    logger.info("Course level published from workspace", {
      courseId,
      userId,
      levelCode: level.level_code,
    });
    return HttpResponse.json({
      success: true,
      action: "PUBLISH_COURSE_LEVEL",
      courseId,
      courseCode: level.level_code,
      status: level.status,
      lifecycleStatus: level.is_active ? "ACTIVE" : "RETIRED",
    });
  }
  async function setLevelActive(
    courseId: string | undefined,
    isActive: boolean,
    userId: string,
  ): Promise<HttpResponse> {
    if (!courseId)
      return HttpResponse.json({ success: false, error: "courseId is required" }, { status: 400 });

    const { data: level, error } = await supabaseLTE
      .from("levels")
      .update({ is_active: isActive })
      .eq("id", courseId)
      .select("*")
      .single();

    if (error || !level) throw new Error(`Failed to update course level: ${error?.message}`);

    logger.info("Level lifecycle updated", { courseId, userId, isActive });
    return HttpResponse.json({
      success: true,
      action: isActive ? "REACTIVATE_COURSE" : "RETIRE_COURSE",
      courseId,
      lifecycleStatus: isActive ? "ACTIVE" : "RETIRED",
    });
  }

  async function restoreCourseVersion(body: any, userId: string): Promise<HttpResponse> {
    const { courseId, rollbackSourceVersionId, confirmDiscardDraft, expectedDraftRevision } = body;
    if (!courseId || !rollbackSourceVersionId) {
      return HttpResponse.json(
        { success: false, error: "courseId and rollbackSourceVersionId are required" },
        { status: 400 },
      );
    }

    const { data: source, error: sourceError } = await supabaseLTE
      .from("catalog_versions")
      .select("*")
      .eq("id", rollbackSourceVersionId)
      .eq("entity_type", "level")
      .eq("entity_id", courseId)
      .eq("status", "PUBLISHED")
      .single();
    if (sourceError || !source) {
      return HttpResponse.json(
        { success: false, error: "Invalid rollback source version" },
        { status: 400 },
      );
    }

    const { data: activeDraft, error: draftError } = await supabaseLTE
      .from("catalog_versions")
      .select("*")
      .eq("entity_type", "level")
      .eq("entity_id", courseId)
      .eq("status", "DRAFT")
      .maybeSingle();
    if (draftError) throw new Error(`Failed to check active draft: ${draftError.message}`);

    if (activeDraft) {
      if (
        !confirmDiscardDraft ||
        expectedDraftRevision === undefined ||
        activeDraft.draft_revision !== expectedDraftRevision ||
        activeDraft.snapshot_data?.workspacePublishLock
      ) {
        return HttpResponse.json(
          {
            success: false,
            errorCode: "ACTIVE_DRAFT_EXISTS",
            error: "An active draft already exists for this course.",
            activeDraftId: activeDraft.id,
            activeDraftRevision: activeDraft.draft_revision,
          },
          { status: 409 },
        );
      }

      const { data: abandoned, error: abandonError } = await supabaseLTE
        .from("catalog_versions")
        .update({ status: "ABANDONED" })
        .eq("id", activeDraft.id)
        .eq("draft_revision", expectedDraftRevision)
        .eq("status", "DRAFT")
        .is("snapshot_data->workspacePublishLock", null)
        .select("id")
        .maybeSingle();
      if (abandonError) throw new Error(`Failed to abandon active draft: ${abandonError.message}`);
      if (!abandoned)
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CONFLICT",
            error: "The draft changed before restoration.",
          },
          { status: 409 },
        );
    }

    const snapshotTables = source.snapshot_data?.tables;
    let inserted = 0;
    let skipped = 0;
    let tableSummary: Record<string, { inserted: number; skipped: number }> = {};
    if (snapshotTables) {
      const result = await publishSnapshotTables(snapshotTables, supabaseLTE);
      inserted = result.inserted;
      skipped = result.skipped;
      tableSummary = result.tableSummary;
    } else if (
      source.snapshot_data?.kind === "workspace_edit" ||
      source.snapshot_data?.kind === "workspace_edit_draft"
    ) {
      // Editor-saved versions store a focused snapshot (course + modules +
      // assets), not full catalog tables. Restore by writing those rows back.
      const restoreErrors = await applyWorkspaceEditSnapshot(courseId, source.snapshot_data);
      if (restoreErrors.length > 0) {
        return HttpResponse.json(
          {
            success: false,
            error: "Some course content could not be restored.",
            details: restoreErrors,
          },
          { status: 500 },
        );
      }
    } else {
      return HttpResponse.json(
        { success: false, error: "Selected version does not contain a restorable snapshot." },
        { status: 400 },
      );
    }

    const { data: latestVersion, error: latestError } = await supabaseLTE
      .from("catalog_versions")
      .select("version_no")
      .eq("entity_type", "level")
      .eq("entity_id", courseId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError)
      throw new Error(`Failed to allocate rollback draft version: ${latestError.message}`);

    const nextVersionNo = (latestVersion?.version_no || 0) + 1;
    const completedAt = new Date().toISOString();
    const restoredSnapshot = {
      ...source.snapshot_data,
      restoredFromVersionId: source.id,
      restoredFromVersionNo: source.version_no,
      restoredAt: completedAt,
    };

    const { data: newVersion, error: insertError } = await supabaseLTE
      .from("catalog_versions")
      .insert({
        entity_type: "level",
        entity_id: courseId,
        version_no: nextVersionNo,
        status: "PUBLISHED",
        base_version_id: source.id,
        rollback_source_version_id: source.id,
        snapshot_hash: calculateHash(restoredSnapshot),
        snapshot_data: restoredSnapshot,
        change_reason: `RESTORED_FROM_V${source.version_no}`,
        created_by: userId,
        published_by: userId,
        published_at: completedAt,
      })
      .select("*")
      .single();
    if (insertError || !newVersion)
      throw new Error(`Failed to create restored version: ${insertError?.message}`);

    logger.info("Course version restored", {
      courseId,
      versionNo: newVersion.version_no,
      rollbackSourceVersionId,
    });
    return HttpResponse.json({
      success: true,
      action: "COURSE_VERSION_RESTORED",
      courseId,
      newVersionNo: newVersion.version_no,
      newVersionId: newVersion.id,
      rollbackSourceVersionId,
      status: "PUBLISHED",
      inserted,
      skipped,
      tableSummary,
    });
  }

  async function applyWorkspaceEditSnapshot(courseId: string, snap: any): Promise<string[]> {
    const errors: string[] = [];

    if (snap.course) {
      const { error } = await supabaseLTE
        .from("levels")
        .update({
          title: snap.course.course_name,
          description: snap.course.description,
          observable_behavior: snap.course.observable_behavior,
          example_outputs: snap.course.example_outputs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", courseId);
      if (error) errors.push(`Level ${courseId}: ${error.message}`);
    }

    for (const module of snap.modules || []) {
      if (!module.id) continue;
      const { error } = await supabaseLTE
        .from("modules")
        .update({
          title: module.title,
          description: module.description,
          learning_content: module.learning_content,
          prerequisites: module.prerequisites,
          what_youll_learn: module.what_youll_learn,
          is_published: module.is_published,
        })
        .eq("id", module.id);
      if (error) errors.push(`Module ${module.id}: ${error.message}`);

      for (const mc of module.content || []) {
        if (!mc.id) continue;
        const { error: mcError } = await supabaseLTE
          .from("modules_content")
          .update({
            stage_description: mc.stage_description,
            module_context: mc.module_context,
            curriculum_reference: mc.curriculum_reference,
          })
          .eq("id", mc.id);
        if (mcError) errors.push(`6E stage ${mc.id}: ${mcError.message}`);
      }

      for (const art of module.artifacts || []) {
        if (!art.id) continue;
        const { error: artError } = await supabaseLTE
          .from("module_artifacts")
          .update({
            artifact_type: art.artifact_type,
            total_score: art.total_score,
            passing_score: art.passing_score,
            is_active: art.is_active,
          })
          .eq("id", art.id);
        if (artError) errors.push(`Artifact ${art.id}: ${artError.message}`);

        for (const question of art.questions || []) {
          if (!question.id) continue;
          const { error: qError } = await supabaseLTE
            .from("artifact_questions")
            .update({
              title: question.title,
              description: question.description,
              instructions: question.instructions,
            })
            .eq("id", question.id);
          if (qError) errors.push(`Artifact question ${question.id}: ${qError.message}`);
        }

        for (const template of art.templates || []) {
          if (!template.id) continue;
          const { error: tError } = await supabaseLTE
            .from("artifact_templates")
            .update({
              file_name: template.file_name,
              file_url: template.file_url,
              file_type: template.file_type,
            })
            .eq("id", template.id);
          if (tError) errors.push(`Artifact file ${template.id}: ${tError.message}`);
        }
      }
    }

    for (const item of snap.eContent || []) {
      if (!item.id) continue;
      const { error } = await supabaseLTE
        .from("e_content")
        .update({
          title: item.title,
          description: item.description,
          url: item.url,
          sort_order: item.sort_order,
          duration_seconds: item.duration_seconds,
          xp_reward: item.xp_reward,
        })
        .eq("id", item.id);
      if (error) errors.push(`Learning asset ${item.id}: ${error.message}`);
    }

    return errors;
  }
  return { POST };
}
