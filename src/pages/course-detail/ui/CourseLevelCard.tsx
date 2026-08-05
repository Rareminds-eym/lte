import type React from "react";
import { Button } from "@/shared/ui";

export interface CourseLevelCardProps {
  id?: string;
  levelNumber: number;
  code: string;
  title: string;
  description: string;
  status: "completed" | "unlocked" | "locked";
  isTargetLevel?: boolean;
  deliverablesLabel: string;
  deliverables: string[];
  duration: string;
  xp?: string;
  difficulty: string;
  actionText: string;
  onAction?: () => void;
  isLast?: boolean;
  variant?: "card" | "list";
}

export const CourseLevelCard: React.FC<CourseLevelCardProps> = ({
  levelNumber,
  code,
  title,
  description,
  status,
  isTargetLevel = false,
  deliverablesLabel,
  deliverables,
  duration,
  xp,
  difficulty,
  actionText,
  onAction,
  isLast = false,
  variant = "card",
}) => {
  const isCompleted = status === "completed";
  const isUnlocked = status === "unlocked";
  const isLocked = status === "locked";

  const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  /* ── 1. GRID / CARD VARIANT (Matches design screenshot) ── */
  if (variant === "card") {
    return (
      <div
        data-testid={`level-card-${levelNumber}`}
        className={`flex flex-col justify-between rounded-3xl p-6 transition-all bg-surface-primary border shadow-2xs hover:shadow-md ${
          isCompleted
            ? "border-emerald-200/80"
            : isUnlocked
              ? "border-2 border-brand-500 shadow-md ring-1 ring-brand-100"
              : "border-line-default bg-surface-primary/70 opacity-80"
        }`}
      >
        <div>
          {/* Top Header Row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-xs font-bold tracking-wider text-content-muted uppercase">
                LEVEL {levelNumber} · {code}
              </span>
              {isTargetLevel && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple-200 bg-accent-purple-50 px-2 py-0.5 text-[10px] font-semibold text-accent-purple-700">
                  🎯 TARGET LEVEL
                </span>
              )}
            </div>

            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60 shrink-0">
                ✓ Completed
              </span>
            )}

            {isUnlocked && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                Unlocked
              </span>
            )}

            {isLocked && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-content-muted border border-line-subtle">
                  <LockIcon className="w-3 h-3" />
                  Locked
                </span>
              </div>
            )}
          </div>

          {/* Level Title */}
          <h3
            className={`text-lg font-bold mb-2.5 leading-snug line-clamp-2 ${
              isLocked ? "text-content-secondary" : "text-content-primary"
            }`}
          >
            {title}
          </h3>

          {/* Level Description */}
          <p className="text-xs sm:text-sm text-content-secondary leading-relaxed mb-4 line-clamp-3">
            {description}
          </p>

          {/* Deliverables for accessibility & test suites */}
          {deliverables.length > 0 && (
            <div className="sr-only">
              <p>{deliverablesLabel}</p>
              {deliverables.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>

        <div>
          {/* Meta Stats Line with Horizontal Divider */}
          <div className="flex items-center gap-4 text-xs font-medium text-content-secondary py-3 border-t border-line-subtle mb-4">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-content-muted" />
              {duration}
            </span>
            {xp && (
              <span className="flex items-center gap-1 text-warning-600 font-bold">
                <LightningIcon className="w-4 h-4" />
                {xp}
              </span>
            )}
            <span className="text-content-muted">{capitalizedDifficulty}</span>
          </div>

          {/* Bottom Full-Width Action Button */}
          {isLocked ? (
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface-muted py-2.5 text-xs font-semibold text-content-muted cursor-not-allowed border-0"
            >
              Locked
            </button>
          ) : isCompleted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onAction}
              className="w-full rounded-xl border border-brand-500 text-brand-600 hover:bg-brand-50 font-semibold text-xs py-2.5 inline-flex items-center justify-center gap-1 bg-white shadow-2xs"
            >
              Review →
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onAction}
              className="w-full rounded-xl bg-brand-600 text-white hover:bg-brand-700 font-semibold text-xs py-2.5 inline-flex items-center justify-center gap-1 shadow-xs"
            >
              {actionText}
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ── 2. VERTICAL TIMELINE LIST VARIANT (Matches Image 1) ── */
  return (
    <div data-testid={`level-row-${levelNumber}`} className="relative flex gap-4 sm:gap-6">
      {/* Vertical Timeline Column */}
      <div className="flex flex-col items-center shrink-0">
        {/* Node Circle */}
        <div
          role="img"
          className={`z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
            isCompleted
              ? "bg-success-600 text-white shadow-xs"
              : isUnlocked
                ? "bg-brand-600 text-white shadow-md ring-4 ring-brand-50"
                : "bg-surface-muted border border-line-default text-content-muted"
          }`}
          aria-label={`Level ${levelNumber} indicator`}
        >
          {isCompleted ? (
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : isUnlocked ? (
            <span>{levelNumber}</span>
          ) : (
            <LockIcon className="h-3.5 w-3.5" />
          )}
        </div>

        {/* Vertical Connecting Line */}
        {!isLast && (
          <div
            className={`w-0.5 flex-1 ${isCompleted ? "bg-success-500/60" : "bg-line-default"}`}
          />
        )}
      </div>

      {/* Main Level Card */}
      <div
        className={`flex-1 rounded-2xl p-5 sm:p-6 mb-6 transition-all ${
          isCompleted
            ? "bg-surface-primary border border-success-200/80 shadow-2xs"
            : isUnlocked
              ? "bg-surface-primary border-2 border-brand-500 shadow-md ring-1 ring-brand-100"
              : "bg-surface-primary/70 border border-line-default opacity-85"
        }`}
      >
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-content-muted uppercase">
              LEVEL {levelNumber} · {code}
            </span>
            {isTargetLevel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple-200 bg-accent-purple-50 px-2.5 py-0.5 text-xs font-semibold text-accent-purple-700">
                🎯 TARGET
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700 border border-success-200/60">
                ✓ Completed
              </span>
            )}

            {isUnlocked && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                Unlocked
              </span>
            )}
          </div>
        </div>

        {/* Level Title */}
        <h3
          className={`text-lg sm:text-xl font-bold mb-2 ${
            isLocked ? "text-content-secondary" : "text-content-primary"
          }`}
        >
          {title}
        </h3>

        {/* Level Description */}
        <p className="text-xs sm:text-sm text-content-secondary leading-relaxed mb-4">
          {description}
        </p>

        {/* Produced Section */}
        {deliverables.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-bold tracking-wider text-content-muted uppercase mb-2">
              {deliverablesLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {deliverables.map((item) => (
                <span
                  key={item}
                  className="rounded-lg border border-line-default bg-surface-muted px-3 py-1 text-xs font-medium text-content-secondary"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer Meta & Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-line-subtle">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-content-secondary">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4 text-content-muted" />
              {duration}
            </span>

            {xp && (
              <span className="flex items-center gap-1 text-warning-600 font-bold">
                <LightningIcon className="h-4 w-4" />
                {xp}
              </span>
            )}

            <span className="text-content-muted">{capitalizedDifficulty}</span>
          </div>

          <div>
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface-muted px-4 py-2 text-xs font-semibold text-content-muted cursor-not-allowed border-0">
                <LockIcon className="h-3.5 w-3.5" />
                Locked
              </span>
            ) : isCompleted ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onAction}
                className="border border-brand-500 text-brand-600 hover:bg-brand-50 font-semibold text-xs rounded-xl px-4 py-2 inline-flex items-center gap-1 bg-white"
              >
                Review →
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={onAction}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl px-4 py-2 inline-flex items-center gap-1"
              >
                {actionText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Inline SVG Helpers ── */

const ClockIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const LightningIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const LockIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);
