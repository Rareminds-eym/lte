import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export const SETTINGS_PROFILE_QUERY_KEY = ["settingsProfile"];

export const useSettingsProfile = () => {
  return useQuery<SettingsProfile>({
    queryKey: SETTINGS_PROFILE_QUERY_KEY,
    queryFn: fetchSettingsProfile,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation<SettingsProfile, Error, UpdateProfilePayload>({
    mutationFn: updateSettingsProfile,
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(SETTINGS_PROFILE_QUERY_KEY, updatedProfile);
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
