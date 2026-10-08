import { useState } from "react";
import toast from "react-hot-toast";
import { downloadCertificate } from "@/entities/certificate";
import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
export function DownloadCertificateButton({ credentialId }: { credentialId: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    let url: string | undefined;
    try {
      const blob = await downloadCertificate(credentialId);
      url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${credentialId}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      toast.success("Certificate downloaded");
    } catch (error) {
      const details =
        error instanceof ApiError
          ? (error.details as { retryAfterMs?: number } | undefined)
          : undefined;
      toast.error(
        details?.retryAfterMs
          ? `Please retry in ${Math.ceil(details.retryAfterMs / 1000)} seconds.`
          : "Could not download your certificate. Please try again.",
      );
    } finally {
      if (url) {
        const objectUrl = url;
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
      setBusy(false);
    }
  };
  return (
    <Button type="button" onClick={() => void download()} disabled={busy} aria-busy={busy}>
      {busy ? "Preparing PDF…" : "Download certificate"}
    </Button>
  );
}
