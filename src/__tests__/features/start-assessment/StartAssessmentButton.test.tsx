import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StartAssessmentButton } from "@/features/start-assessment";
import type * as config from "@/shared/config";

vi.mock("@/shared/config", async () => {
  const actual = await vi.importActual<typeof config>("@/shared/config");
  return {
    ...actual,
    getSkillpassportUrl: () => "https://skillpassport.test",
  };
});

describe("StartAssessmentButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    vi.stubGlobal("location", {
      origin: "http://localhost:8080",
      href: "",
    });
  });

  it("renders button with default text", () => {
    render(<StartAssessmentButton />);
    expect(screen.getByRole("button")).toHaveTextContent("Take Assessment");
  });

  it("renders button with custom children text", () => {
    render(<StartAssessmentButton>Custom Start</StartAssessmentButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Custom Start");
  });

  it("redirects to SkillPassport assessment page on click with correct query params", () => {
    render(<StartAssessmentButton />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    const expectedRedirect =
      "https://skillpassport.test/assessment?source=lte&target_app=lte&redirect_uri=" +
      encodeURIComponent("http://localhost:8080/my-courses");

    expect(window.location.href).toBe(expectedRedirect);
  });
});
