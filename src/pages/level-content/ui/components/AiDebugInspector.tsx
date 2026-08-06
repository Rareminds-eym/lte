import { useState } from "react";
import type { AIDebugTelemetry } from "@/../functions/lib/ai-engine/types";
import { CheckIcon } from "@/shared/ui";

interface AiDebugInspectorProps {
  telemetry?: AIDebugTelemetry;
}

export function AiDebugInspector({ telemetry }: AiDebugInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "prompt" | "response" | "stages">(
    "summary",
  );
  const [copied, setCopied] = useState(false);

  if (!telemetry) return null;

  const handleCopyDebugData = () => {
    void navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-amber-300 bg-amber-50/70 p-4 font-mono text-xs text-amber-950 shadow-xs dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 font-bold text-amber-900 hover:text-amber-700 cursor-pointer dark:text-amber-300"
        >
          <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-900 dark:bg-amber-800 dark:text-amber-100">
            🐞 Dev AI Inspector
          </span>
          <span>
            {telemetry.modelUsed} ({telemetry.latencyMs}ms)
          </span>
          <svg
            aria-hidden="true"
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleCopyDebugData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 font-sans text-xs font-semibold text-amber-900 hover:bg-amber-200 transition-colors cursor-pointer dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
        >
          {copied ? (
            <CheckIcon size={13} className="text-emerald-600" />
          ) : (
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012-2v-8a2 2 0 01-2-2h-8a2 2 0 01-2 2v8a2 2 0 012 2z"
              />
            </svg>
          )}
          {copied ? "Copied!" : "Copy Debug JSON"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3 border-t border-amber-200 pt-3 dark:border-amber-800/60">
          <div className="flex items-center gap-2 border-b border-amber-200 pb-2 dark:border-amber-800">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "summary"
                  ? "bg-amber-200 font-bold text-amber-950 dark:bg-amber-800 dark:text-white"
                  : "text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prompt")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "prompt"
                  ? "bg-amber-200 font-bold text-amber-950 dark:bg-amber-800 dark:text-white"
                  : "text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              }`}
            >
              System Prompt & Payload
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("response")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "response"
                  ? "bg-amber-200 font-bold text-amber-950 dark:bg-amber-800 dark:text-white"
                  : "text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              }`}
            >
              Raw Response
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stages")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "stages"
                  ? "bg-amber-200 font-bold text-amber-950 dark:bg-amber-800 dark:text-white"
                  : "text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              }`}
            >
              Stage Checks
            </button>
          </div>

          {activeTab === "summary" && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-amber-100/50 p-3 dark:bg-amber-950/40">
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-400">Provider:</span>{" "}
                {telemetry.provider}
              </div>
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-400">
                  Model Slug:
                </span>{" "}
                {telemetry.modelUsed}
              </div>
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-400">
                  Execution Latency:
                </span>{" "}
                {telemetry.latencyMs} ms
              </div>
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-400">
                  Decision Outcome:
                </span>{" "}
                {telemetry.validatedDecision}
              </div>
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-400">
                  Decision Override:
                </span>{" "}
                {telemetry.wasDecisionOverridden ? "⚠️ Yes (False-Positive Prevented)" : "No"}
              </div>
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-400">
                  Calculated XP:
                </span>{" "}
                +{telemetry.calculatedXp} XP
              </div>
            </div>
          )}

          {activeTab === "prompt" && (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-amber-950 p-3 font-mono text-[11px] text-amber-100">
              {telemetry.rawPromptContent}
            </pre>
          )}

          {activeTab === "response" && (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-amber-950 p-3 font-mono text-[11px] text-amber-100">
              {telemetry.rawResponseContent}
            </pre>
          )}

          {activeTab === "stages" && (
            <div className="space-y-2">
              <div className="rounded-lg bg-amber-100/60 p-2.5 dark:bg-amber-950/50">
                <div className="font-bold text-amber-900 dark:text-amber-300">
                  Stage 1 - Submission Check
                </div>
                <div>Assessable: {telemetry.stage1Check.isAssessable ? "Yes" : "No"}</div>
                <div>Notes: {telemetry.stage1Check.notes}</div>
              </div>

              <div className="rounded-lg bg-amber-100/60 p-2.5 dark:bg-amber-950/50">
                <div className="font-bold text-amber-900 dark:text-amber-300">
                  Stage 2 - Critical Failure Checks
                </div>
                <div>Has Failure: {telemetry.stage2Failures.hasFailure ? "⚠️ YES" : "None"}</div>
                {telemetry.stage2Failures.failuresFound.length > 0 && (
                  <div className="text-rose-700 dark:text-rose-400">
                    Failures: {telemetry.stage2Failures.failuresFound.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
