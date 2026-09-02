import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { fetchLevelDetails, fetchLevelModuleDetails } from "../api";

export const LEVEL_CONTENT_QUERY_KEY = "levelContent";
export const LEVEL_MODULE_DETAILS_QUERY_KEY = "levelModuleDetails";

export const getLevelContentQueryKey = (
  userId?: string,
  levelId?: string,
  moduleNo?: number,
  capabilityCode?: string,
) => [LEVEL_CONTENT_QUERY_KEY, userId, levelId, moduleNo, capabilityCode] as const;

export const useLevelContentData = (
  levelId?: string,
  moduleNo?: number,
  capabilityCode?: string,
) => {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: getLevelContentQueryKey(userId, levelId, moduleNo, capabilityCode),
    queryFn: async ({ signal }) => {
      if (!levelId || moduleNo === undefined || !Number.isInteger(moduleNo)) {
        throw new Error("Level id and module number are required.");
      }

      const [level, module] = await Promise.all([
        fetchLevelDetails(levelId, capabilityCode, signal),
        fetchLevelModuleDetails(levelId, moduleNo, signal),
      ]);

      return { level, module };
    },
    enabled: !!userId && Boolean(levelId) && Number.isInteger(moduleNo),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const getLevelModuleDetailsQueryKey = (
  userId?: string,
  levelId?: string,
  moduleNo?: number,
) => [LEVEL_MODULE_DETAILS_QUERY_KEY, userId, levelId, moduleNo] as const;

export const useLevelModuleDetails = (levelId?: string, moduleNo?: number) => {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: getLevelModuleDetailsQueryKey(userId, levelId, moduleNo),
    queryFn: async ({ signal }) => {
      if (!levelId || moduleNo === undefined || !Number.isInteger(moduleNo)) {
        throw new Error("Level id and module number are required.");
      }

      return fetchLevelModuleDetails(levelId, moduleNo, signal);
    },
    enabled: !!userId && Boolean(levelId) && Number.isInteger(moduleNo),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const LEVEL_DETAILS_QUERY_KEY = "levelDetails";

export const getLevelDetailsQueryKey = (
  userId?: string,
  levelId?: string,
  capabilityCode?: string,
) => [LEVEL_DETAILS_QUERY_KEY, userId, levelId, capabilityCode] as const;

export const useLevelDetails = (levelId?: string, capabilityCode?: string) => {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: getLevelDetailsQueryKey(userId, levelId, capabilityCode),
    queryFn: async ({ signal }) => {
      if (!levelId) {
        throw new Error("Level id is required.");
      }
      return fetchLevelDetails(levelId, capabilityCode, signal);
    },
    enabled: !!userId && Boolean(levelId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
