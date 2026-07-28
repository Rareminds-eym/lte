import { describe, expect, it } from "vitest";
import { fetchDashboardData, MOCK_DASHBOARD_DATA } from "@/entities/dashboard";

describe("dashboardApi", () => {
  it("resolves the dashboard data payload", async () => {
    const data = await fetchDashboardData();
    expect(data).toEqual(MOCK_DASHBOARD_DATA);
  });

  it("returns a well-formed payload with all dashboard sections", async () => {
    const data = await fetchDashboardData();

    expect(data.careerTarget.title).toBe("Backend Engineer");
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
    const data = await fetchDashboardData();
    const allowed = new Set(["green", "purple", "amber"]);
    for (const item of data.priorities.items) {
      expect(allowed.has(item.type)).toBe(true);
    }
  });
});
