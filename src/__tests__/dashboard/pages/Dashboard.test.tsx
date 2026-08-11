import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { Dashboard } from "@/pages/dashboard";

vi.mock("@/shared/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/shared/api";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("Dashboard Page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useLearningPathStore.setState({
      activeTrack: {
        learningTrackId: "lt-1",
        track: "Backend Engineering",
        fit: "High",
        matchScore: 46,
        whyItFits: "This role aligns...",
        roles: [
          {
            roleId: "role-1",
            roleName: "Backend Engineer",
            learningPathId: "lp-1",
            readinessScore: 45,
            status: "in_progress",
            updatedAt: null,
          },
        ],
        tracks: [
          {
            id: "tr-1",
            title: "Backend Engineering",
            matchPercentage: 46,
            isSelected: true,
            fit: "High",
          },
          {
            id: "tr-2",
            title: "Full-Stack Development",
            matchPercentage: 25,
            isSelected: false,
            fit: "Medium",
          },
          {
            id: "tr-3",
            title: "DevOps & Platform Engineering",
            matchPercentage: 0,
            isSelected: false,
            fit: "Explore",
          },
        ],
      },
      needsAssessment: false,
      activeLearningPathLoading: false,
    });
    vi.mocked(apiFetch).mockImplementation((url: string) => {
      if (url.includes("/api/v1/dashboard/xp")) {
        return Promise.resolve({
          success: true,
          totalXp: 1240,
          xpThisWeek: 120,
          todayXp: 20,
        });
      }
      if (url.includes("/api/v1/dashboard/streak")) {
        return Promise.resolve({
          success: true,
          streakDays: 7,
        });
      }
      if (url.includes("/api/v1/dashboard/journey")) {
        return Promise.resolve({
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
      }
      return Promise.reject(new Error(`Unhandled apiFetch: ${url}`));
    });
  });

  it("renders full dashboard widgets when data resolves", async () => {
    const queryClient = createTestQueryClient();
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    });

    expect(screen.getByText("Before You Trust the Answer")).toBeInTheDocument();
    expect(screen.getByText("Today's Priorities")).toBeInTheDocument();
    expect(screen.getByText("Capability Gap Map")).toBeInTheDocument();
    expect(screen.getByText("Upcoming & Feedback")).toBeInTheDocument();
    expect(screen.getByText("Recommended Career Paths")).toBeInTheDocument();
    expect(screen.getByText("Achievements")).toBeInTheDocument();
  });

  it("renders XpRewardModal when there is an unshown daily login event", async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.mocked(apiFetch).mockImplementation((url: string) => {
      if (url.includes("/api/v1/dashboard/xp")) {
        return Promise.resolve({
          success: true,
          totalXp: 1240,
          xpThisWeek: 120,
          todayXp: 20,
          todayEvents: [
            {
              id: "evt-login-123",
              event_type: "daily_login",
              xp_amount: 1,
              metadata: { login_date: "2026-08-07" },
            },
          ],
        });
      }
      if (url.includes("/api/v1/dashboard/streak")) {
        return Promise.resolve({
          success: true,
          streakDays: 7,
        });
      }
      if (url.includes("/api/v1/dashboard/journey")) {
        return Promise.resolve({
          success: true,
          state: "active",
          data: null,
        });
      }
      return Promise.reject(new Error(`Unhandled apiFetch: ${url}`));
    });

    const queryClient = createTestQueryClient();
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Verify XpRewardModal is rendered with +1 XP Earned!
    await waitFor(() => {
      expect(screen.getByText("+1")).toBeInTheDocument();
    });
    expect(screen.getByText("XP Earned!")).toBeInTheDocument();
    expect(
      screen.getByText(/You earned engagement XP for your daily active login/),
    ).toBeInTheDocument();

    // Click continue button to close
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    continueBtn.click();

    // Verify it is closed and stored in localStorage
    await waitFor(() => {
      expect(screen.queryByText("+1")).not.toBeInTheDocument();
    });
    expect(JSON.parse(localStorage.getItem("lte-shown-xp-event-ids") ?? "[]")).toContain(
      "evt-login-123",
    );
  });
});
