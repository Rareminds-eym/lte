import type { CapabilityLevel } from "@/entities/course/api/courseApi";
import type { CourseLevelCardProps } from "../ui/CourseLevelCard";

interface LevelMeta {
  title: string;
  description: string;
  deliverables: string[];
}

const LEVEL_META = (shortTitle: string): LevelMeta[] => [
  {
    title: `Guided ${shortTitle} & Core Foundations`,
    description: `Identify key parameters, execute structured workflows, and establish foundation dashboards for ${shortTitle}.`,
    deliverables: [
      `${shortTitle} Setup Worksheet`,
      "Foundations Checklist",
      "Initial Assessment Note",
    ],
  },
  {
    title: `Applied ${shortTitle} & Implementation`,
    description: `Configure operational parameters, define threshold rules, and validate traceability for ${shortTitle}.`,
    deliverables: [`${shortTitle} Config Sheet`, "Schema Note", "Validation Report"],
  },
  {
    title: `Advanced ${shortTitle} & Root Cause Analysis`,
    description: `Perform end-to-end analysis across distributed environments and propose systemic fixes for ${shortTitle}.`,
    deliverables: [`${shortTitle} Correlation Map`, "Analysis Note", "Evidence Pack"],
  },
  {
    title: `Operational Practices & Incident Management for ${shortTitle}`,
    description: `Lead resolution processes, manage technical mitigations, and produce postmortem reviews for ${shortTitle}.`,
    deliverables: [`${shortTitle} Incident Timeline`, "Postmortem Report", "Action Plan"],
  },
  {
    title: `${shortTitle} Architecture & Systems Design`,
    description: `Architect end-to-end enterprise strategies, define metrics/SLOs, and deliver production designs for ${shortTitle}.`,
    deliverables: [
      `${shortTitle} Architecture Blueprint`,
      "SLO Definition Sheet",
      "Portfolio Pack",
    ],
  },
];

const DIFFICULTIES = ["Beginner", "Beginner", "Intermediate", "Advanced", "Advanced"];
const XP_VALUES = ["500 XP", "350 XP", "400 XP", "300 XP", "300 XP"];

/**
 * Computes level card props from active course data & capability code.
 */
export function buildDynamicLevelCards(
  capabilityCode: string,
  courseTitle: string,
  currentUnlockedLevel: number,
  parsedTargetLevelNum: number,
  totalLevels = 5,
): Omit<CourseLevelCardProps, "onAction" | "isLast">[] {
  const cleanCode = capabilityCode.replace(/[^A-Z0-9_-]/gi, "_").toUpperCase();
  const shortTitle = courseTitle.split(":")[0]?.trim() || courseTitle;

  return LEVEL_META(shortTitle)
    .slice(0, totalLevels)
    .map((meta, idx) => {
      const levelNumber = idx + 1;
      const isCompleted = levelNumber < currentUnlockedLevel;
      const isUnlocked = levelNumber === currentUnlockedLevel;
      const isLocked = levelNumber > currentUnlockedLevel;

      return {
        levelNumber,
        code: `${cleanCode}_L${levelNumber}_CL001`,
        title: meta.title,
        description: meta.description,
        status: isCompleted ? "completed" : isUnlocked ? "unlocked" : "locked",
        isTargetLevel: levelNumber === parsedTargetLevelNum,
        unlockRequirement: isLocked ? `Complete Level ${levelNumber - 1} to unlock` : undefined,
        deliverablesLabel: isCompleted ? "YOU PRODUCED" : "YOU'LL PRODUCE",
        deliverables: meta.deliverables,
        duration: "45 hours",
        xp: XP_VALUES[idx] || "350 XP",
        difficulty: DIFFICULTIES[idx] || "Intermediate",
        actionText: isCompleted ? "Review →" : isUnlocked ? "Continue →" : "Locked",
      };
    });
}

function durationLabel(minutes: number): string {
  return minutes >= 60 ? `${Math.round(minutes / 60)} hrs` : `${minutes} min`;
}

/**
 * Maps API level rows to card props. Used when a capability has real level data;
 * buildDynamicLevelCards above is the fallback while the levels table is sparsely seeded.
 */
export function mapApiLevelsToCards(
  levels: CapabilityLevel[],
  currentUnlockedLevel: number,
  parsedTargetLevelNum: number,
): Omit<CourseLevelCardProps, "onAction" | "isLast">[] {
  return levels.map((level) => {
    const isCompleted = level.levelNumber < currentUnlockedLevel;
    const isUnlocked = level.levelNumber === currentUnlockedLevel;
    const isLocked = level.levelNumber > currentUnlockedLevel;
    const difficulty = level.difficulty.charAt(0).toUpperCase() + level.difficulty.slice(1);

    return {
      levelNumber: level.levelNumber,
      code: level.code,
      title: level.title,
      description: level.description,
      status: isCompleted ? "completed" : isUnlocked ? "unlocked" : "locked",
      isTargetLevel: level.levelNumber === parsedTargetLevelNum,
      unlockRequirement: isLocked ? `Complete Level ${level.levelNumber - 1} to unlock` : undefined,
      deliverablesLabel: isCompleted ? "YOU PRODUCED" : "YOU'LL PRODUCE",
      deliverables: level.deliverables,
      duration: durationLabel(level.durationMinutes),
      difficulty,
      actionText: isCompleted ? "Review →" : isUnlocked ? "Continue →" : "Locked",
    };
  });
}
