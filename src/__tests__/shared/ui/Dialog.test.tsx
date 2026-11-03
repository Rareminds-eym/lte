import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "@/shared/ui";

describe("Dialog", () => {
  it("opens a labelled native modal and closes when its open prop changes", () => {
    const view = render(
      <Dialog open title="Details" onClose={vi.fn()}>
        Content
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog).toHaveAttribute("open");
    view.rerender(
      <Dialog open={false} title="Details" onClose={vi.fn()}>
        Content
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("dismisses via Escape and the labelled close button", () => {
    const close = vi.fn();
    render(
      <Dialog open title="Details" onClose={close}>
        Content
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(close).toHaveBeenCalledTimes(2);
  });
  it("dismisses backdrop clicks while retaining clicks within the panel", () => {
    const close = vi.fn();
    render(
      <Dialog open title="Details" onClose={close}>
        <p>Content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      left: 50,
      right: 150,
      top: 50,
      bottom: 150,
    } as DOMRect);
    fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(close).toHaveBeenCalledOnce();
  });
});
