import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchSettingsProfile = vi.fn();
const mockUpdateSettingsProfile = vi.fn();

vi.mock("@/entities/settings/api/settingsApi", () => ({
  fetchSettingsProfile: () => mockFetchSettingsProfile(),
  updateSettingsProfile: (payload: unknown) => mockUpdateSettingsProfile(payload),
  changePassword: vi.fn(),
  executeAccountAction: vi.fn(),
}));

import { useSettingsProfile, useUpdateProfile } from "@/entities/settings";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const profile = {
  fullName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@rareminds.com",
  phone: "+91 99999 00000",
  program: "BCA",
  gradeSemester: "3",
  learnerId: "L-001",
  college: "RareMinds College",
  section: "A",
  skillPassportVerified: true,
  twoFactorEnabled: true,
  loginAlertsEnabled: true,
  profileStrength: 100,
};

describe("useSettingsProfile", () => {
  beforeEach(() => {
    mockFetchSettingsProfile.mockReset();
    mockUpdateSettingsProfile.mockReset();
    queryClient.clear();
  });

  it("fetches the profile on mount", async () => {
    mockFetchSettingsProfile.mockResolvedValue(profile);
    const { result } = renderHook(() => useSettingsProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.fullName).toBe("Jane Doe");
  });

  it("exposes the error state when the fetch fails", async () => {
    mockFetchSettingsProfile.mockRejectedValue(new Error("API error"));
    const { result } = renderHook(() => useSettingsProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateProfile", () => {
  it("writes the updated profile to the query cache", async () => {
    const updated = { ...profile, fullName: "Jane Smith" };
    mockUpdateSettingsProfile.mockResolvedValue(updated);
    const { result } = renderHook(
      () => ({ query: useSettingsProfile(), update: useUpdateProfile() }),
      { wrapper: createWrapper() },
    );

    result.current.update.mutate({ fullName: "Jane Smith" });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(queryClient.getQueryData(["settingsProfile", undefined])).toEqual(updated);
  });
});
