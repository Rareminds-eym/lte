import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 1240, xpThisWeek: 120, todayXp: 20 })
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
});
