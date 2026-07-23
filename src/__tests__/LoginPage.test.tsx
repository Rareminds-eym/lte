import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/pages/LoginPage";

beforeEach(() => {
  vi.stubEnv("VITE_SKILLPASSPORT_URL", "https://sso.example.com");
  vi.spyOn(window, "location", "get").mockReturnValue({
    ...window.location,
    origin: "http://localhost:3000",
    href: "",
  });
  document.title = "";
});

describe("LoginPage", () => {
  it("sets document title on mount", () => {
    render(<LoginPage />);
    expect(document.title).toBe("Sign In | LTE");
  });

  it("renders heading and description", () => {
    render(<LoginPage />);
    expect(screen.getByText("Sign In to LTE")).toBeInTheDocument();
    expect(
      screen.getByText("Please sign in with your SkillPassport account to access LTE."),
    ).toBeInTheDocument();
  });

  it("renders sign in button", () => {
    render(<LoginPage />);
    expect(screen.getByText("Sign In with SkillPassport")).toBeInTheDocument();
  });

  it("redirects to SkillPassport SSO on button click", () => {
    render(<LoginPage />);
    const button = screen.getByText("Sign In with SkillPassport");
    fireEvent.click(button);
    const expectedUrl =
      "https://sso.example.com/login?target_app=lte&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback";
    expect(window.location.href).toBe(expectedUrl);
  });

  it("renders with correct layout classes", () => {
    const { container } = render(<LoginPage />);
    const outerDiv = container.querySelector(".grid");
    expect(outerDiv).toBeInTheDocument();
  });
});
