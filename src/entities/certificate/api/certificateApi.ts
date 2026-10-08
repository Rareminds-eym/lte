import { apiFetch, apiFetchBlob } from "@/shared/api";
import { certificateListSchema } from "../model/certificateSchemas";
import type { CertificateFilters } from "../model/types";
export async function fetchCertificates(filters: CertificateFilters = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.levelId) params.set("levelId", filters.levelId);
  const query = params.size ? `?${params}` : "";
  return certificateListSchema.parse(await apiFetch(`/api/v1/certificates${query}`, { signal }))
    .certificates;
}
export function downloadCertificate(credentialId: string) {
  return apiFetchBlob(`/api/v1/certificates/${encodeURIComponent(credentialId)}/download`, {
    signal: AbortSignal.timeout(35_000),
  });
}
