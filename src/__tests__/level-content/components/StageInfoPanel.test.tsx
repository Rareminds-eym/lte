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
      stageModuleContext="Engage stage context from modules_content."
      stageCurriculumReference={{
        prerequisites: "Basic borrower-file awareness",
        technical_concepts: "Evidence traceability, Status classification, Role boundary",
        credit_context: "Credit evidence intake and reviewer support",
        when_to_use: "Before pre-screen, exception analysis or reviewer handoff",
        module_continuity:
          "Output becomes the evidence baseline for the next CAP-CREDIT-001 module.",
      }}
      stageSummary="build shared context"
      previewItems={
        [
          { id: "item-1", title: "Walkthrough" },
          { id: "item-2", title: "Checklist" },
        ] as unknown as Parameters<typeof StageInfoPanel>[0]["previewItems"]
      }
      isScenarioExpanded={false}
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

    expect(screen.getByText("Main Problem Statement")).toBeInTheDocument();
    expect(
      screen.getByText("A production incident requires a careful evidence review."),
    ).toBeInTheDocument();
    expect(screen.getByText("Module Problem Statement")).toBeInTheDocument();
    expect(screen.getByText("Engage Statement")).toBeInTheDocument();
    expect(screen.getByText("2 content items")).toBeInTheDocument();
    expect(screen.getByText("Basic borrower-file awareness")).toBeInTheDocument();
    expect(
      screen.getByText("Evidence traceability, Status classification, Role boundary"),
    ).toBeInTheDocument();
    expect(screen.getByText("Credit evidence intake and reviewer support")).toBeInTheDocument();
    expect(
      screen.getByText("Before pre-screen, exception analysis or reviewer handoff"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Output becomes the evidence baseline for the next CAP-CREDIT-001 module."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Read logs, Know the service map")).not.toBeInTheDocument();
    expect(screen.queryByText("Use this during incident triage.")).not.toBeInTheDocument();
    expect(screen.queryByText("Runbook, Dashboards")).not.toBeInTheDocument();
    expect(screen.getByText("Engage stage context from modules_content.")).toBeInTheDocument();
    expect(
      screen.queryByText("Teams often act before separating facts from assumptions."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Customer impact, Limited rollback window")).not.toBeInTheDocument();
    expect(screen.getByText("Ask AI Tutor")).toBeInTheDocument();
  });

  it("toggles overflowing scenario text from both controls", () => {
    const { setIsScenarioExpanded } = renderPanel();

    const problemToggle = screen.getByRole("button", { name: "Show Full Problem Statement" });
    expect(problemToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(problemToggle);

    expect(setIsScenarioExpanded).toHaveBeenNthCalledWith(1, true);
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
      stageCurriculumReference: null,
      stageModuleContext: null,
    });

    expect(screen.getByText("1 content item")).toBeInTheDocument();
    expect(screen.queryByText("Read more")).not.toBeInTheDocument();
    expect(screen.queryByText("Module Problem Statement")).not.toBeInTheDocument();
    expect(screen.queryByText("Curriculum Reference")).not.toBeInTheDocument();
    expect(screen.queryByText("Module Context")).not.toBeInTheDocument();
  });

  it("renders supported legacy curriculum reference array values", () => {
    renderPanel({
      stageCurriculumReference: [
        "prerequisites: Course entry and source case pack",
        "technical_concepts: Evidence IDs: E-M0-01, E-M0-02, E-M0-03",
        "key_data: HN-24A, A-314",
        "when_to_use: Use before handing off to Case Intake Note.",
      ],
    });

    expect(screen.getByText("Engage Statement")).toBeInTheDocument();
    expect(screen.getByText("Curriculum Statement")).toBeInTheDocument();
    expect(screen.getByText("Course entry and source case pack")).toBeInTheDocument();
    expect(screen.getByText("Evidence IDs: E-M0-01, E-M0-02, E-M0-03")).toBeInTheDocument();
    expect(screen.getByText("Use before handing off to Case Intake Note.")).toBeInTheDocument();
    expect(screen.queryByText("HN-24A, A-314")).not.toBeInTheDocument();
  });
});
