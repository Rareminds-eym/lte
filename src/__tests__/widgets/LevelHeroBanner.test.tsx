import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LevelHeroBanner } from "@/widgets/level-modules/ui/LevelHeroBanner";

const longDescription = `${"Build a practical workflow with clear checkpoints. ".repeat(8)}Keep the final artifact focused.`;

function renderLevelHeroBanner(overrides = {}) {
  const props = {
    capabilityCode: "gen-ai",
    levelBadge: "Level 1",
    title: "Generative AI Foundations",
    description: "Short learning path summary.",
    overallProgress: 40,
    doneCount: 2,
    activeCount: 1,
    availableCount: 3,
    learningCtaLabel: "Continue Learning",
    nextUpTitle: "Prompt workflow",
    onContinueLearning: vi.fn(),
    onShare: vi.fn(),
    onBookmark: vi.fn(),
    ...overrides,
  };

  render(
    <MemoryRouter>
      <LevelHeroBanner {...props} />
    </MemoryRouter>,
  );

  return props;
}

describe("LevelHeroBanner", () => {
  it("renders level summary and actions", async () => {
    const user = userEvent.setup();
    const props = renderLevelHeroBanner();

    expect(screen.getByRole("link", { name: /back to courses/i })).toHaveAttribute(
      "href",
      "/my-courses/gen-ai",
    );
    expect(screen.getByRole("heading", { name: "Generative AI Foundations" })).toBeVisible();
    expect(screen.getByText("40%")).toBeVisible();
    expect(screen.getByText("Prompt workflow")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /continue learning/i }));
    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(screen.getByRole("button", { name: /bookmark course/i }));

    expect(props.onContinueLearning).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
    expect(props.onBookmark).toHaveBeenCalledTimes(1);
  });

  it("expands and collapses long descriptions", async () => {
    const user = userEvent.setup();
    renderLevelHeroBanner({ description: longDescription });

    const description = screen.getByText(longDescription);
    const toggle = screen.getByRole("button", { name: /show more/i });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(description).toHaveClass("line-clamp-3");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: /show less/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(description).not.toHaveClass("line-clamp-3");

    await user.click(screen.getByRole("button", { name: /show less/i }));

    expect(screen.getByRole("button", { name: /show more/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(description).toHaveClass("line-clamp-3");
  });
});
