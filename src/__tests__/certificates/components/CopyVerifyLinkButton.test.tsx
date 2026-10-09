import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CopyVerifyLinkButton } from "@/features/certificate-actions";
import { toast } from "@/shared/ui";
import { certificate } from "../testSupport";

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
it("copies the API verification link and reports clipboard failure", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CopyVerifyLinkButton verifyUrl={certificate.verifyUrl!} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Verification link copied"));
  expect(writeText).toHaveBeenCalledWith(certificate.verifyUrl);
  writeText.mockRejectedValue(new Error("Clipboard denied"));
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Could not copy the link. Please try again."),
  );
});
