import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import {
  changePassword,
  executeAccountAction,
  fetchSettingsProfile,
  updateSettingsProfile,
} from "../api/settingsApi";
import type {
  AccountActionPayload,
  ChangePasswordPayload,
  SettingsProfile,
  UpdateProfilePayload,
} from "./types";

const SETTINGS_PROFILE_QUERY_KEY = "settingsProfile";

/** Query key scoped to the signed-in user to prevent cross-user cache bleed. */
export const settingsProfileQueryKey = (userId?: string) =>
  [SETTINGS_PROFILE_QUERY_KEY, userId] as const;

export const useSettingsProfile = () => {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<SettingsProfile>({
    queryKey: settingsProfileQueryKey(userId),
    queryFn: ({ signal }) => fetchSettingsProfile(signal),
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000, // kiosk PII: 2m retention (was 10m)
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation<SettingsProfile, Error, UpdateProfilePayload>({
    mutationFn: updateSettingsProfile,
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(settingsProfileQueryKey(userId), updatedProfile);
    },
  });
};

export const useChangePassword = () => {
  return useMutation<{ success: boolean; message: string }, Error, ChangePasswordPayload>({
    mutationFn: changePassword,
  });
};

export const useAccountAction = () => {
  return useMutation<{ success: boolean; message: string }, Error, AccountActionPayload>({
    mutationFn: executeAccountAction,
  });
};
