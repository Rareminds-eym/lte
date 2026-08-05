import { useQuery } from "@tanstack/react-query";
import { fetchLevelDetails, fetchLevelModuleDetails } from "../api";

export const LEVEL_CONTENT_QUERY_KEY = "levelContent";
export const LEVEL_MODULE_DETAILS_QUERY_KEY = "levelModuleDetails";

export const getLevelContentQueryKey = (
  levelId?: string,
  moduleNo?: number,
  capabilityCode?: string,
) => [LEVEL_CONTENT_QUERY_KEY, levelId, moduleNo, capabilityCode] as const;

export const useLevelContentData = (
  levelId?: string,
  moduleNo?: number,
  capabilityCode?: string,
) => {
  return useQuery({
    queryKey: getLevelContentQueryKey(levelId, moduleNo, capabilityCode),
    queryFn: async () => {
      if (!levelId || moduleNo === undefined || !Number.isInteger(moduleNo)) {
        throw new Error("Level id and module number are required.");
      }

      const [level, module] = await Promise.all([
        fetchLevelDetails(levelId, capabilityCode),
        fetchLevelModuleDetails(levelId, moduleNo),
      ]);

      return { level, module };
    },
    enabled: Boolean(levelId) && Number.isInteger(moduleNo),
    staleTime: 1000 * 60 * 5,
  });
};

export const getLevelModuleDetailsQueryKey = (levelId?: string, moduleNo?: number) =>
  [LEVEL_MODULE_DETAILS_QUERY_KEY, levelId, moduleNo] as const;

export const useLevelModuleDetails = (levelId?: string, moduleNo?: number) => {
  return useQuery({
    queryKey: getLevelModuleDetailsQueryKey(levelId, moduleNo),
    queryFn: async () => {
      if (!levelId || moduleNo === undefined || !Number.isInteger(moduleNo)) {
        throw new Error("Level id and module number are required.");
      }

      return fetchLevelModuleDetails(levelId, moduleNo);
    },
    enabled: Boolean(levelId) && Number.isInteger(moduleNo),
    staleTime: 1000 * 60 * 5,
  });
};

export const LEVEL_DETAILS_QUERY_KEY = "levelDetails";

export const getLevelDetailsQueryKey = (levelId?: string, capabilityCode?: string) =>
  [LEVEL_DETAILS_QUERY_KEY, levelId, capabilityCode] as const;

export const useLevelDetails = (levelId?: string, capabilityCode?: string) => {
  return useQuery({
    queryKey: getLevelDetailsQueryKey(levelId, capabilityCode),
    queryFn: async () => {
      if (!levelId) {
        throw new Error("Level id is required.");
      }
      return fetchLevelDetails(levelId, capabilityCode);
    },
    enabled: Boolean(levelId),
    staleTime: 1000 * 60 * 5,
  });
};
