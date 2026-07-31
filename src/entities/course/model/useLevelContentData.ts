import { useQuery } from "@tanstack/react-query";
import { fetchLevelDetails, fetchLevelModuleDetails } from "../api";

export const LEVEL_CONTENT_QUERY_KEY = "levelContent";

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

export const LEVEL_DETAILS_QUERY_KEY = "levelDetails";

export const getLevelDetailsQueryKey = (levelId?: string, capabilityCode?: string) =>
  [LEVEL_DETAILS_QUERY_KEY, levelId, capabilityCode] as const;

export const useLevelDetails = (levelId?: string, capabilityCode?: string, userId?: string) => {
  return useQuery({
    queryKey: getLevelDetailsQueryKey(levelId, capabilityCode),
    queryFn: async () => {
      if (!levelId || !capabilityCode) {
        throw new Error("Level id and capability code are required.");
      }
      return fetchLevelDetails(levelId, capabilityCode, userId);
    },
    enabled: Boolean(levelId) && Boolean(capabilityCode),
    staleTime: 1000 * 60 * 5,
  });
};
