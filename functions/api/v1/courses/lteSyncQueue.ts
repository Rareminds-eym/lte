import type { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { apiLogger } from "@functions/shared/logger";

type QueryGateway = ReturnType<typeof createServiceQueryGateway>;

interface QueueSender {
  send(msg: unknown, opts?: { contentType?: string }): Promise<void>;
}

interface LevelInfoRow {
  capability_id: string | null;
  title: string;
}

interface CapabilityRow {
  name: string;
  code: string;
}

interface LevelProgressRow {
  level_id: string;
  status: string;
}

interface ModuleProgressRow {
  module_id: string;
  module_status: string;
  completion_percentage: number | null;
}

interface LevelRow {
  id: string;
  level_code: string;
  title?: string | null;
}

interface ModuleRow {
  id: string;
  module_no: number;
  title: string;
}

type LevelStatus = "completed" | "in_progress" | "not_started";

interface LevelModulePayload {
  id: string;
  title: string;
  status: LevelStatus;
  completionPercentage: number;
}

interface LevelPayload {
  id: string;
  code: string;
  title: string;
  status: LevelStatus;
  completionPercentage: number;
  totalModules: number;
  completedModules: number;
  modules: LevelModulePayload[];
}

interface CourseSnapshot {
  lteCourseId: string;
  courseTitle: string;
  lteCourseCode?: string;
  levels?: LevelPayload[];
  isCourseCompleted: boolean;
  completedModules: number;
  totalModules: number;
  totalDurationHours: number;
}

interface EmitStageCompletedEventInput {
  userId: string;
  levelId: string;
  moduleNumber: number;
  durationSeconds?: number;
  levelCompleted: boolean;
  status: "in_progress" | "completed";
}

const levelCapabilityInfoReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["id", "capability_id", "title"],
  filters: ["id"],
} as const;

const capabilitySummaryReadPolicy = {
  table: "capabilities",
  operation: "read",
  columns: ["id", "name", "code"],
  filters: ["id"],
} as const;

const capabilityLevelsReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["id", "capability_id", "level_code", "title", "duration_minutes"],
  filters: ["capability_id"],
} as const;

const levelModulesReadPolicy = {
  table: "modules",
  operation: "read",
  columns: ["id", "level_id", "module_no", "title"],
  filters: ["level_id"],
} as const;

const allUserLevelsProgressReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["level_id", "status"],
  filters: ["user_id"],
} as const;

const allUserModulesProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["module_id", "module_status", "completion_percentage"],
  filters: ["user_id"],
} as const;

export async function compressQueueMessage(message: unknown): Promise<Uint8Array> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(message));
  const stream = new Response(jsonBytes).body!.pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function buildCourseSnapshot(
  qb: QueryGateway,
  input: EmitStageCompletedEventInput,
): Promise<CourseSnapshot> {
  let courseTitle = `LTE Course ${input.levelId}`;
  let lteCourseId = input.levelId;
  let lteCourseCode: string | undefined;
  let levelsPayload: LevelPayload[] | undefined;
  let resolvedTotalModules = 0;
  let resolvedCompletedModules = input.moduleNumber + 1;

  const levelInfo = (await qb.read(levelCapabilityInfoReadPolicy, {
    filters: [{ column: "id", op: "eq", value: input.levelId }],
    result: "maybeSingle",
  })) as LevelInfoRow | null;

  if (levelInfo?.capability_id) {
    lteCourseId = levelInfo.capability_id;
    const capInfo = (await qb.read(capabilitySummaryReadPolicy, {
      filters: [{ column: "id", op: "eq", value: levelInfo.capability_id }],
      result: "maybeSingle",
    })) as CapabilityRow | null;

    if (capInfo?.name) {
      courseTitle = capInfo.name;
      lteCourseCode = capInfo.code;
    }

    const userLevelsProgress = (await qb.read(allUserLevelsProgressReadPolicy, {
      filters: [{ column: "user_id", op: "eq", value: input.userId }],
    })) as LevelProgressRow[] | null;

    const userModulesProgress = (await qb.read(allUserModulesProgressReadPolicy, {
      filters: [{ column: "user_id", op: "eq", value: input.userId }],
    })) as ModuleProgressRow[] | null;

    const levelDbMap = new Map((userLevelsProgress ?? []).map((p) => [p.level_id, p.status]));
    const modDbMap = new Map((userModulesProgress ?? []).map((m) => [m.module_id, m]));

    const rawLevels = (await qb.read(capabilityLevelsReadPolicy, {
      filters: [{ column: "capability_id", op: "eq", value: levelInfo.capability_id }],
    })) as LevelRow[] | null;

    if (rawLevels && rawLevels.length > 0) {
      const sortedLevels = [...rawLevels].sort((a, b) => a.level_code.localeCompare(b.level_code));
      const currentIndex = Math.max(
        0,
        sortedLevels.findIndex((l) => l.id === input.levelId),
      );

      levelsPayload = [];
      let i = 0;
      for (const lvl of sortedLevels) {
        const rawMods = (await qb.read(levelModulesReadPolicy, {
          filters: [{ column: "level_id", op: "eq", value: lvl.id }],
        })) as ModuleRow[] | null;

        const isCurrent = lvl.id === input.levelId;
        const totalCount = rawMods?.length ?? 0;
        const isCompletedStatus = input.status === "completed";

        const dbStatus = levelDbMap.get(lvl.id);
        let levelStatus: LevelStatus = "not_started";
        if (isCurrent) {
          levelStatus = input.levelCompleted ? "completed" : "in_progress";
        } else if (dbStatus === "completed" || i < currentIndex) {
          levelStatus = "completed";
        } else if (dbStatus === "in_progress") {
          levelStatus = "in_progress";
        }

        const modules = (rawMods ?? [])
          .sort((a, b) => a.module_no - b.module_no)
          .map((m): LevelModulePayload => {
            const mDb = modDbMap.get(m.id);
            let mDone = false;
            let mInProgress = false;

            if (mDb) {
              mDone = mDb.module_status === "completed";
              mInProgress = mDb.module_status === "in_progress";
            } else if (isCurrent) {
              mDone =
                m.module_no < input.moduleNumber ||
                (m.module_no === input.moduleNumber && isCompletedStatus);
              mInProgress = m.module_no === input.moduleNumber && !isCompletedStatus;
            } else if (levelStatus === "completed") {
              mDone = true;
            }

            return {
              id: m.id,
              title: m.title,
              status: mDone ? "completed" : mInProgress ? "in_progress" : "not_started",
              completionPercentage: mDone
                ? 100
                : mInProgress
                  ? (mDb?.completion_percentage ?? 50)
                  : 0,
            };
          });

        const completedCount = modules.filter((m) => m.status === "completed").length;

        if (isCurrent) {
          resolvedTotalModules = totalCount;
          resolvedCompletedModules = completedCount;
        }

        const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        levelsPayload.push({
          id: lvl.id,
          code: lvl.level_code,
          title: lvl.title ?? lvl.level_code,
          status: levelStatus,
          completionPercentage: completionPct,
          totalModules: totalCount,
          completedModules: completedCount,
          modules,
        });
        i++;
      }
    }
  }

  const hasLevelsPayload = levelsPayload && levelsPayload.length > 0;
  const isCourseCompleted = hasLevelsPayload
    ? levelsPayload!.every((l) => l.status === "completed")
    : input.levelCompleted;

  const completedModules = hasLevelsPayload
    ? levelsPayload!.reduce((sum, l) => sum + l.completedModules, 0)
    : resolvedCompletedModules;

  const totalModules = hasLevelsPayload
    ? levelsPayload!.reduce((sum, l) => sum + l.totalModules, 0)
    : resolvedTotalModules;

  const totalDurationHours = hasLevelsPayload ? Math.round((levelsPayload!.length * 420) / 60) : 35;

  return {
    lteCourseId,
    courseTitle,
    lteCourseCode,
    levels: levelsPayload,
    isCourseCompleted,
    completedModules,
    totalModules,
    totalDurationHours,
  };
}

export async function emitStageCompletedEvent(
  qb: QueryGateway,
  env: unknown,
  input: EmitStageCompletedEventInput,
): Promise<void> {
  const lteQueue = (env as { LTE_SYNC_QUEUE?: QueueSender }).LTE_SYNC_QUEUE;
  if (!lteQueue) return;

  try {
    const snapshot = await buildCourseSnapshot(qb, input);
    const resumeUrl = `/my-courses/${snapshot.lteCourseCode || snapshot.lteCourseId}`;

    const eventMessage = {
      type: snapshot.isCourseCompleted ? "lte.level_completed" : "lte.module_completed",
      payload: {
        userId: input.userId,
        lteCourseId: snapshot.lteCourseId,
        courseTitle: snapshot.courseTitle,
        lteCourseCode: snapshot.lteCourseCode,
        levels: snapshot.levels,
        status: snapshot.isCourseCompleted ? "completed" : "in_progress",
        completedModules: snapshot.completedModules,
        totalModules: snapshot.totalModules,
        durationHours: Math.round((input.durationSeconds ?? 0) / 3600),
        totalDurationHours: snapshot.totalDurationHours,
        resumeUrl,
        earnedSkills: [snapshot.courseTitle],
        completedAt: new Date().toISOString(),
      },
    };

    try {
      const compressedBytes = await compressQueueMessage(eventMessage);
      await lteQueue.send(compressedBytes, { contentType: "bytes" });
    } catch {
      await lteQueue.send(eventMessage, { contentType: "json" });
    }
  } catch (queueErr) {
    // Fail-soft: Queue errors never crash the user's HTTP response
    apiLogger.error("Failed to emit to LTE_SYNC_QUEUE", queueErr, {});
  }
}
