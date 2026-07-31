import { useQuery } from "@tanstack/react-query";
import { fetchLevelDetails, fetchLevelModuleDetails } from "../api";

export const LEVEL_CONTENT_QUERY_KEY = "levelContent";

export const getLevelContentQueryKey = (levelId?: string, moduleNo?: number) =>
  [LEVEL_CONTENT_QUERY_KEY, levelId, moduleNo] as const;

export const useLevelContentData = (levelId?: string, moduleNo?: number) => {
  return useQuery({
    queryKey: getLevelContentQueryKey(levelId, moduleNo),
    queryFn: async () => {
      if (!levelId || moduleNo === undefined || !Number.isInteger(moduleNo)) {
        throw new Error("Level id and module number are required.");
      }

      const [level, module] = await Promise.all([
        fetchLevelDetails(levelId),
        fetchLevelModuleDetails(levelId, moduleNo),
      ]);

      return { level, module };
    },
    enabled: Boolean(levelId) && Number.isInteger(moduleNo),
    staleTime: 1000 * 60 * 5,
  });
};
