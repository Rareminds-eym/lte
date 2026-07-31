import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { fetchCapabilityLevels } from "../api/courseApi";

export const useCapabilityLevels = (capabilityCode: string) => {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ["capabilityLevels", capabilityCode, accessToken],
    queryFn: ({ queryKey }) => fetchCapabilityLevels(queryKey[1] as string),
    enabled: !!accessToken && !!capabilityCode,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
