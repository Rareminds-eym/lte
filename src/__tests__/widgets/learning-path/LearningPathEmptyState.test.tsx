import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LearningPathEmptyState } from "@/widgets/learning-path";

describe("LearningPathEmptyState", () => {
  it("renders correctly with heading and descriptive text", () => {
    render(<LearningPathEmptyState />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("No learning path yet");
    expect(
      screen.getByText(
        /Unlock your personalized learning path by completing the SkillPassport career assessment/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveTextContent("Take Assessment");
  });
});
