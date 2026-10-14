/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */

import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import { extractAssets } from "./ingestion/asset-extractor";
import { calculateHash } from "./ingestion/snapshot-serializer";
import { formatText } from "./ingestion/text-formatter";
import Logger, { getErrorMessage } from "./logger";
import type { LTEIngestionSnapshot, LTELevelCourse } from "./types";

export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  const authenticateSSORequest = dependencies.authenticate;

  const logger = new Logger("LTEReviewAPI");

  interface ReviewResponse {
    success: boolean;
    uploadId?: string;
    sourceName?: string;
    status?: string;
    reviewedSnapshotHash?: string;
    snapshot?: LTEIngestionSnapshot;
    validationReport?: any;
    courseSpecification?: any;
    modules?: any[];
    levelCourses?: any[];
    createdAt?: string;
    error?: string;
  }

  /**
   * GET /api/admin/lte/review
   * Retrieve validated upload snapshot by upload ID for review
   */
  async function GET(request: HttpRequest): Promise<HttpResponse<ReviewResponse>> {
    logger.info("Processing LTE review request");

    try {
      // Authenticate admin user
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);

      if (authError || !user) {
        logger.warn("Unauthorized review attempt");
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );
      }

      logger.info("User authenticated for review", { userId: user.userId, role: user.role });

      // Get uploadId from query parameters
      const { searchParams } = new URL(request.url);
      const uploadId = searchParams.get("uploadId");

      logger.info("Fetching catalog version for review", { uploadId });

      let versionQuery = supabaseLTE
        .from("catalog_versions")
        .select("*")
        .eq("entity_type", "catalog");

      versionQuery = uploadId
        ? versionQuery.eq("id", uploadId)
        : versionQuery.order("created_at", { ascending: false }).limit(1);

      const { data: uploadRecord, error: fetchError } = await versionQuery.maybeSingle();

      if (fetchError) {
        logger.error("Failed to fetch catalog version", { error: fetchError });
        return HttpResponse.json(
          { success: false, error: "Catalog version not found" },
          { status: 404 },
        );
      }

      if (!uploadRecord) {
        logger.warn("Catalog version not found", { uploadId });
        return HttpResponse.json(
          { success: false, error: "Catalog version not found" },
          { status: 404 },
        );
      }

      // Verify snapshot belongs to current user or user has admin role
      const hasAccess =
        !uploadRecord.created_by ||
        uploadRecord.created_by === user.userId ||
        ["admin", "super_admin", "platform_admin"].includes(user.role);

      if (!hasAccess) {
        logger.warn("Unauthorized access to upload", {
          uploadId,
          userId: user.userId,
          ownerId: uploadRecord.created_by,
        });
        return HttpResponse.json(
          { success: false, error: "Unauthorized to access this upload" },
          { status: 403 },
        );
      }

      logger.info("Catalog version retrieved", {
        uploadId: uploadRecord.id,
        status: uploadRecord.status,
        versionNo: uploadRecord.version_no,
      });

      const rawSnapshot =
        uploadRecord.snapshot_data ||
        uploadRecord.reviewed_snapshot ||
        uploadRecord.normalized_snapshot;
      const reviewedHash = uploadRecord.snapshot_hash || uploadRecord.reviewed_snapshot_hash;
      const normalizedStatus =
        uploadRecord.status === "PUBLISHED"
          ? "published"
          : uploadRecord.status === "VALIDATED" || uploadRecord.status === "validated"
            ? "validated"
            : uploadRecord.status === "DRAFT" || uploadRecord.status === "uploaded"
              ? "uploaded"
              : "validation_failed";

      const snapshot: LTEIngestionSnapshot = {
        ...(rawSnapshot as LTEIngestionSnapshot),
        uploadId: uploadRecord.id,
        reviewedSnapshotHash: reviewedHash,
        snapshotHash: reviewedHash,
        status: normalizedStatus,
        draftRevision: uploadRecord.draft_revision || 1,
      };

      // Extract course specification from the snapshot
      const courseSpecification = extractCourseSpecification(snapshot);

      // Extract modules with 6 Es stages from the snapshot
      const modules = extractModulesWithStages(snapshot);

      logger.info("Review data prepared", {
        uploadId,
        courseTitle: courseSpecification?.courseTitle,
        modulesCount: modules.length,
        reviewedHash,
      });

      return HttpResponse.json({
        success: true,
        uploadId: uploadRecord.id,
        sourceName: snapshot.sourceName,
        status: snapshot.status,
        reviewedSnapshotHash: reviewedHash,
        snapshot,
        validationReport: snapshot.validationReport,
        courseSpecification,
        modules,
        levelCourses: (snapshot.levelCourses || []).map((lc: any) => ({
          ...lc,
          modules: (lc.modules || []).map((module: any) => normalizeReviewModule(module)),
          courseMetadata: lc?.courseMetadata
            ? {
                ...lc.courseMetadata,
                courseTitle: formatText(lc.courseMetadata.courseTitle, "Untitled Course"),
                courseCode: formatText(lc.courseMetadata.courseCode, "UNKNOWN"),
                domain: formatText(lc.courseMetadata.domain, "General"),
                capabilityCode: formatText(lc.courseMetadata.capabilityCode, "UNKNOWN"),
                capabilityLevel: formatText(lc.courseMetadata.capabilityLevel, "Level 1"),
                instructorLead: formatText(lc.courseMetadata.instructorLead, "Unknown Instructor"),
                courseSummary: formatText(lc.courseMetadata.courseSummary),
                problemStatement: formatText(lc.courseMetadata.problemStatement),
                capstoneTitle: formatText(lc.courseMetadata.capstoneTitle),
              }
            : lc?.courseMetadata,
        })),
        createdAt: uploadRecord.created_at,
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Failed to process LTE review request", { error: errorMessage });

      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  async function PATCH(request: HttpRequest): Promise<HttpResponse<ReviewResponse>> {
    logger.info("Processing LTE review save request");

    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "admin",
        "super_admin",
        "platform_admin",
      ]);

      if (authError || !user) {
        logger.warn("Unauthorized review save attempt");
        return (
          authError || HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        );
      }

      const body = await request.json();
      const uploadId = body?.uploadId;
      const expectedDraftRevision = body?.expectedDraftRevision;
      const course = body?.course as LTELevelCourse | undefined;

      if (
        !uploadId ||
        !course ||
        !Number.isInteger(expectedDraftRevision) ||
        expectedDraftRevision < 1
      ) {
        return HttpResponse.json(
          { success: false, error: "uploadId, course and expectedDraftRevision are required" },
          { status: 400 },
        );
      }

      const { data: uploadRecord, error: fetchError } = await supabaseLTE
        .from("catalog_versions")
        .select("*")
        .eq("id", uploadId)
        .eq("entity_type", "catalog")
        .maybeSingle();

      if (fetchError || !uploadRecord) {
        logger.error("Failed to fetch catalog version for save", { uploadId, error: fetchError });
        return HttpResponse.json(
          { success: false, error: "Catalog version not found" },
          { status: 404 },
        );
      }

      const hasAccess =
        !uploadRecord.created_by ||
        uploadRecord.created_by === user.userId ||
        ["admin", "super_admin", "platform_admin"].includes(user.role);

      if (!hasAccess) {
        return HttpResponse.json(
          { success: false, error: "Unauthorized to update this upload" },
          { status: 403 },
        );
      }

      const rawSnapshot = (uploadRecord.snapshot_data || {}) as LTEIngestionSnapshot;
      if (
        !["DRAFT", "VALIDATED"].includes(uploadRecord.status) ||
        ["VALIDATING", "PUBLISHING", "PUBLISHED"].includes(
          (rawSnapshot as any).assetValidation?.status,
        ) ||
        (uploadRecord.draft_revision || 1) !== expectedDraftRevision
      ) {
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CONFLICT",
            error: "This snapshot changed or publication has started. Reload before editing.",
          },
          { status: 409 },
        );
      }
      const existingLevelCourses = rawSnapshot.levelCourses || [];
      const levelCourses =
        existingLevelCourses.length > 0
          ? existingLevelCourses.map((levelCourse) =>
              levelCourse.levelCode === course.levelCode || levelCourse.levelNo === course.levelNo
                ? course
                : levelCourse,
            )
          : [course];

      const updatedSnapshot: LTEIngestionSnapshot = {
        ...rawSnapshot,
        uploadId,
        courseMetadata: course.courseMetadata,
        modules: course.modules,
        levelCourses,
        status: "validated",
        draftRevision: expectedDraftRevision + 1,
      };

      // Push preview edits into the normalized tables as well — publish only
      // upserts `tables`, so without this the edits would be silently dropped.
      const { syncCourseEditsToTables } = await import("./ingestion/review-sync");
      const syncResult = syncCourseEditsToTables(
        (updatedSnapshot.tables || {}) as Record<string, { columns: string[]; rows: any[][] }>,
        course,
      );
      if (syncResult.warnings.length > 0) {
        logger.warn("Review table sync warnings", { uploadId, warnings: syncResult.warnings });
      }
      try {
        extractAssets(updatedSnapshot);
      } catch (error) {
        return HttpResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 400 },
        );
      }

      const reviewedHash = calculateHash({
        tables: updatedSnapshot.tables || {},
        metadata: updatedSnapshot.metadata || {},
      });

      const snapshotWithHash: LTEIngestionSnapshot = {
        ...updatedSnapshot,
        snapshotHash: reviewedHash,
        reviewedSnapshotHash: reviewedHash,
      };

      const { data: updated, error: updateError } = await supabaseLTE
        .from("catalog_versions")
        .update({
          snapshot_data: snapshotWithHash,
          snapshot_hash: reviewedHash,
          status: "VALIDATED",
          draft_revision: expectedDraftRevision + 1,
        })
        .eq("id", uploadId)
        .eq("entity_type", "catalog")
        .eq("draft_revision", expectedDraftRevision)
        .eq("status", uploadRecord.status)
        .select("id")
        .maybeSingle();

      if (updateError) {
        logger.error("Failed to save reviewed LTE snapshot", { uploadId, error: updateError });
        return HttpResponse.json(
          { success: false, error: "Failed to save reviewed snapshot" },
          { status: 500 },
        );
      }
      if (!updated)
        return HttpResponse.json(
          {
            success: false,
            errorCode: "DRAFT_CONFLICT",
            error: "This snapshot changed elsewhere. Reload before editing.",
          },
          { status: 409 },
        );

      logger.info("Reviewed LTE snapshot saved", {
        uploadId,
        reviewedHash,
        levelCode: course.levelCode,
      });

      return HttpResponse.json({
        success: true,
        uploadId,
        status: snapshotWithHash.status,
        reviewedSnapshotHash: reviewedHash,
        snapshot: snapshotWithHash,
        levelCourses,
        modules: course.modules,
        courseSpecification: extractCourseSpecification(snapshotWithHash),
        tablesSynced: syncResult.applied,
        syncWarnings: syncResult.warnings,
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Failed to save LTE review changes", { error: errorMessage });

      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Extract course specification from normalized snapshot
   */
  function extractCourseSpecification(snapshot: LTEIngestionSnapshot): any {
    if (!snapshot || !snapshot.courseMetadata) {
      return {
        courseTitle: "Unknown Course",
        courseCode: "UNKNOWN",
        domain: "General",
        capabilityCode: "UNKNOWN",
        capabilityLevel: "Level 1",
        instructorLead: "Unknown Instructor",
        courseSummary: "",
        problemStatement: "",
        capstoneArtifactTitle: "",
      };
    }

    return {
      courseTitle: formatText(snapshot.courseMetadata.courseTitle, "Untitled Course"),
      courseCode: formatText(snapshot.courseMetadata.courseCode, "UNKNOWN"),
      domain: formatText(snapshot.courseMetadata.domain, "General"),
      capabilityCode: formatText(snapshot.courseMetadata.capabilityCode, "UNKNOWN"),
      capabilityLevel: formatText(snapshot.courseMetadata.capabilityLevel, "Level 1"),
      instructorLead: formatText(snapshot.courseMetadata.instructorLead, "Unknown Instructor"),
      courseSummary: formatText(snapshot.courseMetadata.courseSummary),
      problemStatement: formatText(snapshot.courseMetadata.problemStatement),
      capstoneArtifactTitle: formatText(snapshot.courseMetadata.capstoneTitle),
    };
  }

  /**
   * Extract modules with 6 Es stages from normalized snapshot
   */
  function extractModulesWithStages(snapshot: LTEIngestionSnapshot): any[] {
    if (!snapshot || !snapshot.modules) {
      return [];
    }

    // Return modules from snapshot
    // The modules should already include stages and artifact practices
    return snapshot.modules.map((module, index) => normalizeReviewModule(module, index));
  }

  function normalizeReviewModule(module: any, index?: number): any {
    return {
      index: module.index ?? index,
      title: module.title || `Module ${index}`,
      subtitle: module.subtitle || "",
      completionPercentage: module.completionPercentage ?? 0,
      status: module.status || "not_started",
      contextDescription: module.contextDescription || "",
      pressurePoints: module.pressurePoints || [],
      userConfusion: module.userConfusion || [],
      industryChallenge: module.industryChallenge || "",
      prerequisites: module.prerequisites || [],
      whatYoullLearn: module.whatYoullLearn || [],
      whenToApply: module.whenToApply || "",
      moduleProblemStatement: module.moduleProblemStatement || "",
      stages: module.stages || [],
      artifactPractices: module.artifactPractices || [],
    };
  }
  return { GET, PATCH };
}
