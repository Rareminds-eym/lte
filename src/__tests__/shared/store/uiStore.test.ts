import { describe, expect, it } from "vitest";
import { useUIStore } from "@/shared/store";

describe("uiStore", () => {
  it("initializes with sidebarCollapsed false", () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it("toggles sidebarCollapsed from false to true", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it("toggles sidebarCollapsed from true to false", () => {
    useUIStore.setState({ sidebarCollapsed: true });
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });
});
