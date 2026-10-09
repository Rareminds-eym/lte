import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  CERTIFICATE_LABELS,
  CertificateCard,
  type CertificateFilters,
  certificateSchema,
  useCertificates,
} from "@/entities/certificate";
import { useAuthStore } from "@/entities/session";
import { CopyVerifyLinkButton, DownloadCertificateButton } from "@/features/certificate-actions";
import { Button, ErrorFallback, Skeleton, SkeletonGroup } from "@/shared/ui";
/** Page-owned composition; certificate data and actions remain in lower layers. */
export function CertificateCollection() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <CertificateCollectionContent />
    </ErrorBoundary>
  );
}
function CertificateCollectionContent() {
  const copy = CERTIFICATE_LABELS;
  const userId = useAuthStore((state) => state.user?.id);
  const [type, setType] = useState<CertificateFilters["type"]>();
  const { data, isLoading, isError, refetch } = useCertificates(userId, { type });
  return (
    <section className="mx-auto w-full space-y-8 lg:max-w-6xl">
      <header className="flex flex-col items-start gap-6 border-b border-line-default pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-content-primary">{copy.heading}</h1>
          <p className="mt-3 text-content-secondary">{copy.introduction}</p>
        </div>
        <label className="flex flex-col text-sm font-medium text-content-secondary sm:block">
          {copy.filter}
          <select
            className="mt-2 rounded-lg border border-line-default bg-surface-primary p-2 text-content-primary sm:ml-3 sm:mt-0"
            value={type ?? ""}
            onChange={(event) =>
              setType(
                event.target.value
                  ? certificateSchema.shape.certificateType.parse(event.target.value)
                  : undefined,
              )
            }
          >
            <option value="">{copy.allTypes}</option>
            <option value="course_completion">{copy.types.course_completion}</option>
            <option value="role_readiness">{copy.types.role_readiness}</option>
          </select>
        </label>
      </header>
      {isLoading ? (
        <SkeletonGroup
          className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          aria-label={copy.loading}
        >
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-64 rounded-2xl" />
          ))}
        </SkeletonGroup>
      ) : isError ? (
        <div role="alert">
          <p>{copy.loadError}</p>
          <Button type="button" onClick={() => void refetch()}>
            {copy.retry}
          </Button>
        </div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-line-default bg-surface-primary px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-content-primary">{copy.emptyHeading}</h2>
          <p className="mt-3 text-content-secondary">{copy.emptyDescription}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.map((certificate) => (
            <CertificateCard
              key={certificate.credentialId}
              certificate={certificate}
              actions={
                certificate.downloadable && (
                  <>
                    <DownloadCertificateButton credentialId={certificate.credentialId} />
                    {certificate.verifyUrl && (
                      <CopyVerifyLinkButton verifyUrl={certificate.verifyUrl} />
                    )}
                  </>
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
