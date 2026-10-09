import { useQuery } from "@tanstack/react-query";
import { fetchCertificates } from "../api/certificateApi";
import { CERTIFICATE_CLIENT_CONFIG } from "../config/certificateConfig";
import type { CertificateFilters } from "./types";
export function useCertificates(userId?: string, filters: CertificateFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["certificates", userId, filters],
    queryFn: ({ signal }) => fetchCertificates(filters, signal),
    enabled: Boolean(userId) && enabled,
    staleTime: CERTIFICATE_CLIENT_CONFIG.staleTimeMs,
  });
}
