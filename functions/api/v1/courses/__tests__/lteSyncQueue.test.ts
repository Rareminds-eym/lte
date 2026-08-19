import { emitStageCompletedEvent } from "@functions/api/v1/courses/lteSyncQueue";
import type { QueryGateway } from "@functions/lib/query-gateway";
import { apiLogger } from "@functions/shared/logger";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { makeGateway, mockChain, ok } from "./helpers";

type QueueSend = (msg: unknown, opts?: { contentType?: string }) => Promise<void>;

const input = {
  userId: "user-1",
  levelId: "lvl-2",
  moduleNumber: 2,
  durationSeconds: 7200,
  levelCompleted: false,
  status: "completed" as const,
};

const levelInfo = { capability_id: "cap-1", title: "Level Two" };
const capInfo = { name: "LTE Pro", code: "LTE-PRO" };
const rawLevels = [
  { id: "lvl-1", level_code: "01", title: "Level One" },
  { id: "lvl-2", level_code: "02", title: "Level Two" },
];
const levelOneModules = [{ id: "m1", level_id: "lvl-1", module_no: 1, title: "M1" }];
const levelTwoModules = [
  { id: "m2", level_id: "lvl-2", module_no: 1, title: "M2" },
  { id: "m3", level_id: "lvl-2", module_no: 2, title: "M3" },
];
const allModules = [...levelOneModules, ...levelTwoModules];

async function decompress(bytes: Uint8Array): Promise<unknown> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(await new Response(stream).arrayBuffer()));
}

interface DecompressedEvent {
  type: string;
  payload: {
    userId: string;
    lteCourseId: string;
    courseTitle: string;
    lteCourseCode?: string;
    levels?: { status: string }[];
    status: string;
    completedModules: number;
    totalModules: number;
    durationHours: number;
    totalDurationHours: number;
    resumeUrl: string;
    earnedSkills: string[];
    completedAt: string;
  };
}

describe("emitStageCompletedEvent", () => {
  let send: Mock<QueueSend>;

  beforeEach(() => {
    send = vi.fn<QueueSend>().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when the LTE_SYNC_QUEUE binding is missing", async () => {
    const qb = { read: vi.fn() } as unknown as QueryGateway;
    await emitStageCompletedEvent(qb, {}, input);
    expect(qb.read).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("emits gzipped bytes with defaults when the level has no capability", async () => {
    const qb = makeGateway({ levels: mockChain({ maybeSingle: ok(null) }) });
    const env = { LTE_SYNC_QUEUE: { send } };

    await emitStageCompletedEvent(qb, env, input);

    expect(send).toHaveBeenCalledTimes(1);
    const [msg, opts] = send.mock.calls[0] as [unknown, unknown];
    expect(opts).toEqual({ contentType: "bytes" });
    expect(msg).toBeInstanceOf(Uint8Array);

    const event = (await decompress(msg as Uint8Array)) as DecompressedEvent;
    expect(event.type).toBe("lte.module_completed");
    expect(event.payload).toMatchObject({
      userId: "user-1",
      lteCourseId: "lvl-2",
      courseTitle: "LTE Course lvl-2",
      status: "in_progress",
      completedModules: 3,
      totalModules: 0,
      durationHours: 2,
      totalDurationHours: 35,
      resumeUrl: "/my-courses/lvl-2",
      earnedSkills: ["LTE Course lvl-2"],
    });
    expect(event.payload.lteCourseCode).toBeUndefined();
    expect(event.payload.levels).toBeUndefined();
    expect(typeof event.payload.completedAt).toBe("string");
  });

  it("builds the course snapshot and emits a module_completed event", async () => {
    const qb = makeGateway({
      levels: mockChain({
        maybeSingle: ok(levelInfo),
        thenQueue: [ok(rawLevels)],
      }),
      capabilities: mockChain({ maybeSingle: ok(capInfo) }),
      user_capability_level_progress: mockChain({
        thenVal: ok([{ level_id: "lvl-1", status: "completed" }]),
      }),
      user_module_progress: mockChain({
        thenVal: ok([{ module_id: "m1", module_status: "completed", completion_percentage: 100 }]),
      }),
      modules: mockChain({
        thenVal: ok(allModules),
      }),
    });
    const env = { LTE_SYNC_QUEUE: { send } };

    await emitStageCompletedEvent(qb, env, input);

    const [msg] = send.mock.calls[0] as [unknown, unknown];
    const event = (await decompress(msg as Uint8Array)) as DecompressedEvent;
    expect(event.type).toBe("lte.module_completed");
    expect(event.payload).toMatchObject({
      lteCourseId: "cap-1",
      courseTitle: "LTE Pro",
      lteCourseCode: "LTE-PRO",
      status: "in_progress",
      completedModules: 3,
      totalModules: 3,
      durationHours: 2,
      totalDurationHours: 14,
      resumeUrl: "/my-courses/LTE-PRO",
      earnedSkills: ["LTE Pro"],
    });
    expect(event.payload.levels).toEqual([
      {
        id: "lvl-1",
        code: "01",
        title: "Level One",
        status: "completed",
        completionPercentage: 100,
        totalModules: 1,
        completedModules: 1,
        modules: [{ id: "m1", title: "M1", status: "completed", completionPercentage: 100 }],
      },
      {
        id: "lvl-2",
        code: "02",
        title: "Level Two",
        status: "in_progress",
        completionPercentage: 100,
        totalModules: 2,
        completedModules: 2,
        modules: [
          { id: "m2", title: "M2", status: "completed", completionPercentage: 100 },
          { id: "m3", title: "M3", status: "completed", completionPercentage: 100 },
        ],
      },
    ]);
  });

  it("emits a level_completed event when every level is completed", async () => {
    const qb = makeGateway({
      levels: mockChain({
        maybeSingle: ok(levelInfo),
        thenQueue: [ok(rawLevels)],
      }),
      capabilities: mockChain({ maybeSingle: ok(capInfo) }),
      user_capability_level_progress: mockChain({
        thenVal: ok([
          { level_id: "lvl-1", status: "completed" },
          { level_id: "lvl-2", status: "completed" },
        ]),
      }),
      user_module_progress: mockChain({ thenVal: ok(null) }),
      modules: mockChain({
        thenVal: ok(allModules),
      }),
    });
    const env = { LTE_SYNC_QUEUE: { send } };

    await emitStageCompletedEvent(qb, env, { ...input, levelCompleted: true });

    const [msg] = send.mock.calls[0] as [unknown, unknown];
    const event = (await decompress(msg as Uint8Array)) as DecompressedEvent;
    expect(event.type).toBe("lte.level_completed");
    expect(event.payload.status).toBe("completed");
    expect(event.payload.levels?.every((l) => l.status === "completed")).toBe(true);
  });

  it("falls back to sending JSON when the bytes send fails", async () => {
    send.mockRejectedValueOnce(new Error("bytes rejected")).mockResolvedValueOnce(undefined);
    const qb = makeGateway({ levels: mockChain({ maybeSingle: ok(null) }) });
    const env = { LTE_SYNC_QUEUE: { send } };

    await emitStageCompletedEvent(qb, env, input);

    expect(send).toHaveBeenCalledTimes(2);
    const firstCall = send.mock.calls[0] as [unknown, { contentType?: string }];
    const secondCall = send.mock.calls[1] as [unknown, { contentType?: string }];
    expect(firstCall[0]).toBeInstanceOf(Uint8Array);
    expect(firstCall[1]).toEqual({ contentType: "bytes" });
    expect(secondCall[0]).toEqual(expect.objectContaining({ type: "lte.module_completed" }));
    expect(secondCall[1]).toEqual({ contentType: "json" });
  });

  it("fails soft without throwing or sending when DB reads error", async () => {
    const qb = { read: vi.fn().mockRejectedValue(new Error("db down")) } as unknown as QueryGateway;
    const env = { LTE_SYNC_QUEUE: { send } };
    const errorSpy = vi.spyOn(apiLogger, "error").mockImplementation(() => undefined);

    await expect(emitStageCompletedEvent(qb, env, input)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to emit to LTE_SYNC_QUEUE",
      expect.any(Error),
      {},
    );
  });
});
