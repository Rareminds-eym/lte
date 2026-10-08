import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CertificateIcon } from "@/shared/ui/icons";
import type { Certificate } from "../model/types";
export function CertificateCard({
  certificate,
  actions,
}: {
  certificate: Certificate;
  actions?: ReactNode;
}) {
  const labels = { issued: "Issued", pending_name: "Name required", revoked: "Revoked" };
  return (
    <article className="flex flex-col rounded-2xl border border-line-default bg-surface-primary p-6 shadow-xs">
      <div className="mb-6 flex items-center justify-between gap-3">
        <CertificateIcon className="h-8 w-8 text-brand-600" />
        <span className="text-sm font-medium text-content-secondary">
          {labels[certificate.status]}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
        {certificate.certificateType === "course_completion"
          ? "Course completion"
          : "Role readiness"}
      </p>
      <h2 className="mt-2 text-xl font-bold text-content-primary">{certificate.title}</h2>
      <p className="mt-2 text-sm text-content-secondary">{certificate.subtitle}</p>
      <p className="mt-3 text-sm text-content-muted">
        {[certificate.levelLabel, certificate.badge].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-4 text-sm text-content-secondary">
        Completed{" "}
        {new Date(certificate.completionDate).toLocaleDateString(undefined, { timeZone: "UTC" })}
      </p>
      <p className="mt-2 break-all font-mono text-xs text-content-muted">
        {certificate.credentialId}
      </p>
      {certificate.status === "pending_name" && (
        <Link className="mt-4 text-sm font-medium text-brand-600 underline" to="/settings">
          Add your name in Settings to receive your certificate
        </Link>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-6">{actions}</div>
    </article>
  );
}
