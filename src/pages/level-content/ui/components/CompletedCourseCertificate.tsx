import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CERTIFICATE_CLIENT_CONFIG,
  CERTIFICATE_LABELS,
  useLevelCertificate,
} from "@/entities/certificate";
import { useAuthStore } from "@/entities/session";
import { Button } from "@/shared/ui";

/** Review completion is a signal to check eligibility, never proof of course completion. */
export function CompletedCourseCertificate({ levelId }: { levelId: string }) {
  const userId = useAuthStore((state) => state.user?.id);
  const { certificate, isError, isFetching, refetch } = useLevelCertificate(userId, levelId);
  const navigate = useNavigate();
  useEffect(() => {
    if (!userId || isError || isFetching || !certificate || certificate.status === "revoked")
      return;
    navigate(`${CERTIFICATE_CLIENT_CONFIG.collectionPath}?levelId=${encodeURIComponent(levelId)}`);
  }, [certificate, isError, isFetching, levelId, navigate, userId]);
  if (!userId) return null;
  const message = isError
    ? CERTIFICATE_LABELS.levelLoadError
    : certificate?.status === "revoked"
      ? CERTIFICATE_LABELS.revoked
      : isFetching
        ? CERTIFICATE_LABELS.checking
        : CERTIFICATE_LABELS.issuanceHelp;
  return (
    <div
      role={isError || certificate?.status === "revoked" ? "alert" : "status"}
      className="flex flex-col gap-2 border-b border-line-default bg-surface-primary p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-content-secondary">{message}</p>
      {certificate?.status !== "revoked" && (
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {CERTIFICATE_LABELS.retry}
        </Button>
      )}
    </div>
  );
}
