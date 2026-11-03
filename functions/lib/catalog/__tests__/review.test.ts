/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogDependencies } from "../dependencies";
import { createHandlers } from "../review";

const authenticateSSORequest = vi.fn();
const supabaseLTE = { from: vi.fn() };
const { GET } = createHandlers({
  db: supabaseLTE,
  authenticate: authenticateSSORequest,
} as unknown as CatalogDependencies);
class NextRequest extends Request {
  get nextUrl() {
    return new URL(this.url);
  }
}

describe("GET /api/admin/lte/review", () => {
  const mockUser = {
    userId: "test-user-123",
    role: "admin",
    email: "admin@test.com",
  };

  const mockSnapshot = {
    uploadId: "version-456",
    sourceName: "test-course.xlsx",
    snapshotHash: "hash-123",
    status: "validated",
    validationReport: {
      verified: true,
      totalRowsParsed: 100,
      tableSummaries: [],
      validationItems: [],
      errors: [],
      warnings: [],
    },
    courseMetadata: {
      courseTitle: "Introduction to Web Development",
      courseCode: "WEB-101",
      domain: "Technology",
      capabilityCode: "WEB_DEV",
      capabilityLevel: "Level 1",
      instructorLead: "John Smith",
      courseSummary: "Learn the fundamentals of web development",
      problemStatement: "Build modern web applications",
      capstoneTitle: "Portfolio Website",
    },
    modules: [
      {
        index: 0,
        title: "HTML Basics",
        subtitle: "Introduction to HTML",
        completionPercentage: 0,
        status: "not_started",
        contextDescription: "Learn HTML fundamentals",
        stages: [
          {
            type: "engage",
            title: "What is HTML?",
            subtitle: "Understanding markup",
          },
        ],
        artifactPractices: ["Build a simple webpage"],
      },
    ],
  };

  const mockVersion = {
    id: "version-456",
    status: "VALIDATED",
    created_by: "test-user-123",
    created_at: "2026-08-18T10:00:00Z",
    snapshot_hash: "hash-123",
    snapshot_data: mockSnapshot,
  };

  function mockCatalogVersionQuery(result: {
    data: typeof mockVersion | null;
    error: { message: string; code?: string } | null;
  }) {
    const query: Record<string, any> = {};
    query["select"] = vi.fn(() => query);
    query["eq"] = vi.fn(() => query);
    query["order"] = vi.fn(() => query);
    query["limit"] = vi.fn(() => query);
    query["maybeSingle"] = vi.fn().mockResolvedValue(result);

    vi.mocked(supabaseLTE.from).mockReturnValue(query as any);
    return query;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: mockUser,
      error: null,
    });

    mockCatalogVersionQuery({
      data: mockVersion,
      error: null,
    });
  });

  it("rejects unauthorized requests", async () => {
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/lte/review?uploadId=version-456"),
    );

    expect(response.status).toBe(401);
  });

  it("loads the latest catalog version when uploadId is omitted", async () => {
    const query = mockCatalogVersionQuery({
      data: mockVersion,
      error: null,
    });

    const response = await GET(new NextRequest("http://localhost/api/admin/lte/review"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.uploadId).toBe("version-456");
    expect(query["order"]).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query["limit"]).toHaveBeenCalledWith(1);
  });

  it("returns 404 when the catalog version does not exist", async () => {
    mockCatalogVersionQuery({
      data: null,
      error: { message: "Not found", code: "PGRST116" },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/lte/review?uploadId=missing-id"),
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain("not found");
  });

  it("rejects a non-admin user reading another user catalog version", async () => {
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: {
        userId: "test-user-123",
        role: "viewer",
        email: "viewer@test.com",
      },
      error: null,
    });

    mockCatalogVersionQuery({
      data: {
        ...mockVersion,
        created_by: "different-user-456",
      },
      error: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/lte/review?uploadId=version-456"),
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unauthorized");
  });

  it("returns the reviewed snapshot from catalog_versions", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/lte/review?uploadId=version-456"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.uploadId).toBe("version-456");
    expect(data.sourceName).toBe("test-course.xlsx");
    expect(data.status).toBe("validated");
    expect(data.reviewedSnapshotHash).toBe("hash-123");
    expect(data.courseSpecification).toEqual({
      courseTitle: "Introduction to Web Development",
      courseCode: "WEB-101",
      domain: "Technology",
      capabilityCode: "WEB_DEV",
      capabilityLevel: "Level 1",
      instructorLead: "John Smith",
      courseSummary: "Learn the fundamentals of web development",
      problemStatement: "Build modern web applications",
      capstoneArtifactTitle: "Portfolio Website",
    });
    expect(data.modules).toHaveLength(1);
    expect(supabaseLTE.from).toHaveBeenCalledWith("catalog_versions");
  });
});
