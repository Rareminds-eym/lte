import { useState } from "react";
import type { AIDebugTelemetry } from "@/../functions/lib/artifact-evaluator";
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
  const [promptCopied, setPromptCopied] = useState(false);
  const [responseCopied, setResponseCopied] = useState(false);

  if (!telemetry) return null;

  const handleCopyDebugData = () => {
    void navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPrompt = () => {
    void navigator.clipboard.writeText(telemetry.rawPromptContent ?? "");
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleCopyResponse = () => {
    void navigator.clipboard.writeText(telemetry.rawResponseContent ?? "");
    setResponseCopied(true);
    setTimeout(() => setResponseCopied(false), 2000);
  };

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-line-default bg-surface-primary p-4 font-mono text-xs text-content-primary shadow-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 font-bold text-content-primary hover:text-warning-600 cursor-pointer"
        >
          <span className="rounded-md bg-warning-100 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-warning-700">
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-default bg-surface-secondary px-2.5 py-1 font-sans text-xs font-semibold text-content-secondary hover:bg-surface-muted transition-colors cursor-pointer"
        >
          {copied ? <CheckIcon size={13} className="text-emerald-600" /> : <CopyIcon />}
          {copied ? "Copied!" : "Copy Debug JSON"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3 border-t border-line-subtle pt-3">
          <div className="flex items-center gap-2 border-b border-line-subtle pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "summary"
                  ? "bg-warning-100 font-bold text-warning-800"
                  : "text-content-secondary hover:bg-surface-muted"
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prompt")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "prompt"
                  ? "bg-warning-100 font-bold text-warning-800"
                  : "text-content-secondary hover:bg-surface-muted"
              }`}
            >
              System Prompt & Payload
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("response")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "response"
                  ? "bg-warning-100 font-bold text-warning-800"
                  : "text-content-secondary hover:bg-surface-muted"
              }`}
            >
              Raw Response
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stages")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                activeTab === "stages"
                  ? "bg-warning-100 font-bold text-warning-800"
                  : "text-content-secondary hover:bg-surface-muted"
              }`}
            >
              Stage Checks
            </button>
          </div>

          {activeTab === "summary" && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-muted p-3">
              <div>
                <span className="font-semibold text-content-secondary">Provider:</span>{" "}
                {telemetry.provider}
              </div>
              <div>
                <span className="font-semibold text-content-secondary">Model Slug:</span>{" "}
                {telemetry.modelUsed}
              </div>
              <div>
                <span className="font-semibold text-content-secondary">Execution Latency:</span>{" "}
                {telemetry.latencyMs} ms
              </div>
              <div>
                <span className="font-semibold text-content-secondary">Decision Outcome:</span>{" "}
                {telemetry.validatedDecision}
              </div>
              <div>
                <span className="font-semibold text-content-secondary">Decision Override:</span>{" "}
                {telemetry.wasDecisionOverridden ? "⚠️ Yes (False-Positive Prevented)" : "No"}
              </div>
              <div>
                <span className="font-semibold text-content-secondary">Calculated XP:</span> +
                {telemetry.calculatedXp} XP
              </div>
            </div>
          )}

          {activeTab === "prompt" && (
            <div className="space-y-1.5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={telemetry.rawPromptContent === null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-default bg-surface-secondary px-2.5 py-1 font-sans text-xs font-semibold text-content-secondary hover:bg-surface-muted transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {promptCopied ? (
                    <CheckIcon size={13} className="text-emerald-600" />
                  ) : (
                    <CopyIcon />
                  )}
                  {promptCopied ? "Copied!" : "Copy Prompt"}
                </button>
              </div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-content-primary p-3 font-mono text-[11px] leading-relaxed text-content-inverse">
                {telemetry.rawPromptContent}
              </pre>
            </div>
          )}

          {activeTab === "response" && (
            <div className="space-y-1.5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCopyResponse}
                  disabled={telemetry.rawResponseContent === null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-default bg-surface-secondary px-2.5 py-1 font-sans text-xs font-semibold text-content-secondary hover:bg-surface-muted transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {responseCopied ? (
                    <CheckIcon size={13} className="text-emerald-600" />
                  ) : (
                    <CopyIcon />
                  )}
                  {responseCopied ? "Copied!" : "Copy Response"}
                </button>
              </div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-content-primary p-3 font-mono text-[11px] leading-relaxed text-content-inverse">
                {telemetry.rawResponseContent}
              </pre>
            </div>
          )}

          {activeTab === "stages" && (
            <div className="space-y-2">
              <div className="rounded-lg bg-surface-muted p-2.5">
                <div className="font-bold text-content-primary">Stage 1 - Submission Check</div>
                <div>Assessable: {telemetry.stage1Check.isAssessable ? "Yes" : "No"}</div>
                <div>Notes: {telemetry.stage1Check.notes}</div>
              </div>

              <div className="rounded-lg bg-surface-muted p-2.5">
                <div className="font-bold text-content-primary">
                  Stage 2 - Critical Failure Checks
                </div>
                <div>Has Failure: {telemetry.stage2Failures.hasFailure ? "⚠️ YES" : "None"}</div>
                {telemetry.stage2Failures.failuresFound.length > 0 && (
                  <div className="text-danger-600">
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

function CopyIcon() {
  return (
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
  );
}
