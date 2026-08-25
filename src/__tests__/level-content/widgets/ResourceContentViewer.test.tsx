import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResourceContentViewer } from "@/entities/course/ui/resource-content-viewer/ResourceContentViewer";

vi.mock("@/entities/course/ui/resource-content-viewer/PdfContentViewer", () => ({
  PdfContentViewer: () => {
    throw new Error("chunk load failed");
  },
}));

const pdfItem = {
  id: "item-1",
  title: "Incident Playbook",
  contentType: "pdf",
  url: "https://example.com/playbook.pdf",
} as never;

describe("ResourceContentViewer blast-radius containment (C2)", () => {
  // Lazy viewers resolve asynchronously — assertions must use findBy*.
  it("contains a render-phase viewer crash inside a local boundary", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <div data-testid="sibling-shell">shell stays mounted</div>
        <ResourceContentViewer item={pdfItem} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("sibling-shell")).toBeInTheDocument();
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
