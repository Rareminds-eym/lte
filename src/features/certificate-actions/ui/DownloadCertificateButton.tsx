import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  CERTIFICATE_CLIENT_CONFIG,
  CERTIFICATE_LABELS,
  downloadCertificate,
} from "@/entities/certificate";
import { ApiError } from "@/shared/api";
import { getLogger } from "@/shared/config";
import { Button, toast } from "@/shared/ui";

const logger = getLogger("certificate-actions");
const retrySchema = z.object({ retryAfterMs: z.number().positive().max(86_400_000).optional() });

export function DownloadCertificateButton({ credentialId }: { credentialId: string }) {
  const mutation = useMutation({
    mutationFn: () => downloadCertificate(credentialId),
    retry: false,
    onSuccess: (blob) => {
      let url: string | undefined;
      let anchor: HTMLAnchorElement | undefined;
      try {
        url = URL.createObjectURL(blob);
        anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${credentialId}.pdf`;
        document.body.append(anchor);
        anchor.click();
        toast.success(CERTIFICATE_LABELS.downloaded);
      } catch {
        logger.error("Certificate browser download failed", undefined, { credentialId });
        toast.error(CERTIFICATE_LABELS.downloadError);
      } finally {
        anchor?.remove();
        if (url) {
          const objectUrl = url;
          setTimeout(
            () => URL.revokeObjectURL(objectUrl),
            CERTIFICATE_CLIENT_CONFIG.releaseObjectUrlMs,
          );
        }
      }
    },
    onError: (error) => {
      const parsed = retrySchema.safeParse(error instanceof ApiError ? error.details : undefined);
      const retryAfterMs = parsed.success ? parsed.data.retryAfterMs : undefined;
      logger.error("Certificate download failed", undefined, {
        credentialId,
        code: error instanceof ApiError ? error.code : "DOWNLOAD_FAILED",
        requestId: error instanceof ApiError ? error.requestId : undefined,
      });
      toast.error(
        retryAfterMs
          ? CERTIFICATE_LABELS.retryAfter(Math.ceil(retryAfterMs / 1000))
          : CERTIFICATE_LABELS.downloadError,
      );
    },
  });
  return (
    <Button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-busy={mutation.isPending}
    >
      {mutation.isPending ? CERTIFICATE_LABELS.preparing : CERTIFICATE_LABELS.download}
    </Button>
  );
}
