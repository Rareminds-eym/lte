import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDashboardData, MOCK_DASHBOARD_DATA } from "@/entities/dashboard";

vi.mock("@/shared/api", () => ({
  authClient: {
    request: vi.fn(),
    subscribe: vi.fn(),
    initialize: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
  },
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/shared/api";

describe("dashboardApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("overrides the mock XP with the real totals from the API", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 430, xpThisWeek: 75, todayXp: 20 })
      .mockResolvedValueOnce({ success: true, streakDays: 4 })
      .mockResolvedValueOnce({ success: true, data: null, state: "active" });
    const data = await fetchDashboardData();

    expect(data.careerTarget.xp).toBe(430);
    expect(data.careerTarget.xpThisWeek).toBe(75);
    expect(data.priorities.currentXp).toBe(20);
    expect(data.careerTarget).toMatchObject({
      title: MOCK_DASHBOARD_DATA.careerTarget.title,
      streakDays: 4,
    });
    const calledPath = (vi.mocked(apiFetch).mock.calls[0]?.[0] as string) ?? "";
    expect(calledPath).toContain("/api/v1/dashboard/xp?since=");
    const params = new URL(calledPath, "http://localhost").searchParams;
    expect(Number.isNaN(Date.parse(params.get("since") ?? ""))).toBe(false);
    expect(calledPath).toContain("todaySince=");
    expect(Number.isNaN(Date.parse(params.get("todaySince") ?? ""))).toBe(false);
  });

  it("replaces the mock journey with the real current module", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 0, xpThisWeek: 0, todayXp: 0 })
      .mockResolvedValueOnce({ success: true, streakDays: 0 })
      .mockResolvedValueOnce({
        success: true,
        state: "active",
        data: {
          levelId: "lvl-1",
          capabilityCode: "CAP037",
          capability: "Support exchange handoffs",
          title: "Before You Trust the Answer",
          moduleInfo: "Module 1 of 2",
          output: "Root-cause analysis artifact",
          whyItMatters: "Northstar Retail needs a safe review handoff.",
          progressPercentage: 34,
          completedCount: 0,
          inProgressCount: 1,
          remainingCount: 1,
          moduleNo: 0,
        },
      });
    const data = await fetchDashboardData();

    expect(data.journey?.title).toBe("Before You Trust the Answer");
    expect(data.journey?.moduleInfo).toBe("Module 1 of 2");
    expect(data.journey?.levelId).toBe("lvl-1");
    expect(data.journey?.moduleNo).toBe(0);
    expect(data.journeyState).toBe("active");
    expect((vi.mocked(apiFetch).mock.calls[1]?.[0] as string) ?? "").toBe(
      "/api/v1/dashboard/streak",
    );
    expect((vi.mocked(apiFetch).mock.calls[2]?.[0] as string) ?? "").toBe(
      "/api/v1/dashboard/journey",
    );
  });

  it("clears the journey and carries the state when the API returns null", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 0, xpThisWeek: 0, todayXp: 0 })
      .mockResolvedValueOnce({ success: true, streakDays: 0 })
      .mockResolvedValueOnce({ success: true, data: null, state: "completed" });
    const data = await fetchDashboardData();
    expect(data.journey).toBeNull();
    expect(data.journeyState).toBe("completed");
  });

  it("zeroes XP and clears the journey when the API call fails", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("network down"));
    const data = await fetchDashboardData();
    expect(data.careerTarget.xp).toBe(0);
    expect(data.careerTarget.xpThisWeek).toBe(0);
    expect(data.priorities.currentXp).toBe(0);
    expect(data.journey).toBeNull();
  });

  it("returns a well-formed payload with all dashboard sections", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 0, xpThisWeek: 0, todayXp: 0 })
      .mockResolvedValueOnce({ success: true, streakDays: 0 })
      .mockResolvedValueOnce({ success: true, data: null, state: "active" });
    const data = await fetchDashboardData();

    expect(data.careerTarget.readinessPercentage).toBeGreaterThanOrEqual(0);
    expect(data.careerTarget.readinessPercentage).toBeLessThanOrEqual(100);

    expect(data.journey).toBeNull();
    expect(data.priorities.items.length).toBeGreaterThan(0);
    expect(data.capabilityGaps.length).toBeGreaterThan(0);
    expect(data.upcomingFeedback.upcoming.length).toBeGreaterThan(0);
    expect(data.upcomingFeedback.recentFeedback.length).toBeGreaterThan(0);
    expect(data.careerPaths.tracks).toHaveLength(0);
    expect(data.achievements.items).toHaveLength(data.achievements.shownCount);
  });

  it("keeps priority item types within the allowed union", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 0, xpThisWeek: 0, todayXp: 0 })
      .mockResolvedValueOnce({ success: true, streakDays: 0 })
      .mockResolvedValueOnce({ success: true, data: null, state: "active" });
    const data = await fetchDashboardData();
    const allowed = new Set(["green", "purple", "amber"]);
    for (const item of data.priorities.items) {
      expect(allowed.has(item.type)).toBe(true);
    }
  });
});
