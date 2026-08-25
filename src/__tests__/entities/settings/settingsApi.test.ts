import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  executeAccountAction,
  fetchSettingsProfile,
  updateSettingsProfile,
} from "@/entities/settings/api/settingsApi";
import { apiFetch, apiGet } from "@/shared/api";

vi.mock("@/shared/api", () => ({
  apiGet: vi.fn(),
  apiFetch: vi.fn(),
}));

describe("settingsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSettingsProfile", () => {
    it("fetches settings profile data", async () => {
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
        loginAlertsEnabled: true,
        profileStrength: 72,
      };

      (apiGet as Mock).mockResolvedValue({ success: true, profile: mockProfile });

      const result = await fetchSettingsProfile();

      expect(apiGet).toHaveBeenCalledWith("/api/v1/settings/profile");
      expect(result).toEqual(mockProfile);
    });
  });

  describe("updateSettingsProfile", () => {
    it("sends PUT request to update profile", async () => {
      const payload = { fullName: "Amrutha R", phone: "+91 99999 88888" };
      const mockUpdated = {
        fullName: "Amrutha R",
        firstName: "Amrutha",
        lastName: "R",
        email: "amrutha.r@seacollege.edu.in",
        phone: "+91 99999 88888",
        program: "B.Tech Engineering",
        gradeSemester: "UG · Sem 4",
        learnerId: "LRN-RAM26-00001138",
        college: "SEA College",
        section: "Sem 4",
        skillPassportVerified: true,
        twoFactorEnabled: false,
        loginAlertsEnabled: true,
        profileStrength: 75,
      };

      (apiFetch as Mock).mockResolvedValue({ success: true, profile: mockUpdated });

      const result = await updateSettingsProfile(payload);

      expect(apiFetch).toHaveBeenCalledWith("/api/v1/settings/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe("changePassword", () => {
    it("sends POST request to change password", async () => {
      const payload = { current_password: "oldPassword123!", new_password: "newPassword123!" };
      (apiFetch as Mock).mockResolvedValue({
        success: true,
        message: "Password changed successfully",
      });

      const result = await changePassword(payload);

      expect(apiFetch).toHaveBeenCalledWith("/api/v1/settings/password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      expect(result).toEqual({ success: true, message: "Password changed successfully" });
    });
  });

  describe("executeAccountAction", () => {
    it("sends POST request for deactivating account", async () => {
      const payload = { action: "deactivate" as const };
      (apiFetch as Mock).mockResolvedValue({
        success: true,
        message: "Account has been deactivated successfully.",
      });

      const result = await executeAccountAction(payload);

      expect(apiFetch).toHaveBeenCalledWith("/api/v1/settings/account", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      expect(result).toEqual({
        success: true,
        message: "Account has been deactivated successfully.",
      });
    });
  });
});
