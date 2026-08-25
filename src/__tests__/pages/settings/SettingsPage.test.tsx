import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockQueryClientClear = vi.fn();

vi.mock("@/entities/session", () => ({
  useAuthStore: Object.assign(vi.fn(), { getState: vi.fn(() => ({ logout: mockLogout })) }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({ clear: mockQueryClientClear })),
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

  it("shows toast, clears cache, and logs out when account deactivation succeeds", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await user.click(screen.getByRole("button", { name: "Confirm Deactivation" }));

    const options = mockAccountMutate.mock.calls.at(-1)?.[1] as {
      onSuccess: (res: { message: string }) => Promise<void>;
    };
    await options.onSuccess({ message: "Account deactivated successfully" });

    expect(toast).toHaveBeenCalledWith("Account deactivated successfully");
    expect(mockQueryClientClear).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Deactivate Account?")).not.toBeInTheDocument());
  });

  it("shows error toast when account action fails", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await user.click(screen.getByRole("button", { name: "Confirm Deactivation" }));

    const options = mockAccountMutate.mock.calls.at(-1)?.[1] as { onError: (err: Error) => void };
    options.onError(new Error("Account action failed"));

    expect(toast).toHaveBeenCalledWith("Account action failed");
  });

  it("shows toast when password fields are invalid", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const current = screen.getByPlaceholderText("••••••••••");
    const next = screen.getByPlaceholderText("Enter new password");
    const confirm = screen.getByPlaceholderText("Re-enter new password");
    const updateButton = screen.getByRole("button", { name: "Update Password" });

    await user.click(updateButton);
    expect(toast).toHaveBeenLastCalledWith("Please enter your current password");

    fireEvent.change(current, { target: { value: "oldpass" } });
    await user.click(updateButton);
    expect(toast).toHaveBeenLastCalledWith("New password must be at least 8 characters");

    fireEvent.change(next, { target: { value: "newpass123" } });
    await user.click(updateButton);
    expect(toast).toHaveBeenLastCalledWith("New password and confirm password do not match");

    fireEvent.change(confirm, { target: { value: "newpass123" } });
    await user.click(updateButton);
    expect(mockPasswordMutate).toHaveBeenCalledWith(
      {
        current_password: "oldpass",
        new_password: "newpass123",
      },
      expect.any(Object),
    );
  });

  it("shows toast and clears fields when password change succeeds", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText("••••••••••"), {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter new password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter new password"), {
      target: { value: "newpass123" },
    });
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    const options = mockPasswordMutate.mock.calls.at(-1)?.[1] as {
      onSuccess: (res: { message: string }) => void;
    };
    options.onSuccess({ message: "Password changed successfully" });

    expect(toast).toHaveBeenCalledWith("Password changed successfully");
    await waitFor(() => expect(screen.getByPlaceholderText("••••••••••")).toHaveValue(""));
  });

  it("shows toast when password change fails", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.type(screen.getByPlaceholderText("••••••••••"), "oldpass");
    await user.type(screen.getByPlaceholderText("Enter new password"), "newpass123");
    await user.type(screen.getByPlaceholderText("Re-enter new password"), "newpass123");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    const options = mockPasswordMutate.mock.calls.at(-1)?.[1] as { onError: (err: Error) => void };
    options.onError(new Error("SSO error"));

    expect(toast).toHaveBeenCalledWith("SSO error");
  });

  it("shows coming soon toast when login alerts switch is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const alertsSwitch = screen.getByRole("switch", { name: /login alerts/i });
    await user.click(alertsSwitch);

    expect(toast).toHaveBeenCalledWith("Login Alerts is coming soon");
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it("shows toast when profile save succeeds", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /save profile/i }));

    const options = mockUpdateMutate.mock.calls.at(-1)?.[1] as { onSuccess: () => void };
    options.onSuccess();
    expect(toast).toHaveBeenCalledWith("Profile updated successfully!");
  });

  it("shows toast when profile save fails", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /save profile/i }));

    const options = mockUpdateMutate.mock.calls.at(-1)?.[1] as { onError: (err: Error) => void };
    options.onError(new Error("Save failed"));

    expect(toast).toHaveBeenCalledWith("Save failed");
  });

  it("cancels profile edits and restores original values", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const nameInput = screen.getByDisplayValue("R Amrutha");
    await user.clear(nameInput);
    await user.type(nameInput, "Amrutha R");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByDisplayValue("R Amrutha")).toBeInTheDocument();
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it("renders correct dynamic color tiers according to profile strength (Course Learnings style)", () => {
    // 1. In-progress tier (< 100%) uses Brand Blue
    (useSettingsProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { ...mockProfile, profileStrength: 72 },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    const { rerender } = render(<SettingsPage />);
    expect(screen.getByText("72%")).toHaveClass("text-brand-600");

    // 2. 100% Completed tier uses Success Green
    (useSettingsProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { ...mockProfile, profileStrength: 100 },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    rerender(<SettingsPage />);
    expect(screen.getByText("100%")).toHaveClass("text-success-600");
  });
});
