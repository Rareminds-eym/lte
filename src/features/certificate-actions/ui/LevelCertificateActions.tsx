import { Link } from "react-router-dom";
import {
  CERTIFICATE_CLIENT_CONFIG,
  CERTIFICATE_LABELS,
  useLevelCertificate,
} from "@/entities/certificate";
import { useAuthStore } from "@/entities/session";
import { Button, Skeleton, SkeletonGroup } from "@/shared/ui";
import { CopyVerifyLinkButton } from "./CopyVerifyLinkButton";
import { DownloadCertificateButton } from "./DownloadCertificateButton";
export function LevelCertificateActions({ levelId }: { levelId: string }) {
  const userId = useAuthStore((state) => state.user?.id);
  const { certificate, isLoading, isError, refetch } = useLevelCertificate(userId, levelId);
  if (isLoading)
    return (
      <SkeletonGroup
        className="mt-3 flex flex-col gap-2"
        aria-label={CERTIFICATE_LABELS.loadingOne}
      >
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </SkeletonGroup>
    );
  if (isError)
    return (
      <div className="mt-3" role="alert">
        <p className="text-sm text-content-secondary">{CERTIFICATE_LABELS.levelLoadError}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          {CERTIFICATE_LABELS.retry}
        </Button>
      </div>
    );
  if (!certificate)
    return <p className="mt-3 text-sm text-content-secondary">{CERTIFICATE_LABELS.levelEmpty}</p>;
  if (certificate.status === "pending_name")
    return (
      <Link
        className="mt-3 block text-sm text-brand-600 underline"
        to={CERTIFICATE_CLIENT_CONFIG.settingsPath}
      >
        {CERTIFICATE_LABELS.nameRequired}
      </Link>
    );
  if (certificate.status === "revoked")
    return <p className="mt-3 text-sm text-content-secondary">{CERTIFICATE_LABELS.revoked}</p>;
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <DownloadCertificateButton credentialId={certificate.credentialId} />
      {certificate.verifyUrl && <CopyVerifyLinkButton verifyUrl={certificate.verifyUrl} />}
    </div>
  );
}
