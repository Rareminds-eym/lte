import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageInfoPanel } from "@/pages/level-content/ui/components/StageInfoPanel";

const level = {
  levelProblemStatement: {
    title: "Investigate the incident",
    description: "A production incident requires a careful evidence review.",
  },
};

const richModule = {
  moduleProblemStatement: "Find the first failing dependency before changing the system.",
  prerequisites: ["Read logs", "Know the service map"],
  whatYoullLearn: [
    "Signal selection",
    "Impact tracing",
    "Rollback criteria",
    "Evidence notes",
    "Extra item",
  ],
  whenToApply: "Use this during incident triage.",
  knowledge: {
    concepts: ["Dependency blast radius", "Timeline reconstruction"],
    empty: "",
  },
  tools: {
    primary: ["Runbook", "Dashboards"],
  },
  industryChallenge: "Teams often act before separating facts from assumptions.",
  pressurePoints: ["Customer impact", "Limited rollback window"],
};

const renderPanel = (overrides: Record<string, unknown> = {}) => {
  const setIsScenarioExpanded = vi.fn();
  const result = render(
    <StageInfoPanel
      level={level as unknown as Parameters<typeof StageInfoPanel>[0]["level"]}
      levelModule={richModule as unknown as Parameters<typeof StageInfoPanel>[0]["levelModule"]}
      activeStage="engage"
      activeArtifactType={null}
      stageDescription="Understand what is happening before selecting a fix."
      stageSummary="build shared context"
      previewItems={
        [
          { id: "item-1", title: "Walkthrough" },
          { id: "item-2", title: "Checklist" },
        ] as unknown as Parameters<typeof StageInfoPanel>[0]["previewItems"]
      }
      isScenarioExpanded={false}
      isScenarioOverflowing
      setIsScenarioExpanded={setIsScenarioExpanded}
      formatStageLabel={(stage) => `${stage.charAt(0).toUpperCase()}${stage.slice(1)}`}
      renderArtifactPanel={() => <section>Artifact requirements</section>}
      {...overrides}
    />,
  );

  return { ...result, setIsScenarioExpanded };
};

describe("StageInfoPanel", () => {
  it("renders stage, curriculum, and module context details", () => {
    renderPanel();

    expect(screen.getByText("Investigate the incident")).toBeInTheDocument();
    expect(screen.getByText("Module Problem Statement")).toBeInTheDocument();
    expect(screen.getByText("Engage Stage")).toBeInTheDocument();
    expect(screen.getByText("2 content items")).toBeInTheDocument();
    expect(screen.getByText("Read logs, Know the service map")).toBeInTheDocument();
    expect(
      screen.getByText("Signal selection, Impact tracing, Rollback criteria, Evidence notes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dependency blast radius, Timeline reconstruction"),
    ).toBeInTheDocument();
    expect(screen.getByText("Use this during incident triage.")).toBeInTheDocument();
    expect(screen.getByText("Runbook, Dashboards")).toBeInTheDocument();
    expect(
      screen.getByText("Teams often act before separating facts from assumptions."),
    ).toBeInTheDocument();
    expect(screen.getByText("Customer impact, Limited rollback window")).toBeInTheDocument();
    expect(screen.getByText("Ask AI Tutor")).toBeInTheDocument();
  });

  it("toggles overflowing scenario text from both controls", () => {
    const { setIsScenarioExpanded } = renderPanel();

    const problemToggle = screen.getByRole("button", { name: /Investigate the incident/i });
    expect(problemToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(problemToggle);
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));

    expect(setIsScenarioExpanded).toHaveBeenNthCalledWith(1, true);
    expect(setIsScenarioExpanded).toHaveBeenNthCalledWith(2, true);
  });

  it("renders artifact content instead of regular stage support panels", () => {
    renderPanel({ activeArtifactType: "practice" });

    expect(screen.getByText("Artifact requirements")).toBeInTheDocument();
    expect(screen.queryByText("Engage Stage")).not.toBeInTheDocument();
    expect(screen.queryByText("Curriculum Reference")).not.toBeInTheDocument();
    expect(screen.queryByText("Ask AI Tutor")).not.toBeInTheDocument();
  });

  it("handles minimal module data and singular content count", () => {
    renderPanel({
      levelModule: {} as unknown as Parameters<typeof StageInfoPanel>[0]["levelModule"],
      previewItems: [{ id: "item-1", title: "Solo" }] as unknown as Parameters<
        typeof StageInfoPanel
      >[0]["previewItems"],
      isScenarioOverflowing: false,
    });

    expect(screen.getByText("1 content item")).toBeInTheDocument();
    expect(screen.queryByText("Read more")).not.toBeInTheDocument();
    expect(screen.queryByText("Module Problem Statement")).not.toBeInTheDocument();
    expect(screen.queryByText("Curriculum Reference")).not.toBeInTheDocument();
    expect(screen.queryByText("Module Context")).not.toBeInTheDocument();
  });
});
