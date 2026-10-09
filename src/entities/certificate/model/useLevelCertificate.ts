import { useCertificates } from "./useCertificates";
export function useLevelCertificate(userId: string | undefined, levelId: string | undefined) {
  const query = useCertificates(userId, { levelId }, Boolean(levelId), true);
  return {
    ...query,
    certificate: query.data?.find((row) => row.status !== "revoked") ?? query.data?.[0],
  };
}
