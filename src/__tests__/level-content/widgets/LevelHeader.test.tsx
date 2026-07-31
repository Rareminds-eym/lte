import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LevelHeader } from "@/widgets/LevelHeader";

describe("LevelHeader Widget", () => {
  it("renders overview breadcrumb and level title", () => {
    render(<LevelHeader levelTitle="System Failure Investigation" activeStage="engage" />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("System Failure Investigation")).toBeInTheDocument();
    expect(screen.getByText("Engage")).toBeInTheDocument();
  });

  it("renders stage name based on activeStage prop", () => {
    render(<LevelHeader levelTitle="System Failure Investigation" activeStage="explore" />);

    expect(screen.getByText("Explore")).toBeInTheDocument();
  });

  it("triggers onBackClick when back arrow or overview is clicked", () => {
    const onBack = vi.fn();
    render(
      <LevelHeader
        levelTitle="System Failure Investigation"
        activeStage="engage"
        onBackClick={onBack}
      />,
    );

    const backButton = screen.getByRole("button", { name: /back to overview/i });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);

    const overviewBtn = screen.getByText("Overview");
    fireEvent.click(overviewBtn);
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it("opens options menu and handles required actions", () => {
    const onShare = vi.fn();
    const onDownload = vi.fn();
    const onReport = vi.fn();

    render(
      <LevelHeader
        levelTitle="System Failure Investigation"
        activeStage="engage"
        onShareLink={onShare}
        onDownloadResources={onDownload}
        onReportIssue={onReport}
      />,
    );

    const optionsBtn = screen.getByTitle("More options");
    fireEvent.click(optionsBtn);

    const copyBtn = screen.getByText("Copy Link");
    fireEvent.click(copyBtn);
    expect(onShare).toHaveBeenCalledTimes(1);

    fireEvent.click(optionsBtn);
    const downloadBtn = screen.getByText("Download Resources");
    fireEvent.click(downloadBtn);
    expect(onDownload).toHaveBeenCalledTimes(1);

    fireEvent.click(optionsBtn);
    const reportBtn = screen.getByText("Report Content Issue");
    fireEvent.click(reportBtn);
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});
