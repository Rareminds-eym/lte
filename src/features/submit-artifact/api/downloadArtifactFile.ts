import { apiFetchBlob } from "@/shared/api";

export async function downloadArtifactFile(downloadUrl: string): Promise<Blob> {
  return apiFetchBlob(downloadUrl, {
    method: "GET",
  });
}
