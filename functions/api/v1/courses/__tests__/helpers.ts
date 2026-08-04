import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";

export interface QueryResult {
  data: unknown;
  error: unknown;
}

export interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
}

export interface ChainOptions {
  maybeSingle?: QueryResult;
  single?: QueryResult;
  thenQueue?: QueryResult[];
  insert?: QueryResult;
}

export function mockChain(options: ChainOptions = {}): MockChain {
  const chain: MockChain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    insert: vi
      .fn()
      .mockImplementation(() =>
        mockChain({ single: options.insert ?? { data: null, error: null } }),
      ),
    maybeSingle: vi.fn().mockResolvedValue(options.maybeSingle ?? { data: null, error: null }),
    single: vi.fn().mockResolvedValue(options.single ?? { data: null, error: null }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: vi.fn().mockImplementation((resolve: (value: unknown) => unknown) => {
      const result = options.thenQueue?.shift() ?? { data: null, error: null };
      return Promise.resolve(result).then(resolve);
    }),
  };
  return chain;
}

export function makeSupabase(chains: Record<string, MockChain | undefined>): SupabaseClient {
  const fallback = mockChain();
  return {
    from: vi.fn().mockImplementation((table: string) => chains[table] ?? fallback),
  } as unknown as SupabaseClient;
}

export const ok = (data: unknown): QueryResult => ({ data, error: null });
export const err = (message: string, code?: string): QueryResult => ({
  data: null,
  error: { message, ...(code ? { code } : {}) },
});

export const levelRow: {
  id: string;
  level_code: string;
  title: string;
  description: string;
  problem_statement: unknown;
  observable_behavior: unknown;
  example_outputs: unknown;
  duration_minutes: number;
  difficulty_level: string;
  status: string;
  version_no: number;
  capability_id: string | null;
  level_id: string;
} = {
  id: "level-1",
  level_code: "RCP-L1",
  title: "Level One",
  description: "Level description",
  problem_statement: null,
  observable_behavior: null,
  example_outputs: null,
  duration_minutes: 45,
  difficulty_level: "beginner",
  status: "active",
  version_no: 1,
  capability_id: "cap-1",
  level_id: "level-1",
};

export function levelChains(
  overrides: {
    level?: Partial<typeof levelRow>;
    levelResult?: QueryResult;
    capabilities?: QueryResult;
    modules?: QueryResult;
    levelProgress?: QueryResult;
    progresses?: QueryResult;
    stages?: QueryResult;
    modulesContent?: QueryResult;
    artifacts?: QueryResult;
  } = {},
): MockChains {
  const chains: MockChains = {
    levels: mockChain({
      single: overrides.levelResult ?? ok({ ...levelRow, ...overrides.level }),
    }),
    modules: mockChain({ thenQueue: [overrides.modules ?? ok([])] }),
  };
  if (overrides.levelResult === undefined) {
    chains.capabilities = mockChain({
      single: overrides.capabilities ?? ok({ code: "CAP", name: "Capability" }),
    });
  }
  chains.user_capability_level_progress = mockChain({
    maybeSingle: overrides.levelProgress ?? { data: null, error: null },
  });
  chains.user_module_progress = mockChain({
    thenQueue: [overrides.progresses ?? { data: null, error: null }],
  });
  chains.user_stage_progress = mockChain({
    thenQueue: [overrides.stages ?? { data: null, error: null }],
  });
  chains.modules_content = mockChain({
    thenQueue: [overrides.modulesContent ?? { data: null, error: null }],
  });
  chains.module_artifacts = mockChain({
    thenQueue: [overrides.artifacts ?? { data: null, error: null }],
  });
  return chains;
}

export interface MockChains extends Record<string, MockChain | undefined> {
  levels?: MockChain;
  modules?: MockChain;
  capabilities?: MockChain;
  user_capability_level_progress?: MockChain;
  user_module_progress?: MockChain;
  user_stage_progress?: MockChain;
  modules_content?: MockChain;
  module_artifacts?: MockChain;
  learning_paths?: MockChain;
  role_capability_sequence?: MockChain;
}

export const moduleRow = {
  id: "mod-1",
  level_id: "level-1",
  module_no: 2,
  title: "Module Two",
  description: "Mod desc",
  module_problem_statement: "Problem",
  pressure_points: ["pp"],
  user_confusion: ["uc"],
  industry_challenge: "ic",
  prerequisites: ["pre"],
  what_youll_learn: ["wy"],
  when_to_apply: "wta",
  support: { faq: true },
  knowledge: null,
  tools: null,
  learning_content: null,
  modules_content: [
    {
      id: "mc-1",
      stage_name: "explain",
      stage_order: 3,
      stage_description: null,
      is_active: true,
      e_content: [
        {
          id: "e-2",
          content_type: "video",
          title: "V2",
          description: "d2",
          url: "u2",
          sort_order: 2,
          duration_seconds: 200,
          xp_reward: 20,
          mime_type: "mp4",
          file_size_bytes: 2000,
          status: "published",
        },
        {
          id: "e-1",
          content_type: "video",
          title: "V1",
          description: "d1",
          url: "u1",
          sort_order: 1,
          duration_seconds: 100,
          xp_reward: 10,
          mime_type: "mp4",
          file_size_bytes: 1000,
          status: "published",
        },
      ],
      module_artifacts: [
        {
          id: "art-1",
          artifact_type: "practice",
          total_score: 10,
          passing_score: 5,
          is_active: true,
          artifact_questions: [
            { id: "q-2", question_order: 2, title: "Q2", description: "qd2", instructions: "i2" },
            { id: "q-1", question_order: 1, title: "Q1", description: "qd1", instructions: "i1" },
          ],
          artifact_templates: [
            {
              id: "t-1",
              question_id: "q-1",
              file_name: "f.pdf",
              file_url: "fu",
              file_type: "pdf",
              version: 1,
              is_downloadable: true,
            },
          ],
        },
        {
          id: "art-2",
          artifact_type: "final",
          total_score: 20,
          passing_score: 10,
          is_active: false,
          artifact_questions: [],
          artifact_templates: [],
        },
      ],
    },
    {
      id: "mc-2",
      stage_name: "engage",
      stage_order: 1,
      stage_description: "Engage desc",
      is_active: true,
      e_content: [],
      module_artifacts: null,
    },
    {
      id: "mc-3",
      stage_name: "express",
      stage_order: 4,
      stage_description: null,
      is_active: true,
      e_content: null,
      module_artifacts: [
        {
          id: "art-3",
          artifact_type: "practice",
          total_score: 5,
          passing_score: 1,
          is_active: true,
          artifact_questions: null,
          artifact_templates: null,
        },
      ],
    },
    {
      id: "mc-4",
      stage_name: "evolve",
      stage_order: 6,
      stage_description: null,
      is_active: false,
      e_content: [],
      module_artifacts: [],
    },
  ],
};

export function moduleDetailsChains(
  overrides: {
    levelResult?: QueryResult;
    moduleResult?: QueryResult;
    moduleProgress?: QueryResult;
    stagesProg?: QueryResult;
  } = {},
): MockChains {
  return {
    levels: mockChain({
      single:
        overrides.levelResult ?? ok({ id: "level-1", level_code: "RCP-L1", title: "Level One" }),
    }),
    modules: mockChain({
      single: overrides.moduleResult ?? ok(moduleRow),
    }),
    user_module_progress: mockChain({
      maybeSingle: overrides.moduleProgress ?? { data: null, error: null },
    }),
    user_stage_progress: mockChain({
      thenQueue: [overrides.stagesProg ?? { data: null, error: null }],
    }),
  };
}

export function upsertUpstream(levelCode = "RCP-L1"): MockChains {
  return {
    learning_paths: mockChain({ maybeSingle: ok({ id: "path-1", role_id: "role-1" }) }),
    levels: mockChain({
      single: ok({ id: "level-1", level_code: levelCode, capability_id: "cap-1" }),
    }),
    user_capability_level_progress: mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "lvl-prog-1" }),
    }),
    role_capability_sequence: mockChain({ maybeSingle: { data: null, error: null } }),
  };
}

export function moduleProgressChains(
  overrides: {
    modules?: QueryResult;
    existing?: QueryResult;
    insert?: QueryResult;
    thenQueue?: QueryResult[];
  } = {},
): MockChains {
  return {
    ...upsertUpstream(),
    modules: mockChain({ single: overrides.modules ?? ok({ id: "mod-1" }) }),
    user_module_progress: mockChain({
      maybeSingle: overrides.existing ?? { data: null, error: null },
      insert: overrides.insert ?? ok({ id: "mp-new" }),
      thenQueue: overrides.thenQueue,
    }),
  };
}

export const SIX_STAGES = ["engage", "explore", "explain", "express", "empower", "evolve"].map(
  (stage_name) => ({ stage_name }),
);

export function stageProgressChains(
  overrides: {
    existing?: QueryResult;
    insert?: QueryResult;
    stageThenQueue?: QueryResult[];
    modThenQueue?: QueryResult[];
  } = {},
): MockChains {
  return {
    ...upsertUpstream(),
    modules: mockChain({ single: ok({ id: "mod-1" }) }),
    user_module_progress: mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "mod-prog-1" }),
      thenQueue: overrides.modThenQueue,
    }),
    user_stage_progress: mockChain({
      maybeSingle: overrides.existing ?? { data: null, error: null },
      insert: overrides.insert ?? ok({ id: "sp-new" }),
      thenQueue: overrides.stageThenQueue,
    }),
  };
}
