import { CERTIFICATE_LABELS } from "@/entities/certificate";
import { getLogger } from "@/shared/config";
import { Button, toast } from "@/shared/ui";

const logger = getLogger("certificate-actions");
export function CopyVerifyLinkButton({ verifyUrl }: { verifyUrl: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      toast.success(CERTIFICATE_LABELS.copied);
    } catch {
      logger.warn("Certificate verification link could not be copied");
      toast.error(CERTIFICATE_LABELS.copyError);
    }
  };
  return (
    <Button type="button" variant="outline" onClick={() => void copy()}>
      {CERTIFICATE_LABELS.copy}
    </Button>
  );
}
