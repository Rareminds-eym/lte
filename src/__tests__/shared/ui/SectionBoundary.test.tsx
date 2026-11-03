import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionBoundary } from "@/shared/ui";

describe("SectionBoundary", () => {
  it("isolates an error to one section and supports recovery without reloading", () => {
    let fail = true;
    const Fragile = () => {
      if (fail) throw new Error("Rendering failed");
      return <p>Recovered content</p>;
    };
    render(
      <>
        <SectionBoundary label="Capabilities">
          <Fragile />
        </SectionBoundary>
        <p>Other section</p>
      </>,
    );
    expect(screen.getByRole("alert", { name: "Capabilities" })).toHaveTextContent(
      "Capabilities is temporarily unavailable",
    );
    expect(screen.getByText("Other section")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
