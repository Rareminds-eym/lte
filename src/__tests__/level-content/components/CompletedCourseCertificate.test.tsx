import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { CompletedCourseCertificate } from "@/pages/level-content/ui/components/CompletedCourseCertificate";
import { apiFetch } from "@/shared/api";
import { certificate } from "../../certificates/testSupport";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof import("@/shared/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("@/entities/session", () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: "learner" } }),
}));
function Destination() {
  const location = useLocation();
  return (
    <p>
      {location.pathname}
      {location.search}
    </p>
  );
}
function renderWatcher(
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  if (!certificate.levelId) throw new Error("Certificate fixture requires a level ID");
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/player"]}>
        <Routes>
          <Route
            path="/player"
            element={
              <>
                <p>Review feedback</p>
                <CompletedCourseCertificate levelId={certificate.levelId} />
              </>
            }
          />
          <Route path="/certificates" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.clearAllMocks());
it.each([
  "issued",
  "pending_name",
])("opens the server-confirmed %s certificate after review", async (status) => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [{ ...certificate, status }] });
  renderWatcher();
  expect(
    await screen.findByText(`/certificates?levelId=${certificate.levelId}`),
  ).toBeInTheDocument();
});
it.each([
  { certificates: [] },
  { certificates: [{ ...certificate, status: "revoked" }] },
])("keeps feedback visible when no eligible credential exists", async ({ certificates }) => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates });
  renderWatcher();
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Review feedback")).toBeInTheDocument();
  expect(
    await screen.findByText(
      certificates.length ? "This certificate has been revoked." : /appears here once/,
    ),
  ).toBeInTheDocument();
});
it("does not navigate using an old cached credential when the server rejects the refresh", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["certificates", "learner", { levelId: certificate.levelId }], [certificate]);
  vi.mocked(apiFetch).mockRejectedValue(new Error("Unavailable"));
  renderWatcher(client);
  await waitFor(() =>
    expect(
      client.getQueryState(["certificates", "learner", { levelId: certificate.levelId }])?.status,
    ).toBe("error"),
  );
  expect(screen.getByText("Review feedback")).toBeInTheDocument();
});
