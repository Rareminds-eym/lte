import type { CapabilityLevel } from "@/entities/course/api/courseApi";
import type { CourseLevelCardProps } from "../ui/CourseLevelCard";

function durationLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return "N/A";
  return minutes >= 60 ? `${Math.round(minutes / 60)} hrs` : `${minutes} min`;
}

/**
 * Maps API level rows from Supabase DB to card props.
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
    const difficulty = level.difficulty
      ? level.difficulty.charAt(0).toUpperCase() + level.difficulty.slice(1)
      : "Intermediate";

    return {
      levelNumber: level.levelNumber,
      code: level.code,
      title: level.title,
      description: level.description,
      status: isCompleted ? "completed" : isUnlocked ? "unlocked" : "locked",
      isTargetLevel: level.levelNumber === parsedTargetLevelNum,
      unlockRequirement: isLocked ? `Complete Level ${level.levelNumber - 1} to unlock` : undefined,
      deliverablesLabel: isCompleted ? "YOU PRODUCED" : "YOU'LL PRODUCE",
      deliverables: level.deliverables ?? [],
      duration: durationLabel(level.durationMinutes),
      difficulty,
      actionText: isCompleted ? "Review →" : isUnlocked ? "Continue →" : "Locked",
    };
  });
}
