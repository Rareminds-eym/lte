import { apiFetch, apiFetchBlob, requestCorrelationHeaders } from "@/shared/api";
import { CERTIFICATE_CLIENT_CONFIG } from "../config/certificateConfig";
import type { CertificateFilters } from "../model/types";
import { certificateFiltersSchema, certificateListSchema } from "../schemas/certificateSchemas";
export async function fetchCertificates(filters: CertificateFilters = {}, signal?: AbortSignal) {
  filters = certificateFiltersSchema.parse(filters);
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.levelId) params.set("levelId", filters.levelId);
  const query = params.size ? `?${params}` : "";
  const timeout = AbortSignal.timeout(CERTIFICATE_CLIENT_CONFIG.listTimeoutMs);
  const boundedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  return certificateListSchema.parse(
    await apiFetch(`${CERTIFICATE_CLIENT_CONFIG.apiPath}${query}`, {
      signal: boundedSignal,
      headers: requestCorrelationHeaders(),
    }),
  ).certificates;
}
export function downloadCertificate(credentialId: string) {
  return apiFetchBlob(
    `${CERTIFICATE_CLIENT_CONFIG.apiPath}/${encodeURIComponent(credentialId)}/download`,
    {
      signal: AbortSignal.timeout(CERTIFICATE_CLIENT_CONFIG.downloadTimeoutMs),
      headers: requestCorrelationHeaders(),
    },
  );
}
