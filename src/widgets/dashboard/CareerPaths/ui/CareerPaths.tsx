import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLearningPathStore } from "@/entities/active-learning-path";
import type { RecommendedCareerPathsData } from "@/entities/dashboard";
import { toast, WidgetCard } from "@/shared/ui";

export interface CareerPathsProps {
  data: RecommendedCareerPathsData;
}

// Hexagon geometry as a Tailwind arbitrary property (spaces encoded as underscores).
const hexClip = "[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]";

export const CareerPaths: React.FC<CareerPathsProps> = ({ data }) => {
  const navigate = useNavigate();
  const switchActiveTrack = useLearningPathStore((s) => s.switchActiveTrack);
  const activeLearningPathLoading = useLearningPathStore((s) => s.activeLearningPathLoading);
  const queryClient = useQueryClient();

  const tracks = data.tracks || [];
  const selectedTrack = tracks.find((t) => t.isSelected) || tracks[0];
  const otherTracks = tracks.filter((t) => t.title !== selectedTrack?.title);

  const leftTrack = otherTracks[0];
  const rightTrack = otherTracks[1];

  const [isExpanded, setIsExpanded] = useState(false);
  const [prevTrackId, setPrevTrackId] = useState(selectedTrack?.id);

  if (selectedTrack?.id !== prevTrackId) {
    setPrevTrackId(selectedTrack?.id);
    setIsExpanded(false);
  }

  const getHeaderTitle = (fit: string | undefined) => {
    const f = fit?.toLowerCase();
    if (f === "high") return "Track A";
    if (f === "medium") return "Track B";
    return "Track C";
  };

  const handleTrackClick = async (trackId: string, title: string) => {
    if (activeLearningPathLoading) return;
    if (trackId === selectedTrack?.id) return;
    try {
      await switchActiveTrack(trackId);
      await queryClient.invalidateQueries();
      toast.success(`Switched active track to ${title}`);
    } catch {
      toast.error("Failed to switch learning track");
    }
  };

  return (
    <WidgetCard
      title="Recommended Career Paths"
      subtitle="AI-matched based on your skills, interests & trajectory"
      icon={
        <svg
          aria-hidden="true"
          className="w-5 h-5 text-content-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      }
      action={{
        label: "Explore all",
        href: "#explore-paths",
      }}
      footer={
        <>
          Based on your activity in{" "}
          <span className="font-bold text-content-body">{data.activeTrackTitle}</span>
        </>
      }
    >
      {/* Content Split: Left Track Explorer Box, Right Details Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Track Explorer Hexagon Diagram Box */}
        <div className="lg:col-span-5 border border-brand-200/80 rounded-2xl p-5 bg-level-working-bg/40 flex flex-col items-center justify-between text-center min-h-[330px]">
          <div className="text-xs font-bold text-content-primary w-full text-center">
            {selectedTrack ? getHeaderTitle(selectedTrack.fit) : "Track Explorer"}
          </div>

          {/* Honeycomb Diagram Container */}
          <div className="relative w-full max-w-[280px] h-[250px] my-3 flex flex-col items-center justify-center -space-y-7">
            {/* Top Hexagon: Selected Dark Blue Node */}
            {selectedTrack && (
              <button
                type="button"
                onClick={() => handleTrackClick(selectedTrack.id, selectedTrack.title)}
                className={`w-32 h-32 bg-brand-600 text-white flex flex-col items-center justify-center cursor-pointer hover:bg-brand-700 transition-colors z-10 ${hexClip}`}
              >
                <div className="mb-1 flex items-center justify-center text-white">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.872M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.72c2.206-.31 4.46-.47 6.75-.47s4.544.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
                    />
                  </svg>
                </div>
                <div className="text-[11px] font-bold leading-tight max-w-[90px] truncate-2-lines text-center">
                  {selectedTrack.title}
                </div>
                <div className="text-[9px] font-semibold text-brand-100 mt-1 text-center">
                  {selectedTrack.matchPercentage
                    ? `${selectedTrack.matchPercentage}% Match`
                    : "Active"}
                </div>
              </button>
            )}

            {/* Bottom Row */}
            <div className="flex items-start justify-center gap-0.5 z-0">
              {/* Bottom Left Hexagon */}
              {leftTrack ? (
                <button
                  type="button"
                  onClick={() => handleTrackClick(leftTrack.id, leftTrack.title)}
                  className="relative w-32 h-32 group cursor-pointer"
                >
                  <div className={`absolute inset-0 bg-brand-600 ${hexClip}`} />
                  <div
                    className={`absolute inset-[2.5px] bg-surface-primary group-hover:bg-brand-50/50 transition-colors text-content-primary flex flex-col items-center justify-center text-center ${hexClip}`}
                  >
                    <div className="w-5 h-5 mb-1 flex items-center justify-center text-brand-600">
                      <svg
                        aria-hidden="true"
                        className="w-4.5 h-4.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                    <div className="text-[11px] font-bold leading-tight text-content-primary max-w-[90px] truncate-2-lines text-center">
                      {leftTrack.title}
                    </div>
                    <div className="text-[9px] font-semibold text-brand-600 mt-1 text-center">
                      {leftTrack.matchPercentage
                        ? `${leftTrack.matchPercentage}% Match`
                        : "Explore"}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="w-32 h-32 opacity-0 pointer-events-none" />
              )}

              {/* Bottom Right Hexagon */}
              {rightTrack ? (
                <button
                  type="button"
                  onClick={() => handleTrackClick(rightTrack.id, rightTrack.title)}
                  className="relative w-32 h-32 group cursor-pointer"
                >
                  <div className={`absolute inset-0 bg-line-strong ${hexClip}`} />
                  <div
                    className={`absolute inset-[2.5px] bg-surface-primary group-hover:bg-surface-secondary transition-colors text-content-primary flex flex-col items-center justify-center text-center ${hexClip}`}
                  >
                    <div className="w-5 h-5 mb-1 flex items-center justify-center text-content-secondary">
                      <svg
                        aria-hidden="true"
                        className="w-4.5 h-4.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.5 8.5l-2 5-5 2 2-5 5-2z"
                        />
                      </svg>
                    </div>
                    <div className="text-[11px] font-bold leading-tight text-content-heading max-w-[90px] truncate-2-lines text-center">
                      {rightTrack.title}
                    </div>
                    <div className="text-[9px] font-medium text-content-muted mt-1 text-center">
                      {rightTrack.matchPercentage
                        ? `${rightTrack.matchPercentage}% Match`
                        : "Explore"}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="w-32 h-32 opacity-0 pointer-events-none" />
              )}
            </div>
          </div>

          {/* View Path Button */}
          <button
            type="button"
            onClick={() => navigate("/my-courses")}
            className="w-4/5 max-w-[190px] py-2 bg-white border border-brand-200 hover:border-brand-300 text-brand-600 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 mt-3"
          >
            <span>View Path</span>
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5 text-brand-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </button>
        </div>

        {/* Right Rationale & Stats Box Card */}
        <div className="lg:col-span-7 border border-line-default/90 rounded-2xl p-5 bg-surface-primary flex flex-col justify-between space-y-4">
          {/* Why It Fits Callout Box */}
          <div className="p-4 bg-surface-subtle/80 rounded-xl space-y-1">
            <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider">
              WHY IT FITS
            </div>
            <p
              className={`text-xs sm:text-[13px] text-content-body leading-relaxed font-medium ${isExpanded ? "" : "line-clamp-[8]"}`}
            >
              {data.whyItFits}
            </p>
            {data.whyItFits && data.whyItFits.length > 300 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 mt-1 focus:outline-none cursor-pointer inline-flex items-center"
              >
                {isExpanded ? "Show less" : "... show more"}
              </button>
            )}
          </div>

          {/* Overall Progress */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider">
              OVERALL PROGRESS
            </div>
            <div className="w-full bg-surface-emphasis rounded-full h-2 overflow-hidden">
              <div
                className="bg-brand-600 h-full rounded-full"
                style={{ width: `${data.overallProgress}%` }}
              />
            </div>
          </div>

          {/* 3 Metrics Columns with Vertical Dividers */}
          <div className="grid grid-cols-3 text-center py-2 border-t border-b border-line-subtle/70">
            <div className="border-r border-line-subtle/80 pr-2">
              <div className="text-base sm:text-lg font-bold text-content-primary">
                {data.capabilitiesCount}
              </div>
              <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider mt-0.5">
                ROLES
              </div>
            </div>
            <div className="border-r border-line-subtle/80 px-2">
              <div className="text-base sm:text-lg font-bold text-content-primary">
                {data.competitionCount}
              </div>
              <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider mt-0.5">
                COMPLETION
              </div>
            </div>
            <div className="pl-2">
              <div className="text-base sm:text-lg font-bold text-success-600">
                {data.marketStatusPercentage}%
              </div>
              <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider mt-0.5">
                MARKET STATUS
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div>
            <button
              type="button"
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-content-inverse text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Curriculum Analysis</span>
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
};
