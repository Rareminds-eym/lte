import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import Logger, { getErrorMessage } from "./logger";

export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  const authenticateSSORequest = dependencies.authenticate;

  const logger = new Logger("LTEDraftsAPI");

  async function POST(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user)
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );

      const { courseId } = await request.json();
      if (!courseId)
        return HttpResponse.json(
          { success: false, error: "courseId is required" },
          { status: 400 },
        );

      const { data: level, error: levelError } = await supabaseLTE
        .from("levels")
        .select("*")
        .eq("id", courseId)
        .single();
      if (levelError || !level)
        return HttpResponse.json(
          { success: false, error: "Course level not found" },
          { status: 404 },
        );

      const { data: existingDraft, error: draftLookupError } = await supabaseLTE
        .from("catalog_versions")
        .select("*")
        .eq("entity_type", "level")
        .eq("entity_id", courseId)
        .eq("status", "DRAFT")
        .maybeSingle();
      if (draftLookupError)
        throw new Error(`Failed to load active draft: ${draftLookupError.message}`);
      if (existingDraft) return HttpResponse.json({ success: true, draft: existingDraft });

      const { data: latestVersion, error: versionError } = await supabaseLTE
        .from("catalog_versions")
        .select("version_no")
        .eq("entity_type", "level")
        .eq("entity_id", courseId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (versionError)
        throw new Error(`Failed to allocate draft version: ${versionError.message}`);

      const { data: newDraft, error: insertError } = await supabaseLTE
        .from("catalog_versions")
        .insert({
          entity_type: "level",
          entity_id: courseId,
          version_no: (latestVersion?.version_no || 0) + 1,
          status: "DRAFT",
          snapshot_data: { level },
          change_reason: "WORKSPACE_EDIT_DRAFT",
          created_by: user.userId,
        })
        .select("*")
        .single();
      if (insertError || !newDraft)
        throw new Error(`Failed to create draft: ${insertError?.message}`);

      logger.info("Opened level draft", {
        courseId,
        draftId: newDraft.id,
        versionNo: newDraft.version_no,
      });
      return HttpResponse.json({ success: true, draft: newDraft });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Failed to create/open draft", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  async function PUT(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user)
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );

      const { draftId, expectedDraftRevision, snapshotData } = await request.json();
      if (!draftId || !Number.isInteger(expectedDraftRevision) || expectedDraftRevision < 1) {
        return HttpResponse.json(
          { success: false, error: "draftId and expectedDraftRevision are required" },
          { status: 400 },
        );
      }

      if (
        !snapshotData ||
        typeof snapshotData !== "object" ||
        Array.isArray(snapshotData) ||
        ["assetValidation", "workspacePublishLock", "workspacePublishStartedAt"].some((field) =>
          Object.hasOwn(snapshotData, field),
        )
      ) {
        return HttpResponse.json(
          { success: false, error: "Invalid draft snapshot or server-owned publication state" },
          { status: 400 },
        );
      }

      const newRevision = Number(expectedDraftRevision) + 1;
      const { data: updatedDraft, error: updateError } = await supabaseLTE
        .from("catalog_versions")
        .update({ snapshot_data: snapshotData, draft_revision: newRevision })
        .eq("id", draftId)
        .eq("entity_type", "level")
        .eq("draft_revision", expectedDraftRevision)
        .eq("status", "DRAFT")
        .is("snapshot_data->workspacePublishLock", null)
        .select("*")
        .single();

      if (updateError || !updatedDraft) {
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CHANGED",
            error: "Draft revision conflict during update.",
          },
          { status: 409 },
        );
      }

      logger.info("Draft updated successfully", { draftId, newRevision });
      return HttpResponse.json({
        success: true,
        draftId,
        newDraftRevision: newRevision,
        draft: updatedDraft,
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Failed to save draft", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  async function DELETE(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);
      if (authError || !user)
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );

      const { searchParams } = new URL(request.url);
      const draftId = searchParams.get("draftId");
      if (!draftId)
        return HttpResponse.json({ success: false, error: "draftId is required" }, { status: 400 });

      const { data: discarded, error: updateError } = await supabaseLTE
        .from("catalog_versions")
        .update({ status: "ABANDONED" })
        .eq("id", draftId)
        .eq("entity_type", "level")
        .eq("status", "DRAFT")
        .is("snapshot_data->workspacePublishLock", null)
        .select("id")
        .maybeSingle();
      if (updateError) throw new Error(`Failed to abandon draft: ${updateError.message}`);
      if (!discarded)
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CONFLICT",
            error: "Draft is missing or being published.",
          },
          { status: 409 },
        );

      logger.info("Draft abandoned", { draftId });
      return HttpResponse.json({ success: true, draftId, status: "ABANDONED" });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Failed to abandon draft", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }
  return { POST, PUT, DELETE };
}
