import { useState } from "react";
import { CertificateCard, type CertificateFilters, useCertificates } from "@/entities/certificate";
import { useAuthStore } from "@/entities/session";
import { CopyVerifyLinkButton, DownloadCertificateButton } from "@/features/certificate-actions";
import { Button } from "@/shared/ui/Button";
export function CertificatesPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const [type, setType] = useState<CertificateFilters["type"]>();
  const { data, isLoading, isError, refetch } = useCertificates(userId, { type });
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line-default pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Your learning, recognised
          </p>
          <h1 className="mt-3 text-3xl font-bold text-content-primary">My Certificates</h1>
          <p className="mt-3 text-content-secondary">
            A record of what you have achieved. Download it. Share it.
          </p>
        </div>
        <label className="text-sm font-medium text-content-secondary">
          Certificate type
          <select
            className="ml-3 rounded-lg border border-line-default bg-surface-primary p-2 text-content-primary"
            value={type ?? ""}
            onChange={(event) =>
              setType((event.target.value || undefined) as CertificateFilters["type"])
            }
          >
            <option value="">All certificates</option>
            <option value="course_completion">Course completion</option>
            <option value="role_readiness">Role readiness</option>
          </select>
        </label>
      </header>
      {isLoading ? (
        <div
          role="status"
          className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Loading certificates"
        >
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert">
          <p>Could not load certificates.</p>
          <Button type="button" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-line-default bg-surface-primary px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-content-primary">
            Your next achievement starts here
          </h2>
          <p className="mt-3 text-content-secondary">
            Complete a course or learning path to earn a certificate.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
