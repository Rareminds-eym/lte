import { describe, expect, it } from "vitest";
import type { CapabilityLevel } from "@/entities/course/api/courseApi";
import { mapApiLevelsToCards } from "@/pages/course-detail/model/dynamicLevels";

describe("mapApiLevelsToCards", () => {
  const mockLevels: CapabilityLevel[] = [
    {
      id: "lvl-1",
      levelNumber: 1,
      code: "HTT_L1_CL001",
      title: "Level 1 Title",
      description: "Level 1 Description",
      deliverables: ["Deliverable 1"],
      durationMinutes: 2700,
      difficulty: "beginner",
      status: "published",
      totalXp: 350,
    },
    {
      id: "lvl-2",
      levelNumber: 2,
      code: "HTT_L2_CL001",
      title: "Level 2 Title",
      description: "Level 2 Description",
      deliverables: ["Deliverable 2"],
      durationMinutes: 2700,
      difficulty: "beginner",
      status: "published",
      totalXp: 350,
    },
  ];

  it("maps capability levels to course level cards including XP", () => {
    const cards = mapApiLevelsToCards(mockLevels, 2, 3);
    expect(cards).toHaveLength(2);

    expect(cards[0]).toEqual({
      id: "lvl-1",
      levelNumber: 1,
      code: "HTT_L1_CL001",
      title: "Level 1 Title",
      description: "Level 1 Description",
      status: "completed",
      isTargetLevel: false,
      deliverablesLabel: "YOU PRODUCED",
      deliverables: ["Deliverable 1"],
      duration: "45 hrs",
      xp: "350 XP",
      difficulty: "Beginner",
      actionText: "Review →",
    });

    expect(cards[1]).toEqual({
      id: "lvl-2",
      levelNumber: 2,
      code: "HTT_L2_CL001",
      title: "Level 2 Title",
      description: "Level 2 Description",
      status: "unlocked",
      isTargetLevel: false,
      deliverablesLabel: "YOU'LL PRODUCE",
      deliverables: ["Deliverable 2"],
      duration: "45 hrs",
      xp: "350 XP",
      difficulty: "Beginner",
      actionText: "Start →",
    });
  });

  it("shows '0 XP' when totalXp is 0", () => {
    const levels: CapabilityLevel[] = [
      {
        id: "lvl-3",
        levelNumber: 3,
        code: "HTT_L3_CL001",
        title: "Locked Level",
        description: "Not yet unlocked",
        deliverables: [],
        durationMinutes: 0,
        difficulty: "advanced",
        status: "published",
        totalXp: 0,
      },
    ];
    const cards = mapApiLevelsToCards(levels, 1, 3);
    expect(cards[0]?.xp).toBe("0 XP");
    expect(cards[0]?.status).toBe("locked");
    expect(cards[0]?.actionText).toBe("Locked");
  });

  it("marks isTargetLevel=true for the correct level number", () => {
    const cards = mapApiLevelsToCards(mockLevels, 1, 2);
    expect(cards[0]?.isTargetLevel).toBe(false);
    expect(cards[1]?.isTargetLevel).toBe(true);
  });

  it("formats duration in minutes correctly", () => {
    const levels: CapabilityLevel[] = [
      {
        id: "lvl-1",
        levelNumber: 1,
        code: "L1",
        title: "T",
        description: "D",
        deliverables: [],
        durationMinutes: 45,
        difficulty: "beginner",
        status: "published",
        totalXp: 10,
      },
    ];
    const cards = mapApiLevelsToCards(levels, 1, 1);
    expect(cards[0]?.duration).toBe("45 min");
  });
});
