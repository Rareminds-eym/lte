/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */

import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import { formatText } from "./ingestion/text-formatter";
import Logger, { getErrorMessage } from "./logger";

export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  const authenticateSSORequest = dependencies.authenticate;

  const logger = new Logger("LTECatalogWorkspaceAPI");

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
      const view = searchParams.get("view") || "summary";
      const id = searchParams.get("id");

      switch (view) {
        case "dashboard":
          return await handleDashboardView();
        case "summary":
          return await handleSummaryView();
        case "capabilities":
          return await handleCapabilitiesView(searchParams);
        case "capability_detail":
          return await handleCapabilityDetailView(id);
        case "roles":
          return await handleRolesView(searchParams);
        case "role_detail":
          return await handleRoleDetailView(id);
        case "courses":
          return await handleCoursesView();
        case "course_detail":
          return await handleCourseDetailView(id);
        default:
          return HttpResponse.json(
            { success: false, error: `Invalid view parameter: ${view}` },
            { status: 400 },
          );
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Catalog Workspace API error", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  function getLevelNoFromCode(levelCode: unknown): number | null {
    const match = String(levelCode || "")
      .toUpperCase()
      .match(/_L(\d{1,2})\b/);
    if (!match) return null;
    const no = Number(match[1]);
    return Number.isFinite(no) && no > 0 ? no : null;
  }

  async function handleDashboardView(): Promise<HttpResponse> {
    // Scoped dashboard: only capabilities/roles linked to uploaded levels are
    // shown. Reference tables hold 730+ capabilities / 2280+ roles, so global
    // counts would drown the 4 uploaded courses. Never select snapshot_data
    // for lists either — full snapshots stay in single-row lookups only.
    // Phase 1: uploaded levels + counts (levels table is tiny).
    const [
      levelsRes,
      levelsCountRes,
      publishedLevelVersionsRes,
      needsReviewRes,
      levelVersionsCountRes,
      latestCatalogRes,
    ] = await Promise.all([
      supabaseLTE
        .from("levels")
        .select("id, level_code, title, capability_id, status, version_no, is_active")
        .eq("is_active", true)
        .order("level_code"),
      supabaseLTE.from("levels").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseLTE
        .from("catalog_versions")
        .select("entity_id, version_no")
        .eq("entity_type", "level")
        .eq("status", "PUBLISHED"),
      supabaseLTE
        .from("catalog_versions")
        .select("id, created_at")
        .eq("entity_type", "catalog")
        .in("status", ["DRAFT", "VALIDATED"]),
      supabaseLTE
        .from("catalog_versions")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "level"),
      supabaseLTE
        .from("catalog_versions")
        .select("snapshot_data, published_at, created_at")
        .eq("entity_type", "catalog")
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    throwIfAnyError([
      levelsRes,
      levelsCountRes,
      publishedLevelVersionsRes,
      needsReviewRes,
      levelVersionsCountRes,
      latestCatalogRes,
    ]);

    const levels = levelsRes.data || [];
    const publishedLevelVersions = publishedLevelVersionsRes.data || [];

    // Distinct capabilities that actually have uploaded levels.
    const uploadedCapabilityIds = Array.from(
      new Set((levels || []).map((level: any) => level.capability_id).filter(Boolean)),
    );

    // Phase 2: only refs linked to uploads.
    const [capsRes, roleCapsRes] = await Promise.all([
      uploadedCapabilityIds.length > 0
        ? supabaseLTE
            .from("capabilities")
            .select("id, code, name")
            .in("id", uploadedCapabilityIds)
            .order("code")
            .range(0, 24)
        : Promise.resolve({ data: [], error: null } as any),
      uploadedCapabilityIds.length > 0
        ? supabaseLTE
            .from("role_capability_sequence")
            .select("role_id, capability_id")
            .in("capability_id", uploadedCapabilityIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    throwIfAnyError([capsRes, roleCapsRes]);

    const capabilities = capsRes.data || [];
    const roleCaps = roleCapsRes.data || [];
    const uploadedRoleIds = Array.from(
      new Set((roleCaps || []).map((row: any) => row.role_id).filter(Boolean)),
    );

    const rolesRes =
      uploadedRoleIds.length > 0
        ? await supabaseLTE
            .from("roles")
            .select("id, role_name")
            .in("id", uploadedRoleIds)
            .is("deleted_at", null)
            .order("role_name")
            .range(0, 24)
        : ({ data: [], error: null } as any);
    throwIfAnyError([rolesRes]);
    const roles = rolesRes.data || [];

    const levelCountsByCapability = new Map<string, number>();
    const levelsByCapability = new Map<
      string,
      Array<{ levelNo: number | null; status: unknown }>
    >();
    for (const level of levels) {
      levelCountsByCapability.set(
        level.capability_id,
        (levelCountsByCapability.get(level.capability_id) || 0) + 1,
      );
      const list = levelsByCapability.get(level.capability_id) || [];
      list.push({ levelNo: getLevelNoFromCode(level.level_code), status: level.status });
      levelsByCapability.set(level.capability_id, list);
    }

    const displayedRoleIds = new Set(roles.map((role: any) => role.id));
    const roleCapabilityCounts = new Map<string, number>();
    for (const row of roleCaps) {
      if (displayedRoleIds.has(row.role_id)) {
        roleCapabilityCounts.set(row.role_id, (roleCapabilityCounts.get(row.role_id) || 0) + 1);
      }
    }

    const versionByEntityId = new Map(
      publishedLevelVersions.map((version: any) => [version.entity_id, version]),
    );
    const assetStatus = (latestCatalogRes.data as any)?.snapshot_data?.assetStatus || "none";
    const assetManifestCount =
      (latestCatalogRes.data as any)?.snapshot_data?.assetManifest?.length || 0;
    const assetsReady = assetStatus === "staged" || assetStatus === "none";
    const isPublished = (status: unknown) => String(status || "").toLowerCase() === "published";
    const latestPublishedAt =
      (latestCatalogRes.data as any)?.published_at ||
      (latestCatalogRes.data as any)?.created_at ||
      null;
    const needsReviewCount = ((needsReviewRes.data || []) as any[]).filter((version) => {
      if (!latestPublishedAt) return true;
      return new Date(version.created_at).getTime() > new Date(latestPublishedAt).getTime();
    }).length;

    const publishedCount = levels.filter((level: any) => isPublished(level.status)).length;
    const courses = levels.map((level) => {
      const version = versionByEntityId.get(level.id);
      return {
        id: level.id,
        rowKey: `course:${level.id}`,
        sourceRecordId: level.id,
        sourceType: "course",
        capability_id: level.capability_id,
        course_code: level.level_code,
        course_name: formatText(level.title, level.level_code),
        lifecycle_status: level.is_active ? "ACTIVE" : "RETIRED",
        publishedVersionNo: version?.version_no ?? level.version_no ?? null,
        assetStatus,
        assetManifestCount,
        assignableStatus:
          isPublished(level.status) && assetsReady ? "ASSIGNABLE" : "PENDING_ASSET_READINESS",
      };
    });
    const assignableCoursesCount = courses.filter(
      (course) => course.assignableStatus === "ASSIGNABLE",
    ).length;

    return HttpResponse.json({
      success: true,
      summary: {
        capabilitiesCount: uploadedCapabilityIds.length,
        rolesCount: uploadedRoleIds.length,
        coursesLogicalCount: levelsCountRes.count ?? levels.length,
        publishedCoursesCount: publishedCount,
        assignableCoursesCount,
        needsReviewCount,
        optionalVersionsCount: levelVersionsCountRes.count || 0,
      },
      capabilities: capabilities.map((capability: any) => {
        const actualCourseCount = levelCountsByCapability.get(capability.id) || 0;
        const rows = levelsByCapability.get(capability.id) || [];
        const levelsBreakdown = [1, 2, 3, 4, 5].map((levelNo) => {
          const match = rows.find((row) => row.levelNo === levelNo);
          return {
            levelNo,
            label: `L${levelNo}`,
            status:
              match && isPublished(match.status) ? "PUBLISHED" : match ? "INGESTED" : "PENDING",
          };
        });
        const completedLevelsCount = levelsBreakdown.filter((l) => l.status !== "PENDING").length;
        return {
          ...capability,
          actualCourseCount,
          plannedCourseCount: null,
          coverageStatus: actualCourseCount > 0 ? "COMPLETE" : "NONE",
          levelsBreakdown,
          completedLevelsCount,
          totalLevelsCount: 5,
        };
      }),
      roles: roles.map((role: any) => ({
        id: role.id,
        code: role.role_name || role.id,
        name: role.role_name,
        activeCapabilityCount: roleCapabilityCounts.get(role.id) || 0,
      })),
      courses,
    });
  }

  async function handleSummaryView(): Promise<HttpResponse> {
    const [levelsRes, versionsRes, reviewRes, latestCatalogRes] = await Promise.all([
      supabaseLTE
        .from("levels")
        .select("id, capability_id, status", { count: "exact" })
        .eq("is_active", true),
      supabaseLTE
        .from("catalog_versions")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "level"),
      supabaseLTE
        .from("catalog_versions")
        .select("id, created_at")
        .eq("entity_type", "catalog")
        .in("status", ["DRAFT", "VALIDATED"]),
      supabaseLTE
        .from("catalog_versions")
        .select("snapshot_data, published_at, created_at")
        .eq("entity_type", "catalog")
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    throwIfAnyError([levelsRes, versionsRes, reviewRes, latestCatalogRes]);
    const levels = (levelsRes.data || []) as any[];
    const isPublished = (status: unknown) => String(status || "").toLowerCase() === "published";
    const publishedCount = levels.filter((level: any) => isPublished(level.status)).length;
    const scopedCapIds = Array.from(
      new Set(levels.map((level: any) => level.capability_id).filter(Boolean)),
    );
    const seqRes =
      scopedCapIds.length > 0
        ? await supabaseLTE
            .from("role_capability_sequence")
            .select("role_id")
            .in("capability_id", scopedCapIds)
        : ({ data: [], error: null } as any);
    throwIfAnyError([seqRes]);
    const scopedRoleCount = new Set(
      ((seqRes.data || []) as any[]).map((row: any) => row.role_id).filter(Boolean),
    ).size;
    const assetStatus = (latestCatalogRes.data as any)?.snapshot_data?.assetStatus || "none";
    const assetsReady = assetStatus === "staged" || assetStatus === "none";
    const latestPublishedAt =
      (latestCatalogRes.data as any)?.published_at ||
      (latestCatalogRes.data as any)?.created_at ||
      null;
    const needsReviewCount = ((reviewRes.data || []) as any[]).filter((version) => {
      if (!latestPublishedAt) return true;
      return new Date(version.created_at).getTime() > new Date(latestPublishedAt).getTime();
    }).length;

    return HttpResponse.json({
      success: true,
      summary: {
        capabilitiesCount: scopedCapIds.length,
        rolesCount: scopedRoleCount,
        coursesLogicalCount: levelsRes.count ?? levels.length,
        publishedCoursesCount: publishedCount,
        assignableCoursesCount: assetsReady ? publishedCount : 0,
        needsReviewCount,
        optionalVersionsCount: versionsRes.count || 0,
      },
    });
  }

  async function handleCapabilitiesView(searchParams: URLSearchParams): Promise<HttpResponse> {
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "25"), 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const levelsResult = await supabaseLTE
      .from("levels")
      .select("id, capability_id, level_code, status")
      .eq("is_active", true);
    throwIfAnyError([levelsResult]);
    const scopedCapabilityIds = Array.from(
      new Set(
        ((levelsResult.data || []) as any[])
          .map((level: any) => level.capability_id)
          .filter(Boolean),
      ),
    );
    if (scopedCapabilityIds.length === 0) {
      return HttpResponse.json({
        success: true,
        capabilities: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    const capsResult = await supabaseLTE
      .from("capabilities")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .in("id", scopedCapabilityIds)
      .order("code", { ascending: true })
      .range(from, to);

    throwIfAnyError([capsResult]);

    const actualMapCount = new Map<string, number>();
    const levelsByCapability = new Map<
      string,
      Array<{ levelNo: number | null; status: unknown }>
    >();
    (levelsResult.data || []).forEach((level: any) => {
      actualMapCount.set(level.capability_id, (actualMapCount.get(level.capability_id) || 0) + 1);
      const list = levelsByCapability.get(level.capability_id) || [];
      list.push({ levelNo: getLevelNoFromCode(level.level_code), status: level.status });
      levelsByCapability.set(level.capability_id, list);
    });
    const isPublishedRow = (status: unknown) => String(status || "").toLowerCase() === "published";

    return HttpResponse.json({
      success: true,
      capabilities: (capsResult.data || []).map((capability: any) => {
        const actualCourseCount = actualMapCount.get(capability.id) || 0;
        const rows = levelsByCapability.get(capability.id) || [];
        const levelsBreakdown = [1, 2, 3, 4, 5].map((levelNo) => {
          const match = rows.find((row) => row.levelNo === levelNo);
          return {
            levelNo,
            label: `L${levelNo}`,
            status:
              match && isPublishedRow(match.status) ? "PUBLISHED" : match ? "INGESTED" : "PENDING",
          };
        });
        return {
          id: capability.id,
          code: capability.code,
          name: capability.name || capability.code,
          actualCourseCount,
          plannedCourseCount: null,
          coverageStatus: actualCourseCount > 0 ? "COMPLETE" : "NONE",
          levelsBreakdown,
          completedLevelsCount: levelsBreakdown.filter((l) => l.status !== "PENDING").length,
          totalLevelsCount: 5,
        };
      }),
      pagination: {
        page,
        limit,
        total: capsResult.count || 0,
        totalPages: Math.max(Math.ceil((capsResult.count || 0) / limit), 1),
        hasNextPage: to + 1 < (capsResult.count || 0),
        hasPreviousPage: page > 1,
      },
    });
  }

  async function handleCapabilityDetailView(id: string | null): Promise<HttpResponse> {
    if (!id)
      return HttpResponse.json(
        { success: false, error: "Capability ID is required" },
        { status: 400 },
      );

    const [capRes, levelsRes] = await Promise.all([
      supabaseLTE.from("capabilities").select("*").eq("id", id).single(),
      supabaseLTE
        .from("levels")
        .select("*")
        .eq("capability_id", id)
        .eq("is_active", true)
        .order("level_code"),
    ]);

    if (capRes.error || !capRes.data)
      return HttpResponse.json({ success: false, error: "Capability not found" }, { status: 404 });
    if (levelsRes.error)
      throw new Error(`Failed to fetch capability levels: ${levelsRes.error.message}`);

    return HttpResponse.json({
      success: true,
      capability: capRes.data,
      actualMappedCourses: levelsRes.data || [],
      plannedCourses: [],
    });
  }

  async function handleRolesView(searchParams: URLSearchParams): Promise<HttpResponse> {
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "25"), 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Scope roles to those mapped to uploaded capabilities only.
    const levelsForRoles = await supabaseLTE
      .from("levels")
      .select("capability_id")
      .eq("is_active", true);
    throwIfAnyError([levelsForRoles]);
    const scopedCapIds = Array.from(
      new Set(
        ((levelsForRoles.data || []) as any[])
          .map((level: any) => level.capability_id)
          .filter(Boolean),
      ),
    );
    const seqForRoles =
      scopedCapIds.length > 0
        ? await supabaseLTE
            .from("role_capability_sequence")
            .select("role_id")
            .in("capability_id", scopedCapIds)
        : ({ data: [], error: null } as any);
    throwIfAnyError([seqForRoles]);
    const scopedRoleIds = Array.from(
      new Set(((seqForRoles.data || []) as any[]).map((row: any) => row.role_id).filter(Boolean)),
    );
    if (scopedRoleIds.length === 0) {
      return HttpResponse.json({
        success: true,
        roles: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    const rolesResult = await supabaseLTE
      .from("roles")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .in("id", scopedRoleIds)
      .order("role_name", { ascending: true })
      .range(from, to);

    throwIfAnyError([rolesResult]);

    const roles = rolesResult.data || [];
    const roleIds = roles.map((role: any) => role.id).filter(Boolean);
    const roleCapsResult =
      roleIds.length > 0
        ? await supabaseLTE
            .from("role_capability_sequence")
            .select("role_id")
            .in("role_id", roleIds)
            .in("capability_id", scopedCapIds)
        : { data: [], error: null };

    throwIfAnyError([roleCapsResult]);

    const capCount = new Map<string, number>();
    (roleCapsResult.data || []).forEach((row: any) => {
      capCount.set(row.role_id, (capCount.get(row.role_id) || 0) + 1);
    });
    const total = rolesResult.count || 0;

    return HttpResponse.json({
      success: true,
      roles: roles.map((role: any) => ({
        id: role.id,
        code: role.role_name || role.id,
        name: role.role_name,
        activeCapabilityCount: capCount.get(role.id) || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNextPage: to + 1 < total,
        hasPreviousPage: page > 1,
      },
    });
  }

  async function handleRoleDetailView(id: string | null): Promise<HttpResponse> {
    if (!id)
      return HttpResponse.json({ success: false, error: "Role ID is required" }, { status: 400 });

    const [roleRes, capsRes] = await Promise.all([
      supabaseLTE.from("roles").select("*").eq("id", id).single(),
      supabaseLTE.from("role_capability_sequence").select("*, capabilities(*)").eq("role_id", id),
    ]);

    if (roleRes.error || !roleRes.data)
      return HttpResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    if (capsRes.error)
      throw new Error(`Failed to fetch role capabilities: ${capsRes.error.message}`);

    return HttpResponse.json({
      success: true,
      role: roleRes.data,
      mappedCapabilities: capsRes.data || [],
    });
  }

  async function handleCoursesView(): Promise<HttpResponse> {
    const [{ data, error }, latestVersionRes] = await Promise.all([
      supabaseLTE
        .from("levels")
        .select("*")
        .eq("is_active", true)
        .order("level_code", { ascending: true }),
      supabaseLTE
        .from("catalog_versions")
        .select("id, snapshot_data, published_at, status, entity_type")
        .eq("entity_type", "catalog")
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (error) throw new Error(`Failed to fetch levels: ${error.message}`);
    if (latestVersionRes.error)
      throw new Error(
        `Failed to fetch published catalog manifest: ${latestVersionRes.error.message}`,
      );

    const assetStatus = latestVersionRes.data?.snapshot_data?.assetStatus || "none";
    const assetsReady = assetStatus === "staged" || assetStatus === "none";
    const isPublished = (status: unknown) => String(status || "").toLowerCase() === "published";

    return HttpResponse.json({
      success: true,
      courses: (data || []).map((level) => ({
        rowKey: `course:${level.id}`,
        sourceRecordId: level.id,
        sourceType: "course",
        capability_id: level.capability_id,
        id: level.id,
        course_code: level.level_code,
        course_name: formatText(level.title, level.level_code),
        lifecycle_status: level.is_active ? "ACTIVE" : "RETIRED",
        current_published_version_id: null,
        current_assignable_version_id: null,
        publishedVersionNo: level.version_no || null,
        assetStatus,
        assetManifestCount: latestVersionRes.data?.snapshot_data?.assetManifest?.length || 0,
        assignableStatus:
          isPublished(level.status) && assetsReady ? "ASSIGNABLE" : "PENDING_ASSET_READINESS",
      })),
    });
  }

  async function handleCourseDetailView(id: string | null): Promise<HttpResponse> {
    if (!id)
      return HttpResponse.json({ success: false, error: "Course ID is required" }, { status: 400 });

    const [levelRes, versionsRes, latestCatalogRes] = await Promise.all([
      supabaseLTE.from("levels").select("*").eq("id", id).single(),
      supabaseLTE
        .from("catalog_versions")
        .select("*")
        .eq("entity_type", "level")
        .eq("entity_id", id)
        .order("version_no", { ascending: false }),
      supabaseLTE
        .from("catalog_versions")
        .select("id, snapshot_data, published_at, status, entity_type")
        .eq("entity_type", "catalog")
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (levelRes.error || !levelRes.data)
      return HttpResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    if (versionsRes.error)
      throw new Error(`Failed to fetch catalog versions: ${versionsRes.error.message}`);
    if (latestCatalogRes.error)
      throw new Error(
        `Failed to fetch published catalog manifest: ${latestCatalogRes.error.message}`,
      );

    const level = levelRes.data;
    const [capabilityRes, roleCapsRes] = await Promise.all([
      level.capability_id
        ? supabaseLTE
            .from("capabilities")
            .select("id, code, name")
            .eq("id", level.capability_id)
            .maybeSingle()
        : { data: null, error: null },
      level.capability_id
        ? supabaseLTE
            .from("role_capability_sequence")
            .select("role_id")
            .eq("capability_id", level.capability_id)
        : { data: [], error: null },
    ]);

    throwIfAnyError([capabilityRes, roleCapsRes]);

    const mappedRoleIds = Array.from(
      new Set((roleCapsRes.data || []).map((row: any) => row.role_id).filter(Boolean)),
    );
    const mappedRolesRes =
      mappedRoleIds.length > 0
        ? await supabaseLTE
            .from("roles")
            .select("id, role_name")
            .in("id", mappedRoleIds)
            .is("deleted_at", null)
            .order("role_name", { ascending: true })
        : { data: [], error: null };

    throwIfAnyError([mappedRolesRes]);

    return HttpResponse.json({
      success: true,
      course: {
        ...level,
        current_published_version_id:
          (versionsRes.data || []).find((version: any) => version.status === "PUBLISHED")?.id ||
          null,
      },
      versions: versionsRes.data || [],
      mappedCapabilities: capabilityRes.data
        ? [
            {
              id: capabilityRes.data.id,
              code: capabilityRes.data.code,
              name: capabilityRes.data.name || capabilityRes.data.code,
              actualCourseCount: 1,
              plannedCourseCount: null,
              coverageStatus: "MAPPED",
            },
          ]
        : [],
      mappedRoles: (mappedRolesRes.data || []).map((role: any) => ({
        id: role.id,
        code: role.role_name || role.id,
        name: role.role_name,
        activeCapabilityCount: 1,
      })),
      assetStatus: latestCatalogRes.data?.snapshot_data?.assetStatus || "none",
      sourceAssets: latestCatalogRes.data?.snapshot_data?.assetManifest || [],
    });
  }

  function throwIfAnyError(results: Array<{ error: any }>): void {
    const failures = results
      .map((result, index) => (result.error ? `query ${index + 1}: ${result.error.message}` : null))
      .filter(Boolean);
    if (failures.length > 0)
      throw new Error(`Failed to load catalog workspace: ${failures.join("; ")}`);
  }
  return { GET };
}
