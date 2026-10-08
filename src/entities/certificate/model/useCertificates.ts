import { useQuery } from "@tanstack/react-query";
import { fetchCertificates } from "../api/certificateApi";
import type { CertificateFilters } from "./types";
export function useCertificates(userId?: string, filters: CertificateFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["certificates", userId, filters],
    queryFn: ({ signal }) => fetchCertificates(filters, signal),
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
  });
}
