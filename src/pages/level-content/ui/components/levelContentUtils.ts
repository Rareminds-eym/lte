import type {
  EContentItem,
  LteStage,
  ModuleArtifact,
  ModuleDetailsResponse,
  ModuleStageContent,
} from "@/entities/course";
import { isLteStageName, LTE_STAGE_SEQUENCE } from "@/entities/course";
import { DocumentIcon, LabFlaskIcon, LightningBoltIcon, PlayIcon } from "@/shared/ui";

export const LEVEL_CONTENT_UNAVAILABLE_MESSAGE =
  "This course content is not available right now. Please go back to your courses and try again.";

export const SCENARIO_COLLAPSE_CHAR_LIMIT = 280;

export const formatStageLabel = (stage: LteStage) => stage.charAt(0).toUpperCase() + stage.slice(1);

export const formatDuration = (seconds: number | null) => {
  if (!seconds) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
};

export const formatContentType = (contentType: EContentItem["contentType"]) =>
  contentType.charAt(0).toUpperCase() + contentType.slice(1);

export const getContentIcon = (contentType: EContentItem["contentType"]) => {
  if (contentType === "video" || contentType === "audio") return PlayIcon;
  return DocumentIcon;
};

export const getDownloadFileName = (item: EContentItem) => {
  const urlFileName = item.url.split("/").pop()?.split("?")[0];
  return decodeURIComponent(urlFileName || item.title).replace(/[<>:"/\\|?*]+/g, "-");
};

export const getStageSummary = (
  module: ModuleDetailsResponse,
  stageContent: ModuleStageContent,
) => {
  if (stageContent.items.length) {
    return `${stageContent.items.length} published resource${stageContent.items.length === 1 ? "" : "s"} available for this stage.`;
  }

  if (stageContent.artifacts.length) {
    return `${stageContent.artifacts.length} artifact${stageContent.artifacts.length === 1 ? "" : "s"} available for this stage.`;
  }

  return module.moduleProblemStatement ?? "No published content has been added for this stage yet.";
};

export const getPrimaryArtifact = (artifacts: ModuleArtifact[]) =>
  artifacts.find((artifact) => artifact.artifactType === "final") ?? artifacts[0] ?? null;

export const getArtifactPanelTitle = (artifact: ModuleArtifact | null) => {
  if (artifact?.artifactType === "practice") return "Practice Artifact";
  if (artifact?.artifactType === "final") return "Final Artifact";
  return "Stage Info";
};

export const getArtifactStepperMeta = (artifact: ModuleArtifact | null) => {
  if (artifact?.artifactType === "practice") {
    return { subtitle: "Practice Artifact", icon: LabFlaskIcon };
  }

  if (artifact?.artifactType === "final") {
    return { subtitle: "Final Artifact", icon: LightningBoltIcon };
  }

  return null;
};

export const getArtifactStepperMetaByType = (
  artifactType: ModuleArtifact["artifactType"] | null,
) => {
  if (artifactType === "practice") {
    return { subtitle: "Practice Artifact", icon: LabFlaskIcon };
  }

  if (artifactType === "final") {
    return { subtitle: "Final Artifact", icon: LightningBoltIcon };
  }

  return null;
};

export const getModuleStageSequence = (stages: ModuleStageContent[] | undefined) => {
  const stageNames = new Set(
    (stages ?? [])
      .map((stage) => stage.stageName.toLowerCase() as LteStage)
      .filter((stage) => isLteStageName(stage)),
  );

  return (
    stageNames.size
      ? LTE_STAGE_SEQUENCE.filter((stage) => stageNames.has(stage))
      : [...LTE_STAGE_SEQUENCE]
  ) as LteStage[];
};

export const getFirstIncompleteStage = (stages: LteStage[], completedStages: Set<LteStage>) =>
  stages.find((stage) => !completedStages.has(stage)) ?? null;

export const getCourseOverviewPath = (capabilityCode: string | undefined) =>
  capabilityCode ? `/my-courses/${encodeURIComponent(capabilityCode)}` : "/my-courses";
