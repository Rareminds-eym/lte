import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CertificateCollection } from "@/pages/certificates/ui/CertificateCollection";
import { apiFetch } from "@/shared/api";
import { certificate, wrapper } from "../testSupport";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof import("@/shared/api")>()),
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));
vi.mock("@/entities/session", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: "user" } }),
}));
beforeEach(() => vi.clearAllMocks());
it("lists certificates and changes the server-state filter", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [certificate] });
  render(<CertificateCollection />, { wrapper });
  expect(await screen.findByText("Problem solving")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "role_readiness" } });
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/certificates?type=role_readiness",
      expect.anything(),
    ),
  );
});
it("offers non-destructive retry and does not confuse error with empty", async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error("Network"));
  render(<CertificateCollection />, { wrapper });
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load certificates");
  expect(screen.queryByText("Your next achievement starts here")).not.toBeInTheDocument();
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [] });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Your next achievement starts here")).toBeInTheDocument();
});
