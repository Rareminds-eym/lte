import { ErrorBoundary } from "react-error-boundary";
import { Link } from "react-router-dom";
import {
  CERTIFICATE_CLIENT_CONFIG,
  CERTIFICATE_LABELS,
  CertificatePreview,
  useLevelCertificate,
} from "@/entities/certificate";
import { useAuthStore } from "@/entities/session";
import { Button, ErrorFallback, Skeleton, SkeletonGroup } from "@/shared/ui";
import { CopyVerifyLinkButton } from "./CopyVerifyLinkButton";
import { DownloadCertificateButton } from "./DownloadCertificateButton";

export function LevelCertificateActions({ levelId }: { levelId: string }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[levelId]}>
      <LevelCertificateContent levelId={levelId} />
    </ErrorBoundary>
  );
}

function LevelCertificateContent({ levelId }: { levelId: string }) {
  const userId = useAuthStore((state) => state.user?.id);
  const { certificate, isLoading, isError, isFetching, refetch } = useLevelCertificate(
    userId,
    levelId,
  );
  const copy = CERTIFICATE_LABELS;
  if (!userId) return null;
  if (isLoading)
    return (
      <SkeletonGroup className="mt-4 space-y-4" aria-label={copy.loadingOne}>
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-10 w-48 rounded-lg" />
      </SkeletonGroup>
    );
  if (isError)
    return (
      <div className="mt-4 space-y-3" role="alert">
        <p className="text-sm text-content-secondary">{copy.levelLoadError}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {copy.retry}
        </Button>
      </div>
    );
  if (!certificate)
    return (
      <div className="mt-4 space-y-3 rounded-xl border border-line-default bg-surface-primary p-5">
        <p role="status" className="text-sm font-medium text-content-primary">
          {isFetching ? copy.checking : copy.levelEmpty}
        </p>
        <p className="text-sm leading-relaxed text-content-secondary">{copy.issuanceHelp}</p>
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {copy.retry}
        </Button>
      </div>
    );
  if (certificate.status === "pending_name")
    return (
      <Link
        className="mt-4 block rounded-lg text-sm font-medium text-brand-700 underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
        to={CERTIFICATE_CLIENT_CONFIG.settingsPath}
      >
        {copy.nameRequired}
      </Link>
    );
  if (certificate.status === "revoked")
    return <p className="mt-4 text-sm text-content-secondary">{copy.revoked}</p>;
  return (
    <div className="mt-4 space-y-5">
      <p role="status" className="text-sm font-semibold text-success-700">
        {copy.ready}
      </p>
      <CertificatePreview certificate={certificate} />
      <p className="text-sm text-content-secondary">{copy.saved}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {certificate.downloadable ? (
          <DownloadCertificateButton credentialId={certificate.credentialId} />
        ) : (
          <p className="text-sm text-content-secondary">{copy.unavailableDownload}</p>
        )}
        {certificate.verifyUrl && (
          <>
            <CopyVerifyLinkButton verifyUrl={certificate.verifyUrl} />
            <a
              href={certificate.verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
            >
              {copy.verify}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
