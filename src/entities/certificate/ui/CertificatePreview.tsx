import { CertificateIcon } from "@/shared/ui";
import { CERTIFICATE_LABELS } from "../config/certificateConfig";
import type { Certificate } from "../model/types";

/** Accessible document view using the same immutable facts as the issued PDF. */
export function CertificatePreview({ certificate }: { certificate: Certificate }) {
  const copy = CERTIFICATE_LABELS;
  if (certificate.status !== "issued") return null;
  return (
    <article
      aria-label={copy.preview}
      className="relative overflow-hidden rounded-2xl border border-brand-200 bg-surface-primary p-3 shadow-sm sm:p-5"
    >
      <div className="border border-line-default px-5 py-8 sm:px-10 sm:py-12">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold tracking-widest text-brand-800">{copy.issuer}</p>
          <CertificateIcon aria-hidden="true" className="h-10 w-10 text-brand-600" />
        </div>
        <p className="mt-10 text-xs font-semibold uppercase tracking-widest text-brand-700">
          {certificate.certificateType === "course_completion"
            ? copy.certificateOfCompletion
            : copy.types.role_readiness}
        </p>
        {certificate.learnerName && (
          <>
            <p className="mt-7 text-sm text-content-secondary">{copy.recipient}</p>
            <p className="mt-2 break-words font-serif text-3xl leading-tight text-content-primary sm:text-4xl">
              {certificate.learnerName}
            </p>
          </>
        )}
        <p className="mt-7 text-sm text-content-secondary">{copy.achievement}</p>
        <h2 className="mt-2 break-words text-2xl font-semibold text-brand-800 sm:text-3xl">
          {certificate.title}
        </h2>
        {certificate.subtitle && (
          <p className="mt-2 break-words text-content-secondary">{certificate.subtitle}</p>
        )}
        <p className="mt-3 text-sm font-medium capitalize text-content-secondary">
          {[certificate.levelLabel, certificate.badge].filter(Boolean).join(" · ")}
        </p>
        <dl className="mt-10 grid grid-cols-1 gap-6 border-t border-line-default pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-content-secondary">{copy.completed}</dt>
            <dd className="mt-1 text-sm font-medium text-content-primary">
              <time dateTime={certificate.completionDate}>
                {new Date(certificate.completionDate).toLocaleDateString(undefined, {
                  timeZone: "UTC",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-content-secondary">{copy.credential}</dt>
            <dd className="mt-1 break-all font-mono text-xs text-content-primary">
              {certificate.credentialId}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
