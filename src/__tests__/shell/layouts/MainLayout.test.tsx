import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MainLayout } from "@/app/layouts/MainLayout";

/**
 * MainLayout is now a pure pass-through (<Outlet />) — auth initialization and
 * SSO callback exchange are handled by AuthInitializer (app/providers/AuthInitializer).
 * These tests verify it renders child routes without any auth-related behavior.
 */
describe("MainLayout", () => {
  it("renders child routes via Outlet", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/home" element={<div data-testid="child-route">Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("child-route")).toBeInTheDocument();
  });

  it("does not render any loading indicator", () => {
    const { container } = render(
      <MemoryRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<div>content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    expect(container.querySelector("[data-testid='application-loader']")).not.toBeInTheDocument();
  });
});
