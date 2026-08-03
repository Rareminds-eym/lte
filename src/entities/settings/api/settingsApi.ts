import { apiFetch, apiGet } from "@/shared/api";
import type {
  AccountActionPayload,
  ChangePasswordPayload,
  SettingsProfile,
  SettingsProfileResponse,
  UpdateProfilePayload,
} from "../model/types";

export const fetchSettingsProfile = async (): Promise<SettingsProfile> => {
  const res = await apiGet<SettingsProfileResponse>("/api/v1/settings/profile");
  return res.profile;
};

export const updateSettingsProfile = async (
  payload: UpdateProfilePayload,
): Promise<SettingsProfile> => {
  const res = await apiFetch<SettingsProfileResponse>("/api/v1/settings/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.profile;
};

export const changePassword = async (
  payload: ChangePasswordPayload,
): Promise<{ success: boolean; message: string }> => {
  return apiFetch<{ success: boolean; message: string }>("/api/v1/settings/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const executeAccountAction = async (
  payload: AccountActionPayload,
): Promise<{ success: boolean; message: string }> => {
  return apiFetch<{ success: boolean; message: string }>("/api/v1/settings/account", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
