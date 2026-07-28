import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Image } from "@/shared/ui";

describe("Image", () => {
  it("renders img with src and alt", () => {
    render(<Image src="/test.jpg" alt="Test" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/test.jpg");
    expect(img).toHaveAttribute("alt", "Test");
  });

  it("defaults to loading lazy and decoding async", () => {
    render(<Image src="/test.jpg" alt="Test" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
  });

  it("sets eager loading and high fetchpriority when priority is true", () => {
    render(<Image src="/test.jpg" alt="Test" priority />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("respects explicit loading override", () => {
    render(<Image src="/test.jpg" alt="Test" loading="eager" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).not.toHaveAttribute("fetchpriority");
  });

  it("wraps image in a div with aspect-ratio when aspectRatio is provided", () => {
    const { container } = render(<Image src="/test.jpg" alt="Test" aspectRatio="400/200" />);
    const wrapper = container.querySelector("div");
    expect(wrapper).toHaveStyle({ aspectRatio: "400/200" });
    expect(wrapper?.className).toContain("overflow-hidden");
  });

  it("renders children inside the wrapper", () => {
    render(
      <Image src="/test.jpg" alt="Test" aspectRatio="400/200">
        <span data-testid="badge">Badge</span>
      </Image>,
    );
    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(screen.getByText("Badge")).toBeInTheDocument();
  });

  it("passes className to the img element", () => {
    render(<Image src="/test.jpg" alt="Test" className="custom-img" />);
    const img = screen.getByRole("img");
    expect(img.className).toContain("custom-img");
  });

  it("passes wrapperClassName to the wrapper div", () => {
    const { container } = render(
      <Image src="/test.jpg" alt="Test" aspectRatio="400/200" wrapperClassName="custom-wrapper">
        <span>child</span>
      </Image>,
    );
    const wrapper = container.querySelector("div");
    expect(wrapper?.className).toContain("custom-wrapper");
  });
});
