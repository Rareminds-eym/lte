import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CertificateIcon } from "@/shared/ui";
import { CERTIFICATE_CLIENT_CONFIG, CERTIFICATE_LABELS } from "../config/certificateConfig";
import type { Certificate } from "../model/types";
export function CertificateCard({
  certificate,
  actions,
}: {
  certificate: Certificate;
  actions?: ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-line-default bg-surface-primary p-6 shadow-xs">
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CertificateIcon className="h-8 w-8 text-brand-600" />
        <span className="text-sm font-medium text-content-secondary">
          {CERTIFICATE_LABELS.statuses[certificate.status]}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
        {CERTIFICATE_LABELS.types[certificate.certificateType]}
      </p>
      <h2 className="mt-2 text-xl font-bold text-content-primary">{certificate.title}</h2>
      <p className="mt-2 text-sm text-content-secondary">{certificate.subtitle}</p>
      <p className="mt-3 text-sm text-content-muted">
        {[certificate.levelLabel, certificate.badge].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-4 text-sm text-content-secondary">
        {CERTIFICATE_LABELS.completed}{" "}
        {new Date(certificate.completionDate).toLocaleDateString(undefined, { timeZone: "UTC" })}
      </p>
      <p className="mt-2 break-all font-mono text-xs text-content-muted">
        {certificate.credentialId}
      </p>
      {certificate.status === "pending_name" && (
        <Link
          className="mt-4 text-sm font-medium text-brand-600 underline"
          to={CERTIFICATE_CLIENT_CONFIG.settingsPath}
        >
          {CERTIFICATE_LABELS.nameRequired}
        </Link>
      )}
      {certificate.status === "issued" && certificate.levelId && (
        <Link
          className="mt-4 rounded text-sm font-semibold text-brand-700 underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          to={`${CERTIFICATE_CLIENT_CONFIG.collectionPath}?levelId=${encodeURIComponent(certificate.levelId)}`}
        >
          {CERTIFICATE_LABELS.view}
        </Link>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-6 sm:flex-row sm:flex-wrap">{actions}</div>
    </article>
  );
}
