import { extractArtifactContent } from "@functions/lib/artifact-evaluator";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchArtifactTemplateContent, fetchEvaluationContext } from "../evaluation-context";

vi.mock("@functions/lib/artifact-evaluator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/artifact-evaluator")>();
  return { ...actual, extractArtifactContent: vi.fn() };
});

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

const ok = (data: unknown): QueryResult => ({ data, error: null });
const err = (message: string): QueryResult => ({ data: null, error: { message } });

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

function mockChain(
  options: { single?: QueryResult; maybeSingle?: QueryResult; thenVal?: QueryResult } = {},
) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(options.single ?? ok(null)),
    maybeSingle: vi.fn().mockResolvedValue(options.maybeSingle ?? ok(null)),
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    then: vi.fn((resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(options.thenVal ?? ok(null)).then(resolve),
    ),
  };
  return chain as MockChain;
}

function createSupabase(chains: Record<string, MockChain>): SupabaseClient {
  return {
    from: vi.fn((table: string) => chains[table] ?? mockChain()),
  } as unknown as SupabaseClient;
}

describe("fetchEvaluationContext", () => {
  it("returns undefined when the artifact is not found", async () => {
    const supabase = createSupabase({
      module_artifacts: mockChain({ single: err("not found") }),
    });
    await expect(fetchEvaluationContext(supabase, "artifact-1")).resolves.toBeUndefined();
  });

  it("returns undefined when the artifact has no modules_content_id", async () => {
    const supabase = createSupabase({
      module_artifacts: mockChain({ single: ok({ id: "artifact-1" }) }),
    });
    await expect(fetchEvaluationContext(supabase, "artifact-1")).resolves.toBeUndefined();
  });

  it("assembles the full context chain when every lookup succeeds", async () => {
    const supabase = createSupabase({
      module_artifacts: mockChain({ single: ok({ id: "artifact-1", modules_content_id: "mc-1" }) }),
      modules_content: mockChain({
        single: ok({ id: "mc-1", module_id: "module-1", stage_name: "Analyze", stage_order: 2 }),
      }),
      modules: mockChain({
        single: ok({
          id: "module-1",
          level_id: "level-1",
          module_no: 3,
          title: "Risk Review",
          module_problem_statement: "Assess risks",
          pressure_points: ["audit", "controls"],
          what_youll_learn: ["frameworks"],
        }),
      }),
      levels: mockChain({
        maybeSingle: ok({
          id: "level-1",
          capability_id: "cap-1",
          title: "Level 3",
          problem_statement: { title: "PS", description: "Problem" },
          observable_behavior: "Observe",
        }),
      }),
      capabilities: mockChain({ maybeSingle: ok({ code: "CAP-3", name: "Capability" }) }),
    });

    const result = await fetchEvaluationContext(supabase, "artifact-1");

    expect(result).toMatchObject({
      capabilityCode: "CAP-3",
      levelTitle: "Level 3",
      levelProblemStatement: { title: "PS", description: "Problem" },
      moduleNo: 3,
      moduleTitle: "Risk Review",
      stageName: "Analyze",
      stageOrder: 2,
      pressurePoints: ["audit", "controls"],
      whatYoullLearn: ["frameworks"],
    });
  });

  it("parses a string problem_statement", async () => {
    const supabase = createSupabase({
      module_artifacts: mockChain({ single: ok({ id: "a", modules_content_id: "mc-1" }) }),
      modules_content: mockChain({ single: ok({ id: "mc-1", module_id: "m-1" }) }),
      modules: mockChain({ single: ok({ id: "m-1", level_id: "l-1", module_no: 1 }) }),
      levels: mockChain({
        maybeSingle: ok({
          id: "l-1",
          capability_id: null,
          title: "Level",
          problem_statement: "Plain text problem",
        }),
      }),
    });

    const result = await fetchEvaluationContext(supabase, "artifact-1");
    expect(result?.levelProblemStatement).toEqual({
      title: "Level",
      description: "Plain text problem",
    });
  });

  it("logs and degrades gracefully when the level query errors", async () => {
    const supabase = createSupabase({
      module_artifacts: mockChain({ single: ok({ id: "a", modules_content_id: "mc-1" }) }),
      modules_content: mockChain({ single: ok({ id: "mc-1", module_id: "m-1" }) }),
      modules: mockChain({ single: ok({ id: "m-1", level_id: "l-1" }) }),
      levels: mockChain({ maybeSingle: err("levels down") }),
    });

    const result = await fetchEvaluationContext(supabase, "artifact-1");
    // The level is optional context: a query failure must not fail the call.
    expect(result).toBeDefined();
    expect(result?.levelTitle).toBeUndefined();
  });

  it("returns undefined when the modules_content query errors", async () => {
    const supabase = createSupabase({
      module_artifacts: mockChain({ single: ok({ id: "a", modules_content_id: "mc-1" }) }),
      modules_content: mockChain({ single: err("mc down") }),
    });
    await expect(fetchEvaluationContext(supabase, "artifact-1")).resolves.toBeUndefined();
  });

  it("returns undefined when the modules_content has no module_id", async () => {
    const supabase = createSupabase({
      module_artifacts: mockChain({ single: ok({ id: "a", modules_content_id: "mc-1" }) }),
      modules_content: mockChain({ single: ok({ id: "mc-1" }) }),
    });
    await expect(fetchEvaluationContext(supabase, "artifact-1")).resolves.toBeUndefined();
  });
});

describe("fetchArtifactTemplateContent", () => {
  const stubTemplateFetch = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4])))),
    );

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(extractArtifactContent).mockReset();
  });

  it("returns an empty map when no templates exist", async () => {
    const supabase = createSupabase({ artifact_templates: mockChain({ thenVal: ok([]) }) });
    await expect(fetchArtifactTemplateContent(supabase, "artifact-1")).resolves.toEqual(new Map());
  });

  it("skips non-https URLs, images and videos", async () => {
    const supabase = createSupabase({
      artifact_templates: mockChain({
        thenVal: ok([
          { id: "t1", question_id: null, file_url: "http://insecure.example/x.docx" },
          { id: "t2", question_id: null, file_url: "https://ok.example/x.png", file_type: "image" },
          { id: "t3", question_id: null, file_url: "https://ok.example/x.mp4", file_type: "video" },
        ]),
      }),
    });

    await expect(fetchArtifactTemplateContent(supabase, "artifact-1")).resolves.toEqual(new Map());
    expect(extractArtifactContent).not.toHaveBeenCalled();
  });

  it("extracts readable templates and keeps the first version per question", async () => {
    stubTemplateFetch();
    vi.mocked(extractArtifactContent).mockResolvedValue({
      isReadable: true,
      extractedText: "template body",
      format: "docx",
    } as Awaited<ReturnType<typeof extractArtifactContent>>);
    const supabase = createSupabase({
      artifact_templates: mockChain({
        thenVal: ok([
          {
            id: "t1",
            question_id: "q-1",
            file_name: "v2.docx",
            file_url: "https://ok.example/v2.docx",
            file_type: "docx",
          },
          {
            id: "t0",
            question_id: "q-1",
            file_name: "v1.docx",
            file_url: "https://ok.example/v1.docx",
            file_type: "docx",
          },
          {
            id: "t2",
            question_id: null,
            file_name: "global.docx",
            file_url: "https://ok.example/global.docx",
            file_type: "docx",
          },
        ]),
      }),
    });

    const result = await fetchArtifactTemplateContent(supabase, "artifact-1");

    expect(result.get("q-1")).toBe("template body");
    expect(result.get("__artifact__")).toBe("template body");
    expect(vi.mocked(extractArtifactContent)).toHaveBeenCalledTimes(2);
  });

  it("ignores unreadable templates", async () => {
    stubTemplateFetch();
    vi.mocked(extractArtifactContent).mockResolvedValue({
      isReadable: false,
      extractedText: "",
      format: "corrupt",
    } as Awaited<ReturnType<typeof extractArtifactContent>>);
    const supabase = createSupabase({
      artifact_templates: mockChain({
        thenVal: ok([
          { id: "t1", question_id: null, file_url: "https://ok.example/x.docx", file_type: "docx" },
        ]),
      }),
    });

    await expect(fetchArtifactTemplateContent(supabase, "artifact-1")).resolves.toEqual(new Map());
  });

  it("skips templates whose text extraction is empty", async () => {
    stubTemplateFetch();
    vi.mocked(extractArtifactContent).mockResolvedValue({
      isReadable: true,
      extractedText: "   ",
      format: "docx",
    } as Awaited<ReturnType<typeof extractArtifactContent>>);
    const supabase = createSupabase({
      artifact_templates: mockChain({
        thenVal: ok([
          { id: "t1", question_id: null, file_url: "https://ok.example/x.docx", file_type: "docx" },
        ]),
      }),
    });

    await expect(fetchArtifactTemplateContent(supabase, "artifact-1")).resolves.toEqual(new Map());
  });

  it("skips templates whose fetch fails and keeps extracting the rest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes("broken")
          ? Promise.reject(new TypeError("boom"))
          : Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4]))),
      ),
    );
    vi.mocked(extractArtifactContent).mockResolvedValue({
      isReadable: true,
      extractedText: "template body",
      format: "docx",
    } as Awaited<ReturnType<typeof extractArtifactContent>>);
    const supabase = createSupabase({
      artifact_templates: mockChain({
        thenVal: ok([
          {
            id: "t1",
            question_id: "q-1",
            file_url: "https://ok.example/broken.docx",
            file_type: "docx",
          },
          {
            id: "t2",
            question_id: null,
            file_url: "https://ok.example/good.docx",
            file_type: "docx",
          },
        ]),
      }),
    });

    const result = await fetchArtifactTemplateContent(supabase, "artifact-1");
    expect(result.get("q-1")).toBeUndefined();
    expect(result.get("__artifact__")).toBe("template body");
  });

  it("returns an empty map when the template query errors", async () => {
    const supabase = createSupabase({
      artifact_templates: mockChain({ thenVal: err("templates down") }),
    });
    await expect(fetchArtifactTemplateContent(supabase, "artifact-1")).resolves.toEqual(new Map());
    expect(extractArtifactContent).not.toHaveBeenCalled();
  });
});
