import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MainLayout } from "@/app/layouts/MainLayout";
import { useAuthStore } from "@/app/store";

describe("MainLayout", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      initialized: true,
      loading: false,
      error: null,
      initialize: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("calls initialize on mount when not authenticated and not initialized", () => {
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      initialized: false,
      isAuthenticated: false,
      initialize: initializeSpy,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });
});
