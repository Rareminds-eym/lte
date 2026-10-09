import { ErrorBoundary } from "react-error-boundary";
import { Link, useSearchParams } from "react-router-dom";
import {
  CERTIFICATE_CLIENT_CONFIG,
  CERTIFICATE_LABELS,
  certificateFiltersSchema,
} from "@/entities/certificate";
import { LevelCertificateActions } from "@/features/certificate-actions";
import { ROUTES } from "@/shared/config";
import { ErrorFallback } from "@/shared/ui";
import { CertificateCollection } from "./CertificateCollection";

export function CertificatesPage() {
  const [params] = useSearchParams();
  const rawLevelId = params.get("levelId");
  if (rawLevelId === null) return <CertificateCollection />;
  const parsed = certificateFiltersSchema.shape.levelId.unwrap().safeParse(rawLevelId);
  const copy = CERTIFICATE_LABELS;
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[rawLevelId]}>
      <section className="mx-auto w-full space-y-6 lg:max-w-4xl">
        <header className="border-b border-line-default pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-content-primary sm:text-4xl">
            {copy.completionHeading}
          </h1>
          <p className="mt-3 text-content-secondary">{copy.completionIntroduction}</p>
        </header>
        {parsed.success ? (
          <LevelCertificateActions key={parsed.data} levelId={parsed.data} />
        ) : (
          <p role="alert" className="text-content-secondary">
            {copy.invalidLevel}
          </p>
        )}
        <nav
          aria-label={copy.heading}
          className="flex flex-col gap-4 border-t border-line-default pt-6 sm:flex-row sm:justify-between"
        >
          <Link
            className="rounded text-sm font-semibold text-brand-700 underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
            to={CERTIFICATE_CLIENT_CONFIG.collectionPath}
          >
            {copy.allCertificates}
          </Link>
          <Link
            className="rounded text-sm font-medium text-content-secondary underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
            to={ROUTES.MY_COURSES}
          >
            {copy.backToCourses}
          </Link>
        </nav>
      </section>
    </ErrorBoundary>
  );
}
