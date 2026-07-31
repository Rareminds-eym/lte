import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { fetchCapabilityLevels } from "../api/courseApi";

export const useCapabilityLevels = (capabilityCode: string) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ["capabilityLevels", capabilityCode],
    queryFn: () => fetchCapabilityLevels(capabilityCode),
    enabled: Boolean(capabilityCode) && (isAuthenticated || Boolean(accessToken)),
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      if (
        error instanceof Error &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number" &&
        (error as { status: number }).status >= 400 &&
        (error as { status: number }).status < 500
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
};
