import toast from "react-hot-toast";
import { Button } from "@/shared/ui/Button";
export function CopyVerifyLinkButton({ verifyUrl }: { verifyUrl: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      toast.success("Verification link copied");
    } catch {
      toast.error("Could not copy the link. Please try again.");
    }
  };
  return (
    <Button type="button" variant="outline" onClick={() => void copy()}>
      Copy verification link
    </Button>
  );
}
