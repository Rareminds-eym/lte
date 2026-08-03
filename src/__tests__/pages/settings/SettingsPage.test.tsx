import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAccountAction,
  useChangePassword,
  useSettingsProfile,
  useUpdateProfile,
} from "@/entities/settings";
import { SettingsPage } from "@/pages/settings";
import { toast } from "@/shared/ui";

vi.mock("@/entities/settings", () => ({
  useSettingsProfile: vi.fn(),
  useUpdateProfile: vi.fn(),
  useChangePassword: vi.fn(),
  useAccountAction: vi.fn(),
}));

vi.mock("@/shared/ui", async () => {
  const actual = await vi.importActual("@/shared/ui");
  return {
    ...actual,
    toast: vi.fn(),
  };
});

describe("SettingsPage", () => {
  const mockProfile = {
    fullName: "R Amrutha",
    firstName: "R",
    lastName: "Amrutha",
    email: "amrutha.r@seacollege.edu.in",
    phone: "+91 98765 43210",
    program: "B.Tech Engineering",
    gradeSemester: "UG · Sem 4",
    learnerId: "LRN-RAM26-00001138",
    college: "SEA College",
    section: "Sem 4",
    skillPassportVerified: true,
    twoFactorEnabled: false,
    loginAlertsEnabled: false,
    profileStrength: 72,
  };

  const mockRefetch = vi.fn();
  const mockUpdateMutate = vi.fn();
  const mockPasswordMutate = vi.fn();
  const mockAccountMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSettingsProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockProfile,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    (useUpdateProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    });
    (useChangePassword as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockPasswordMutate,
      isPending: false,
    });
    (useAccountAction as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockAccountMutate,
      isPending: false,
    });

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders loading skeleton when profile is loading", () => {
    (useSettingsProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });

    const { container } = render(<SettingsPage />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders error state and refetch button when request fails", () => {
    (useSettingsProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<SettingsPage />);
    expect(screen.getByText("Unable to load Settings")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders settings header, tabs, and sections when profile data is loaded", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profile", level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Account & Security", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Danger Zone", level: 2 })).toBeInTheDocument();

    expect(screen.getByDisplayValue("R Amrutha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("amrutha.r@seacollege.edu.in")).toBeInTheDocument();
  });

  it("handles tab click and triggers scrollIntoView", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const securityTab = screen.getByRole("tab", { name: /account & security/i });
    await user.click(securityTab);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("allows editing and saving profile changes", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const nameInput = screen.getByDisplayValue("R Amrutha");
    await user.clear(nameInput);
    await user.type(nameInput, "Amrutha R");

    const saveButton = screen.getByRole("button", { name: /save profile/i });
    await user.click(saveButton);

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Amrutha R" }),
      expect.any(Object),
    );
  });

  it("shows coming soon toast when 2FA toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const switchBtn = screen.getByRole("switch", { name: /two-factor authentication/i });
    expect(switchBtn).toHaveAttribute("aria-disabled", "true");

    await user.click(switchBtn);
    expect(toast).toHaveBeenCalledWith("Two-Factor Authentication is coming soon");
  });

  it("opens confirm modal and executes account deactivation", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const deactivateButton = screen.getByRole("button", { name: "Deactivate" });
    await user.click(deactivateButton);

    expect(screen.getByText("Deactivate Account?")).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Confirm Deactivation" });
    await user.click(confirmButton);

    expect(mockAccountMutate).toHaveBeenCalledWith({ action: "deactivate" }, expect.any(Object));
  });

  it("opens confirm modal and executes account deletion", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const deleteButton = screen.getByRole("button", { name: "Delete Account" });
    await user.click(deleteButton);

    expect(screen.getByText("Delete Account Permanently?")).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Confirm Permanent Deletion" });
    await user.click(confirmButton);

    expect(mockAccountMutate).toHaveBeenCalledWith({ action: "delete" }, expect.any(Object));
  });
});
