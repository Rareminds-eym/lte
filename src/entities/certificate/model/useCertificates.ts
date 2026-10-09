import { useQuery } from "@tanstack/react-query";
import { fetchCertificates } from "../api/certificateApi";
import { CERTIFICATE_CLIENT_CONFIG } from "../config/certificateConfig";
import type { CertificateFilters } from "./types";
export function useCertificates(
  userId?: string,
  filters: CertificateFilters = {},
  enabled = true,
  waitForIssuance = false,
) {
  return useQuery({
    queryKey: ["certificates", userId, filters],
    queryFn: ({ signal }) => fetchCertificates(filters, signal),
    enabled: Boolean(userId) && enabled,
    staleTime: CERTIFICATE_CLIENT_CONFIG.staleTimeMs,
    refetchOnMount: waitForIssuance ? "always" : true,
    refetchInterval: waitForIssuance
      ? (query) =>
          query.state.status === "success" &&
          query.state.data?.length === 0 &&
          query.state.dataUpdateCount < CERTIFICATE_CLIENT_CONFIG.issuancePollLimit
            ? CERTIFICATE_CLIENT_CONFIG.issuancePollIntervalMs
            : false
      : false,
    refetchIntervalInBackground: false,
  });
}
