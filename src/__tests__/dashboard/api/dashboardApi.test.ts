import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDashboardData, MOCK_DASHBOARD_DATA } from "@/entities/dashboard";

vi.mock("@/shared/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/shared/api";

describe("dashboardApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("overrides the mock XP with the real totals from the API", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      success: true,
      totalXp: 430,
      xpThisWeek: 75,
      todayXp: 20,
    });
    const data = await fetchDashboardData();

    expect(data.careerTarget.xp).toBe(430);
    expect(data.careerTarget.xpThisWeek).toBe(75);
    expect(data.priorities.currentXp).toBe(20);
    expect(data.careerTarget).toMatchObject({
      title: MOCK_DASHBOARD_DATA.careerTarget.title,
      streakDays: MOCK_DASHBOARD_DATA.careerTarget.streakDays,
    });
    const calledPath = (vi.mocked(apiFetch).mock.calls[0]?.[0] as string) ?? "";
    expect(calledPath).toContain("/api/v1/dashboard/xp?since=");
    const params = new URL(calledPath, "http://localhost").searchParams;
    expect(Number.isNaN(Date.parse(params.get("since") ?? ""))).toBe(false);
    expect(calledPath).toContain("todaySince=");
    expect(Number.isNaN(Date.parse(params.get("todaySince") ?? ""))).toBe(false);
  });

  it("falls back to the mock XP when the API call fails", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("network down"));
    const data = await fetchDashboardData();
    expect(data).toEqual(MOCK_DASHBOARD_DATA);
  });

  it("returns a well-formed payload with all dashboard sections", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      success: true,
      totalXp: 0,
      xpThisWeek: 0,
      todayXp: 0,
    });
    const data = await fetchDashboardData();

    expect(data.careerTarget.readinessPercentage).toBeGreaterThanOrEqual(0);
    expect(data.careerTarget.readinessPercentage).toBeLessThanOrEqual(100);

    expect(data.journey.progressPercentage).toBeGreaterThanOrEqual(0);
    expect(data.priorities.items.length).toBeGreaterThan(0);
    expect(data.capabilityGaps.length).toBeGreaterThan(0);
    expect(data.upcomingFeedback.upcoming.length).toBeGreaterThan(0);
    expect(data.upcomingFeedback.recentFeedback.length).toBeGreaterThan(0);
    expect(data.careerPaths.tracks.length).toBeGreaterThan(0);
    expect(data.achievements.items).toHaveLength(data.achievements.shownCount);
  });

  it("keeps priority item types within the allowed union", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      success: true,
      totalXp: 0,
      xpThisWeek: 0,
      todayXp: 0,
    });
    const data = await fetchDashboardData();
    const allowed = new Set(["green", "purple", "amber"]);
    for (const item of data.priorities.items) {
      expect(allowed.has(item.type)).toBe(true);
    }
  });
});
