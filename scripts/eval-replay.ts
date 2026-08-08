/**
 * Deterministic evaluation replay tool (Phase 3).
 *
 * Re-runs the AI evaluation for stored artifact submissions and quantifies
 * drift: stored decision/score/confidence vs today's model output on the
 * exact same input. A decision flip or a large score delta means the prompt,
 * model or validation rules moved since the learner was graded.
 *
 * Usage:
 *   npx esbuild scripts/eval-replay.ts --bundle --platform=node \
 *     --outfile=/tmp/eval-replay.js && \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENROUTER_API_KEY=... \
 *     node /tmp/eval-replay.js --submission-id <uuid> [--submission-id <uuid> ...]
 *
 * Text/URL answers are replayed from the database; file answers are excluded
 * (their content lives in R2 and cannot be re-extracted here), so evidence
 * grounded in file snippets will fail validation on replay and skew drift.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { evaluateArtifactSubmission } from "../functions/lib/artifact-evaluator";
import type { ArtifactEvaluationInput } from "../functions/lib/artifact-evaluator";

interface CliArgs {
  submissionIds: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const submissionIds: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--submission-id") {
      const value = argv[i + 1];
      if (!value) throw new Error("--submission-id requires a value");
      submissionIds.push(value);
      i += 1;
    }
  }
  if (submissionIds.length === 0) {
    throw new Error("Provide at least one --submission-id");
  }
  return { submissionIds };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

async function loadStoredObservation(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<{ decision: string; score: number; confidence: number }> {
  const { data: flow, error } = await supabase
    .from("artifact_evaluation_flows")
    .select("score, decision, metadata")
    .eq("submission_id", submissionId)
    .eq("stage", "ai")
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch stored evaluation for ${submissionId}: ${error.message}`);
  if (!flow) throw new Error(`No stored ai evaluation found for submission ${submissionId}`);

  const metadata = (flow.metadata ?? {}) as { confidence?: number };
  return {
    decision: flow.decision,
    score: flow.score ?? 0,
    confidence: metadata.confidence ?? 0,
  };
}

async function loadInput(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<ArtifactEvaluationInput> {
  const { data: submission, error: subError } = await supabase
    .from("artifact_submissions")
    .select("artifact_id, attempt_no")
    .eq("id", submissionId)
    .maybeSingle();
  if (subError) throw new Error(`Failed to fetch submission ${submissionId}: ${subError.message}`);
  if (!submission) throw new Error(`Submission ${submissionId} not found`);

  const artifactId = submission.artifact_id as string;

  const [{ data: artifact }, { data: questions }, { data: answers }] = await Promise.all([
    supabase
      .from("artifacts")
      .select("artifact_type, passing_score, total_score")
      .eq("id", artifactId)
      .maybeSingle(),
    supabase
      .from("artifact_questions")
      .select("id, title, description, response_type")
      .eq("artifact_id", artifactId),
    supabase
      .from("artifact_submission_answers")
      .select("question_id, text_response, url_response, file_name")
      .eq("submission_id", submissionId),
  ]);

  const answersByQuestion = new Map(
    (answers ?? []).map((row) => [
      row.question_id as string,
      row as { text_response?: string | null; url_response?: string | null; file_name?: string | null },
    ]),
  );

  return {
    artifactId,
    artifactType: (artifact?.artifact_type as "practice" | "final") ?? "final",
    passingScore: (artifact?.passing_score as number | null) ?? 60,
    totalScore: (artifact?.total_score as number | null) ?? 100,
    questions: (questions ?? []).map((q) => ({
      id: q.id as string,
      title: (q.title as string) ?? "Untitled",
      description: (q.description as string | null) ?? "",
      responseType: (q.response_type as "text" | "url" | "file") ?? "text",
    })),
    answers: (questions ?? [])
      .map((q) => {
        const answer = answersByQuestion.get(q.id as string);
        if (!answer) return null;
        const textResponse = answer.text_response?.trim();
        const urlResponse = answer.url_response?.trim();
        if (textResponse) return { questionId: q.id as string, textResponse };
        if (urlResponse) return { questionId: q.id as string, urlResponse };
        if (answer.file_name) return { questionId: q.id as string, fileName: answer.file_name };
        return null;
      })
      .filter((answer): answer is NonNullable<typeof answer> => answer !== null),
    attemptNo: (submission.attempt_no as number) ?? 1,
  };
}

async function main(): Promise<void> {
  const { submissionIds } = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
  const env = { OPENROUTER_API_KEY: requireEnv("OPENROUTER_API_KEY") };

  const stored = [];
  const replayed = [];
  for (const submissionId of submissionIds) {
    console.log(`Replaying ${submissionId}...`);
    const input = await loadInput(supabase, submissionId);
    const storedObservation = await loadStoredObservation(supabase, submissionId);
    const replayedResult = await evaluateArtifactSubmission(env, input, submissionId);

    stored.push(storedObservation);
    replayed.push({
      decision: replayedResult.decision,
      score: replayedResult.overallScore,
      confidence: replayedResult.confidence,
    });

    const flip = replayedResult.decision !== storedObservation.decision ? "  <-- DECISION FLIP" : "";
    console.log(
      `  stored:   ${storedObservation.decision} (score ${storedObservation.score}, conf ${storedObservation.confidence})`,
    );
    console.log(
      `  replayed: ${replayedResult.decision} (score ${replayedResult.overallScore}, conf ${replayedResult.confidence})${flip}`,
    );
  }

  const { computeDriftStats } = await import(
    "../functions/lib/artifact-evaluator"
  );
  const drift = computeDriftStats(stored, replayed);
  console.log("\nDrift summary:", JSON.stringify(drift, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
