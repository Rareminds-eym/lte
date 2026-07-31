import type React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { ArrowLeftIcon, ChevronRightIcon, ShareLinkIcon } from "@/shared/ui/icons";

interface LevelHeroBannerProps {
  capabilityCode: string;
  capabilityName?: string;
  levelBadge?: string;
  title?: string;
  description?: string;
  overallProgress?: number;
  doneCount?: number;
  activeCount?: number;
  availableCount?: number;
  nextUpTitle?: string;
  onContinueLearning?: () => void;
  onShare?: () => void;
  onBookmark?: () => void;
}

export const LevelHeroBanner: React.FC<LevelHeroBannerProps> = ({
  capabilityCode,
  levelBadge = "Beginner",
  title = "Debugging & Observability for Backend Systems",
  description = "Master production-grade debugging and observability using real-world incident scenarios. Build from structured logging through full incident resolution.",
  overallProgress = 6,
  doneCount = 0,
  activeCount = 1,
  availableCount = 5,
  nextUpTitle = "Module 1 · Explain Stage",
  onContinueLearning,
  onShare,
  onBookmark,
}) => {
  return (
    <div
      className="relative w-full p-6 sm:p-10 text-white overflow-hidden shadow-xl pb-16 sm:pb-20"
      style={{
        background: "linear-gradient(110deg, #081A42 11%, #0F3892 62%, #1A60FA 82%, #041231 90%)",
      }}
    >
      {/* Light Sheen Beam Accent Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(26,96,250,0.4)_0%,transparent_65%)]" />

      {/* Top Header / Breadcrumbs */}
      <div className="relative z-10 mb-6 sm:mb-8">
        <Link
          to={`/my-courses/${capabilityCode}`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Courses
        </Link>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Course Details */}
        <div className="lg:col-span-7 space-y-4">
          {/* Level Badge */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md text-white text-xs font-semibold rounded-full border border-white/15 tracking-wide">
              {levelBadge}
            </span>
          </div>

          {/* Course Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] max-w-2xl">
            {title}
          </h1>

          {/* Course Subtitle Description */}
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
            {description}
          </p>

          {/* Action CTAs using Shared Button with aligned height & styling */}
          <div className="flex flex-wrap items-center gap-3 pt-4 sm:pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={onContinueLearning}
              size="lg"
              className="h-11 bg-white !text-brand-600 hover:bg-slate-50 font-bold border-none shadow-lg active:scale-95 transition-all px-6 rounded-xl flex items-center justify-center gap-2"
            >
              <span>Start Learning</span>
              <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
            </Button>

            <Button
              type="button"
              onClick={onShare}
              variant="outline"
              size="lg"
              className="h-11 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-white/20 font-semibold active:scale-95 transition-all px-5 rounded-xl flex items-center justify-center gap-2"
            >
              <ShareLinkIcon className="w-4 h-4 shrink-0" />
              <span>Share</span>
            </Button>

            <button
              type="button"
              onClick={onBookmark}
              aria-label="Bookmark Course"
              className="h-11 w-11 p-0 m-0 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 active:scale-95 transition-all rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Column: Overall Progress Card */}
        <div className="lg:col-span-5 flex justify-start lg:justify-end">
          <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/15 rounded-2xl p-6 space-y-6 shadow-2xl">
            {/* Overall Progress Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-slate-300">
                Overall Progress
              </span>
              <span className="text-xl font-bold text-white tracking-tight">
                {overallProgress}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/15 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            {/* Stats Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2 text-center py-3 border-y border-white/10">
              <div>
                <div className="text-xl font-bold text-white">{doneCount}</div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">Done</div>
              </div>
              <div className="border-x border-white/10">
                <div className="text-xl font-bold text-white">{activeCount}</div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">Active</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{availableCount}</div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">Available</div>
              </div>
            </div>

            {/* Next Up Footer */}
            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
                Next Up
              </div>
              <div className="text-sm font-semibold text-white">{nextUpTitle}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
