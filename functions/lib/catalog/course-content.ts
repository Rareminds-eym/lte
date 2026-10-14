import type { CatalogDependencies } from "./dependencies";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import { type HttpRequest, HttpResponse } from "./http";
import { assertScalarAssetUrl } from "./ingestion/asset-extractor";
import { validateAndStreamAsset } from "./ingestion/asset-validator";
import Logger, { getErrorMessage } from "./logger";
import { publicationOwnership } from "./publication-ownership";

export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  const authenticateSSORequest = dependencies.authenticate;
  const getR2StorageService = async () => dependencies.publishOptions.storage;

  const logger = new Logger("LTECourseContentAPI");

  /**
   * Get full course content including modules, 6Es stages, artifacts, artifact questions, and e_content
   */
  async function GET(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user) {
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );
      }

      const { searchParams } = new URL(request.url);
      const courseId = searchParams.get("courseId");

      if (!courseId) {
        return HttpResponse.json(
          { success: false, error: "courseId is required" },
          { status: 400 },
        );
      }

      logger.info("Fetching full course content", { courseId, userId: user.id });

      // The canonical course record is the published level row.
      const { data: level, error: levelError } = await supabaseLTE
        .from("levels")
        .select("*")
        .eq("id", courseId)
        .single();

      if (levelError || !level) {
        return HttpResponse.json({ success: false, error: "Course not found" }, { status: 404 });
      }

      const [capabilityRes, levelScaleRes, versionsRes] = await Promise.all([
        level.capability_id
          ? supabaseLTE
              .from("capabilities")
              .select("id, code, name, description")
              .eq("id", level.capability_id)
              .maybeSingle()
          : { data: null, error: null },
        level.level_id
          ? supabaseLTE
              .from("level_scale")
              .select("id, level_no, level_label, generic_definition")
              .eq("id", level.level_id)
              .maybeSingle()
          : { data: null, error: null },
        supabaseLTE
          .from("catalog_versions")
          .select("id, version_no, status, draft_revision, change_reason, published_at, created_at")
          .eq("entity_type", "level")
          .eq("entity_id", level.id)
          .order("version_no", { ascending: false }),
      ]);

      if (capabilityRes.error)
        throw new Error(`Failed to fetch capability: ${capabilityRes.error.message}`);
      if (levelScaleRes.error)
        throw new Error(`Failed to fetch level scale: ${levelScaleRes.error.message}`);
      if (versionsRes.error)
        throw new Error(`Failed to fetch level versions: ${versionsRes.error.message}`);

      const course = {
        ...level,
        course_code: level.level_code,
        course_name: level.title || level.level_code,
        short_name: level.level_code,
        lifecycle_status: level.is_active ? "ACTIVE" : "RETIRED",
        capability: capabilityRes.data || null,
        level_scale: levelScaleRes.data || null,
        current_published_version_id:
          (versionsRes.data || []).find((version: any) => version.status === "PUBLISHED")?.id ||
          null,
        current_assignable_version_id: null,
      };

      // 3. Get all modules for this level or course
      let modules: any[] = [];
      if (level) {
        const { data: modulesByLevel } = await supabaseLTE
          .from("modules")
          .select("*")
          .eq("level_id", level.id)
          .order("module_no", { ascending: true });

        if (modulesByLevel && modulesByLevel.length > 0) {
          modules = modulesByLevel;
        }
      }

      // 4. Get module content (6Es) and artifacts for each module
      const allContentIds: string[] = [];

      const modulesWithContent = await Promise.all(
        (modules || []).map(async (module) => {
          // Fetch 6Es stage content (modules_content)
          const { data: content } = await supabaseLTE
            .from("modules_content")
            .select("*")
            .eq("module_id", module.id)
            .order("stage_order", { ascending: true });

          const moduleContentList = content || [];
          const contentIds = moduleContentList.map((c: any) => c.id).filter(Boolean);
          allContentIds.push(...contentIds);

          // Artifacts belong to a 6E stage. There is no module_id column on the
          // published module_artifacts table, so resolve them through the stage ids.
          let artifacts: any[] = [];
          if (contentIds.length > 0) {
            const { data: artifactsByContent } = await supabaseLTE
              .from("module_artifacts")
              .select("*")
              .in("modules_content_id", contentIds);

            if (artifactsByContent && artifactsByContent.length > 0) {
              artifacts = artifactsByContent;
            }
          }

          // Get artifact questions and templates for each artifact
          const artifactsWithQuestions = await Promise.all(
            (artifacts || []).map(async (artifact) => {
              const { data: questions } = await supabaseLTE
                .from("artifact_questions")
                .select("*")
                .eq("artifact_id", artifact.id)
                .order("question_order", { ascending: true });

              const { data: templates } = await supabaseLTE
                .from("artifact_templates")
                .select("*")
                .eq("artifact_id", artifact.id);

              return {
                ...artifact,
                // Keep a friendly editable label without pretending that
                // artifact_title is a physical database column.
                artifact_title: artifact.metadata?.title || artifact.artifact_type,
                questions: questions || [],
                templates: templates || [],
              };
            }),
          );

          return {
            ...module,
            content: moduleContentList,
            artifacts: artifactsWithQuestions,
          };
        }),
      );

      // 5. Get e_content (learning materials)
      let eContent: any[] = [];
      if (allContentIds.length > 0) {
        const { data: eDataByContent } = await supabaseLTE
          .from("e_content")
          .select("*")
          .in("modules_content_id", allContentIds);
        if (eDataByContent && eDataByContent.length > 0) {
          eContent = eDataByContent;
        }
      }

      const activeDraft =
        (versionsRes.data || []).find((version: any) => version.status === "DRAFT") || null;

      return HttpResponse.json({
        success: true,
        course,
        level: level || null,
        capability: capabilityRes.data || null,
        levelScale: levelScaleRes.data || null,
        versions: versionsRes.data || [],
        activeDraft,
        modules: modulesWithContent,
        eContent,
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Course content API error", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Save course content edits as a DRAFT version.
   * Nothing is written to live tables here — publishing happens via POST so
   * every editor change goes through draft -> review -> publish.
   */
  async function PUT(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user) {
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );
      }

      const body = await request.json();
      const { courseId, updates, changeReason, expectedDraftRevision } = body;

      if (!courseId || !updates) {
        return HttpResponse.json(
          { success: false, error: "courseId and updates are required" },
          { status: 400 },
        );
      }

      logger.info("Saving course content draft", { courseId, userId: user.id });
      stripIdentityFields(updates);
      try {
        collectEditedSourceLinks(updates);
      } catch (error) {
        return HttpResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 400 },
        );
      }

      const { data: activeDraft, error: draftLookupError } = await supabaseLTE
        .from("catalog_versions")
        .select("id, version_no, draft_revision, snapshot_data")
        .eq("entity_type", "level")
        .eq("entity_id", courseId)
        .eq("status", "DRAFT")
        .maybeSingle();
      if (draftLookupError)
        throw new Error(`Failed to load active draft: ${draftLookupError.message}`);

      const snapshotData = {
        kind: "workspace_edit_draft",
        courseId,
        course: updates.course || null,
        modules: updates.modules || null,
        eContent: updates.eContent || null,
        editedBy: user.userId,
        editedAt: new Date().toISOString(),
      };

      if (activeDraft) {
        if (!Number.isInteger(expectedDraftRevision) || expectedDraftRevision < 1)
          return HttpResponse.json(
            { success: false, error: "expectedDraftRevision is required for an existing draft" },
            { status: 400 },
          );
        if (
          activeDraft.draft_revision !== expectedDraftRevision ||
          activeDraft.snapshot_data?.workspacePublishLock
        ) {
          return HttpResponse.json(
            {
              success: false,
              errorCode: "DRAFT_CONFLICT",
              error: "This draft changed elsewhere. Reload and re-apply your edits.",
              draftId: activeDraft.id,
              draftRevision: activeDraft.draft_revision,
            },
            { status: 409 },
          );
        }
        const newRevision = (activeDraft.draft_revision || 0) + 1;
        const { data: updated, error: updateError } = await supabaseLTE
          .from("catalog_versions")
          .update({
            snapshot_data: snapshotData,
            draft_revision: newRevision,
            change_reason: changeReason || "WORKSPACE_EDIT_DRAFT",
          })
          .eq("id", activeDraft.id)
          .eq("draft_revision", expectedDraftRevision)
          .eq("status", "DRAFT")
          .is("snapshot_data->workspacePublishLock", null)
          .select("id")
          .maybeSingle();
        if (updateError) throw new Error(`Failed to save draft: ${updateError.message}`);
        if (!updated)
          return HttpResponse.json(
            {
              success: false,
              errorCode: "DRAFT_CONFLICT",
              error: "This draft changed elsewhere. Reload before editing.",
            },
            { status: 409 },
          );
        return HttpResponse.json({
          success: true,
          status: "DRAFT",
          message: `Draft saved (revision ${newRevision}). Publish to make it live.`,
          draftId: activeDraft.id,
          draftRevision: newRevision,
          versionNo: activeDraft.version_no,
        });
      }

      const { data: latestVersion } = await supabaseLTE
        .from("catalog_versions")
        .select("version_no")
        .eq("entity_type", "level")
        .eq("entity_id", courseId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      const newVersionNo = ((latestVersion as any)?.version_no || 0) + 1;
      const { data: newDraft, error: insertError } = await supabaseLTE
        .from("catalog_versions")
        .insert({
          entity_type: "level",
          entity_id: courseId,
          version_no: newVersionNo,
          status: "DRAFT",
          draft_revision: 1,
          snapshot_data: snapshotData,
          change_reason: changeReason || "WORKSPACE_EDIT_DRAFT",
          created_by: user.userId,
        })
        .select("id, version_no")
        .single();
      if (insertError || !newDraft)
        throw new Error(`Failed to create draft: ${insertError?.message}`);
      return HttpResponse.json({
        success: true,
        status: "DRAFT",
        message: `Draft saved as version ${newVersionNo}. Publish to make it live.`,
        draftId: (newDraft as any).id,
        draftRevision: 1,
        versionNo: newVersionNo,
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Course content draft error", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Publish the active draft: applies its pending edits to live tables, then
   * flips the draft row itself to PUBLISHED so version history stays linear.
   */
  async function POST(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user) {
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );
      }

      const body = await request.json();
      const { courseId, expectedDraftRevision } = body;
      if (!courseId || !Number.isInteger(expectedDraftRevision) || expectedDraftRevision < 1) {
        return HttpResponse.json(
          { success: false, error: "courseId and expectedDraftRevision are required" },
          { status: 400 },
        );
      }

      const { data: draft, error: draftError } = await supabaseLTE
        .from("catalog_versions")
        .select("*")
        .eq("entity_type", "level")
        .eq("entity_id", courseId)
        .eq("status", "DRAFT")
        .maybeSingle();
      if (draftError) throw new Error(`Failed to load active draft: ${draftError.message}`);
      if (!draft) {
        return HttpResponse.json(
          { success: false, error: "No active draft to publish for this course." },
          { status: 404 },
        );
      }
      const existingLock = draft.snapshot_data?.workspacePublishLock;
      if (draft.draft_revision !== expectedDraftRevision || existingLock) {
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CONFLICT",
            error: "This draft changed elsewhere. Reload before publishing.",
            draftId: draft.id,
            draftRevision: draft.draft_revision,
          },
          { status: 409 },
        );
      }

      const snap = (draft.snapshot_data || {}) as any;
      delete snap.workspacePublishLock;
      delete snap.workspacePublishStartedAt;
      const workspacePublishLock = crypto.randomUUID();
      const revision = expectedDraftRevision + 1;
      const claim = supabaseLTE
        .from("catalog_versions")
        .update({
          snapshot_data: {
            ...snap,
            workspacePublishLock,
            workspacePublishStartedAt: new Date().toISOString(),
          },
          draft_revision: revision,
        })
        .eq("id", draft.id)
        .eq("status", "DRAFT")
        .eq("draft_revision", expectedDraftRevision)
        .is("snapshot_data->workspacePublishLock", null);
      const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
      if (claimError) throw new Error(`Failed to claim draft: ${claimError.message}`);
      if (!claimed)
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CONFLICT",
            error: "This draft changed before publication.",
          },
          { status: 409 },
        );
      const assertOwned = publicationOwnership(
        supabaseLTE,
        draft.id,
        "level",
        workspacePublishLock,
      );
      let published = false;
      try {
        const updates = { course: snap.course, modules: snap.modules, eContent: snap.eContent };
        stripIdentityFields(updates);
        await assertOwned();
        await stageEditedAssetLinks(courseId, updates, draft.id);
        await assertOwned();
        const writeErrors = await applyCourseContentWrites(courseId, updates, assertOwned);
        if (writeErrors.length > 0) {
          logger.error("Draft publish completed with write failures", { courseId, writeErrors });
          return HttpResponse.json(
            {
              success: false,
              error: "Some draft content could not be published.",
              details: writeErrors,
            },
            { status: 500 },
          );
        }

        const publishedAt = new Date().toISOString();
        const { data: flipped, error: flipError } = await supabaseLTE
          .from("catalog_versions")
          .update({
            status: "PUBLISHED",
            snapshot_data: {
              ...snap,
              kind: "workspace_edit",
              publishedBy: user.userId,
              publishedAt,
            },
            published_by: user.userId,
            published_at: publishedAt,
          })
          .eq("id", draft.id)
          .eq("status", "DRAFT")
          .eq("draft_revision", revision)
          .eq("snapshot_data->>workspacePublishLock", workspacePublishLock)
          .select("id")
          .maybeSingle();
        if (flipError) throw new Error(`Failed to mark draft as published: ${flipError.message}`);
        if (!flipped) throw new Error("Draft publication lock was superseded.");
        published = true;

        logger.info("Draft published", {
          courseId,
          versionNo: draft.version_no,
          draftId: draft.id,
        });
        return HttpResponse.json({
          success: true,
          status: "PUBLISHED",
          message: `Draft published as version ${draft.version_no}`,
          newVersionNo: draft.version_no,
          newVersionId: draft.id,
        });
      } finally {
        if (!published) {
          const { error } = await supabaseLTE
            .from("catalog_versions")
            .update({ snapshot_data: snap })
            .eq("id", draft.id)
            .eq("status", "DRAFT")
            .eq("draft_revision", revision)
            .eq("snapshot_data->>workspacePublishLock", workspacePublishLock);
          if (error)
            logger.error("Failed to release draft publication lock", {
              draftId: draft.id,
              error: error.message,
            });
        }
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Draft publish error", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Discard the active draft without touching live tables.
   */
  async function DELETE(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user) {
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );
      }

      const { searchParams } = new URL(request.url);
      const draftId = searchParams.get("draftId");
      if (!draftId) {
        return HttpResponse.json({ success: false, error: "draftId is required" }, { status: 400 });
      }

      const { data: discarded, error } = await supabaseLTE
        .from("catalog_versions")
        .update({ status: "ABANDONED" })
        .eq("id", draftId)
        .eq("entity_type", "level")
        .eq("status", "DRAFT")
        .is("snapshot_data->workspacePublishLock", null)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`Failed to discard draft: ${error.message}`);
      if (!discarded)
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CONFLICT",
            error: "Draft is missing or being published.",
          },
          { status: 409 },
        );
      return HttpResponse.json({ success: true, draftId, status: "ABANDONED" });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Draft discard error", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  function stripIdentityFields(updates: any): void {
    // Capability / level identity is immutable from the editor. Any
    // capability_id, level_id, level_code, or capability object sent by the
    // client is stripped so a course can never be re-parented by editing.
    if (updates?.course) {
      delete updates.course.capability_id;
      delete updates.course.level_id;
      delete updates.course.level_code;
      delete updates.course.course_code;
      delete updates.course.capability;
    }
  }

  async function stageEditedAssetLinks(
    courseId: string,
    updates: unknown,
    draftId: string,
  ): Promise<void> {
    if (!isRecord(updates)) throw new Error("Invalid draft update payload.");

    const editedLinks = collectEditedSourceLinks(updates);
    if (editedLinks.length === 0) return;

    const [levelResult, storage] = await Promise.all([
      supabaseLTE.from("levels").select("level_code, capability_id").eq("id", courseId).single(),
      getR2StorageService(),
    ]);

    if (levelResult.error || !levelResult.data) {
      throw new Error(
        `Failed to load course for asset staging: ${levelResult.error?.message || courseId}`,
      );
    }

    let capabilityCode = "WORKSPACE_EDIT";
    if (levelResult.data.capability_id) {
      const { data: capability } = await supabaseLTE
        .from("capabilities")
        .select("code")
        .eq("id", levelResult.data.capability_id)
        .maybeSingle();
      capabilityCode = capability?.code || capabilityCode;
    }

    const levelCode = levelResult.data.level_code || courseId;
    const staged = new Map<string, Promise<{ publicUrl: string; mimeType: string }>>();

    const stageUrl = async (
      url: string,
      context: {
        moduleNo: number;
        category: "content" | "artifact";
        artifactType?: string;
        artifactSubfolder?: "templates";
      },
    ) => {
      const cacheKey = `${context.category}|${context.artifactType || ""}|${context.moduleNo}|${url}`;
      if (!staged.has(cacheKey)) {
        staged.set(
          cacheKey,
          (async () => {
            const uploaded = await storage.stageStream(
              (consume) => validateAndStreamAsset(url, consume),
              {
                capabilityCode,
                levelCode,
                ...context,
                originalUrl: url,
                uploadId: draftId,
              },
            );
            return { publicUrl: uploaded.publicUrl, mimeType: uploaded.mimeType };
          })(),
        );
      }
      return staged.get(cacheKey)!;
    };

    for (const module of asArray(updates["modules"]).filter(isRecord)) {
      const moduleNo = Number(module["module_no"] || 0);
      for (const artifact of asArray(module["artifacts"]).filter(isRecord)) {
        const artifactType = String(artifact["artifact_type"] || "artifact");
        for (const template of asArray(artifact["templates"]).filter(isRecord)) {
          if (!template?.["file_url"] || !isImportableWorkspaceSourceUrl(template["file_url"]))
            continue;
          const originalUrl = template["file_url"];
          const uploaded = await stageUrl(originalUrl, {
            moduleNo,
            category: "artifact",
            artifactType,
            artifactSubfolder: "templates",
          });
          template["file_url"] = uploaded.publicUrl;
          template["file_type"] = template["file_type"] || uploaded.mimeType;
          template["metadata"] = {
            ...(template["metadata"] || {}),
            source_url: template["metadata"]?.source_url || originalUrl,
            staged_from_workspace_edit: true,
          };
        }
      }
    }

    const moduleNoByContentId = new Map<string, number>();
    for (const module of asArray(updates["modules"]).filter(isRecord)) {
      for (const content of asArray(module["content"]).filter(isRecord)) {
        if (content?.["id"])
          moduleNoByContentId.set(content["id"], Number(module["module_no"] || 0));
      }
    }

    for (const item of asArray(updates["eContent"]).filter(isRecord)) {
      if (!item?.["url"] || !isImportableWorkspaceSourceUrl(item["url"])) continue;
      const moduleNo = moduleNoByContentId.get(item["modules_content_id"]) || 0;
      const uploaded = await stageUrl(item["url"], { moduleNo, category: "content" });
      const originalUrl = item["url"];
      item["url"] = uploaded.publicUrl;
      item["mime_type"] = item["mime_type"] || uploaded.mimeType;
      item["metadata"] = {
        ...(item["metadata"] || {}),
        source_url: item["metadata"]?.source_url || originalUrl,
        staged_from_workspace_edit: true,
      };
    }

    logger.info("Workspace edited asset links staged to R2", {
      courseId,
      draftId,
      stagedCount: staged.size,
    });
  }

  function collectEditedSourceLinks(updates: unknown): string[] {
    if (!isRecord(updates)) return [];

    const links: string[] = [];
    for (const module of asArray(updates["modules"]).filter(isRecord)) {
      for (const artifact of asArray(module["artifacts"]).filter(isRecord)) {
        for (const template of asArray(artifact["templates"]).filter(isRecord)) {
          assertScalarAssetUrl(template["file_url"], "artifact template file_url");
          if (template?.["file_url"] && isImportableWorkspaceSourceUrl(template["file_url"]))
            links.push(template["file_url"]);
        }
      }
    }
    for (const item of asArray(updates["eContent"]).filter(isRecord)) {
      assertScalarAssetUrl(item["url"], "learning content url");
      if (item?.["url"] && isImportableWorkspaceSourceUrl(item["url"])) links.push(item["url"]);
    }
    return links;
  }

  function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isImportableWorkspaceSourceUrl(value: unknown): value is string {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        ["docs.google.com", "drive.google.com"].includes(url.hostname.toLowerCase())
      );
    } catch {
      return false;
    }
  }

  async function applyCourseContentWrites(
    courseId: string,
    updates: any,
    assertOwned: () => Promise<void>,
  ): Promise<string[]> {
    const writeErrors: string[] = [];

    // Update canonical level basic info.
    if (updates.course) {
      await assertOwned();
      const { error: levelError } = await supabaseLTE
        .from("levels")
        .update({
          title: updates.course.course_name,
          description: updates.course.description,
          observable_behavior: updates.course.observable_behavior,
          example_outputs: updates.course.example_outputs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", courseId);

      if (levelError) {
        throw new Error(`Failed to update level course: ${levelError.message}`);
      }
    }

    // Update modules
    if (updates.modules && Array.isArray(updates.modules)) {
      for (const module of updates.modules) {
        if (module.id) {
          await assertOwned();
          const { error: moduleError } = await supabaseLTE
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

          if (moduleError) {
            logger.error("Failed to update module", { moduleId: module.id, error: moduleError });
            writeErrors.push(`Module ${module.id}: ${moduleError.message}`);
          }

          // Update 6Es content (modules_content)
          if (module.content && Array.isArray(module.content)) {
            for (const mc of module.content) {
              if (mc.id) {
                await assertOwned();
                const { error: mcError } = await supabaseLTE
                  .from("modules_content")
                  .update({
                    stage_description: mc.stage_description,
                    module_context: mc.module_context,
                    curriculum_reference: mc.curriculum_reference,
                  })
                  .eq("id", mc.id);

                if (mcError) {
                  logger.error("Failed to update modules_content", { mcId: mc.id, error: mcError });
                  writeErrors.push(`6E stage ${mc.id}: ${mcError.message}`);
                }
              }
            }
          }

          // Update artifacts (module_artifacts)
          if (module.artifacts && Array.isArray(module.artifacts)) {
            for (const art of module.artifacts) {
              if (art.id) {
                await assertOwned();
                const { error: artError } = await supabaseLTE
                  .from("module_artifacts")
                  .update({
                    artifact_type: art.artifact_type,
                    total_score: art.total_score,
                    passing_score: art.passing_score,
                    is_active: art.is_active,
                    metadata: {
                      ...(art.metadata || {}),
                      title: art.artifact_title,
                    },
                  })
                  .eq("id", art.id);

                if (artError) {
                  logger.error("Failed to update module_artifacts", {
                    artifactId: art.id,
                    error: artError,
                  });
                  writeErrors.push(`Artifact ${art.id}: ${artError.message}`);
                }

                for (const question of art.questions || []) {
                  if (!question.id) continue;
                  await assertOwned();
                  const { error: questionError } = await supabaseLTE
                    .from("artifact_questions")
                    .update({
                      question_order: question.question_order,
                      title: question.title,
                      description: question.description,
                      instructions: question.instructions,
                      is_active: question.is_active,
                      metadata: question.metadata,
                    })
                    .eq("id", question.id);
                  if (questionError) {
                    writeErrors.push(`Artifact question ${question.id}: ${questionError.message}`);
                  }
                }

                for (const template of art.templates || []) {
                  if (!template.id) continue;
                  await assertOwned();
                  const { error: templateError } = await supabaseLTE
                    .from("artifact_templates")
                    .update({
                      file_name: template.file_name,
                      file_url: template.file_url,
                      file_type: template.file_type,
                      version: template.version,
                      is_downloadable: template.is_downloadable,
                      metadata: template.metadata,
                    })
                    .eq("id", template.id);
                  if (templateError) {
                    writeErrors.push(`Artifact file ${template.id}: ${templateError.message}`);
                  }
                }
              }
            }
          }
        }
      }
    }

    if (Array.isArray(updates.eContent)) {
      for (const item of updates.eContent) {
        if (!item.id) continue;
        await assertOwned();
        const { error: contentError } = await supabaseLTE
          .from("e_content")
          .update({
            content_type: item.content_type,
            title: item.title,
            description: item.description,
            url: item.url,
            sort_order: item.sort_order,
            duration_seconds: item.duration_seconds,
            xp_reward: item.xp_reward,
            mime_type: item.mime_type || null,
            status: item.status,
            metadata: item.metadata,
          })
          .eq("id", item.id);
        if (contentError) {
          writeErrors.push(`Learning asset ${item.id}: ${contentError.message}`);
        }
      }
    }

    return writeErrors;
  }
  return { GET, PUT, POST, DELETE };
}
