import { Link } from "react-router-dom";
import { useLevelCertificate } from "@/entities/certificate";
import { useAuthStore } from "@/entities/session";
import { Button } from "@/shared/ui/Button";
import { CopyVerifyLinkButton } from "./CopyVerifyLinkButton";
import { DownloadCertificateButton } from "./DownloadCertificateButton";
export function LevelCertificateActions({ levelId }: { levelId: string }) {
  const userId = useAuthStore((state) => state.user?.id);
  const { certificate, isLoading, isError, refetch } = useLevelCertificate(userId, levelId);
  if (isLoading)
    return (
      <p role="status" className="mt-3 animate-pulse text-sm text-content-muted">
        Loading certificate…
      </p>
    );
  if (isError || !certificate)
    return (
      <div className="mt-3">
        <p className="text-sm text-content-secondary">Your certificate is being prepared.</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          Check certificate
        </Button>
      </div>
    );
  if (certificate.status === "pending_name")
    return (
      <Link className="mt-3 block text-sm text-brand-600 underline" to="/settings">
        Add your name in Settings to receive your certificate
      </Link>
    );
  if (certificate.status === "revoked")
    return (
      <p className="mt-3 text-sm text-content-secondary">This certificate has been revoked.</p>
    );
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <DownloadCertificateButton credentialId={certificate.credentialId} />
      {certificate.verifyUrl && <CopyVerifyLinkButton verifyUrl={certificate.verifyUrl} />}
    </div>
  );
}
