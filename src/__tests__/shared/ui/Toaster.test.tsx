import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "@/shared/ui";

// Mock matchMedia API which is missing in jsdom/testing environments
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const TestTrigger: React.FC = () => {
  return (
    <div>
      <Toaster />
      <button onClick={() => toast.success("Toast succeeded!")} type="button">
        Trigger Success
      </button>
      <button onClick={() => toast.error("Toast failed!")} type="button">
        Trigger Error
      </button>
    </div>
  );
};

describe("Toaster & Toast integration", () => {
  it("renders success notifications when toast.success is triggered", async () => {
    render(<TestTrigger />);

    const button = screen.getByRole("button", { name: /trigger success/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Toast succeeded!")).toBeInTheDocument();
    });
  });

  it("renders error notifications when toast.error is triggered", async () => {
    render(<TestTrigger />);

    const button = screen.getByRole("button", { name: /trigger error/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Toast failed!")).toBeInTheDocument();
    });
  });
});
