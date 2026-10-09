import type React from "react";
import { useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLearningPath } from "@/entities/active-learning-path";
import type { RecommendedCareerPathsData } from "@/entities/dashboard";
import {
  CAREER_RATIONALE_PREVIEW_LENGTH,
  DASHBOARD_CARD_HEIGHTS,
  getLogger,
  ROUTES,
  UI_TEXT,
} from "@/shared/config";
import { toPercentage } from "@/shared/lib";
import { Dialog, toast, WidgetCard } from "@/shared/ui";
import { ArrowRightIcon, CompassIcon, GrowthIcon, TrophyIcon } from "@/shared/ui/icons";

export interface CareerPathsProps {
  data: RecommendedCareerPathsData;
}

// Hexagon geometry as a Tailwind arbitrary property (spaces encoded as underscores).
const hexClip = "[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]";

export const CareerPaths: React.FC<CareerPathsProps> = ({ data }) => {
  const navigate = useNavigate();
  const switchActiveTrack = useLearningPath((s) => s.switchActiveTrack);
  const activeLearningPathLoading = useLearningPath((s) => s.activeLearningPathLoading);
  const [showTracks, setShowTracks] = useState(false);
  const [pendingTrack, setPendingTrack] = useState<string | null>(null);
  const switching = useRef(false);
  const rationaleId = useId();
  const busy = activeLearningPathLoading || pendingTrack !== null;

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
    if (f === "high") return UI_TEXT.trackA;
    if (f === "medium") return UI_TEXT.trackB;
    return UI_TEXT.trackC;
  };

  const handleTrackClick = async (trackId: string, title: string) => {
    if (activeLearningPathLoading || switching.current) return;
    if (trackId === selectedTrack?.id) return;
    switching.current = true;
    setPendingTrack(title);
    try {
      await switchActiveTrack(trackId);
      toast.success(UI_TEXT.switchedTrack(title));
      setShowTracks(false);
    } catch (error) {
      getLogger("CareerPaths").error("Failed to switch learning track", error);
      toast.error(UI_TEXT.trackSwitchFailed);
    } finally {
      switching.current = false;
      setPendingTrack(null);
    }
  };

  return (
    <>
      <WidgetCard
        scrollable
        className={DASHBOARD_CARD_HEIGHTS.careerPaths}
        title={UI_TEXT.recommendedCareerPaths}
        subtitle={UI_TEXT.aiMatchedBasedOnYourSkillsInterestsTrajectory}
        icon={<CompassIcon size={20} className="text-content-primary" />}
        action={{
          label: UI_TEXT.exploreAll,
          onClick: () => setShowTracks(true),
        }}
        footer={
          <>
            {UI_TEXT.basedOnYourActivityIn}{" "}
            <span className="font-bold text-content-body">{data.activeTrackTitle}</span>
          </>
        }
      >
        {/* Content Split: Left Track Explorer Box, Right Details Box */}
        <div className="grid grid-cols-1 @[34rem]/widget:grid-cols-12 gap-5 items-start">
          {/* Left Track Explorer Hexagon Diagram Box */}
          <div
            aria-busy={busy}
            className="@[34rem]/widget:col-span-5 border border-brand-200/80 rounded-2xl p-5 bg-level-working-bg/40 flex flex-col items-center justify-between text-center min-w-0"
          >
            <div className="text-xs font-bold text-content-primary w-full text-center">
              {selectedTrack ? getHeaderTitle(selectedTrack.fit) : UI_TEXT.trackExplorer}
            </div>

            {/* Honeycomb Diagram Container */}
            <div className="relative w-full max-w-64 aspect-square my-3 flex flex-col items-center justify-center">
              {/* Top Hexagon: Selected Dark Blue Node */}
              {selectedTrack && (
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed="true"
                  aria-label={UI_TEXT.activeTrack(selectedTrack.title)}
                  onClick={() => handleTrackClick(selectedTrack.id, selectedTrack.title)}
                  className={`w-1/2 aspect-square shrink-0 bg-brand-600 text-white flex flex-col items-center justify-center cursor-pointer hover:bg-brand-700 transition-colors z-10 disabled:cursor-wait ${hexClip}`}
                >
                  <div className="mb-1 flex items-center justify-center text-white">
                    <TrophyIcon size={18} />
                  </div>
                  <div className="text-[11px] font-bold leading-tight max-w-[80%] line-clamp-3 text-center">
                    {selectedTrack.title}
                  </div>
                  <div className="text-[9px] font-semibold text-content-inverse mt-1 text-center">
                    {selectedTrack.matchPercentage !== undefined
                      ? UI_TEXT.match(selectedTrack.matchPercentage)
                      : UI_TEXT.active}
                  </div>
                </button>
              )}

              {/* Bottom Row */}
              <div className="grid w-full grid-cols-2 gap-0.5 -mt-[12.5%] shrink-0 z-0">
                {/* Bottom Left Hexagon */}
                {leftTrack ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed="false"
                    aria-label={UI_TEXT.switchTrack(leftTrack.title)}
                    onClick={() => handleTrackClick(leftTrack.id, leftTrack.title)}
                    className="relative w-full aspect-square min-w-0 group cursor-pointer disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className={`absolute inset-0 bg-brand-600 ${hexClip}`} />
                    <div
                      className={`absolute inset-[2.5px] bg-surface-primary group-hover:bg-brand-50/50 transition-colors text-content-primary flex flex-col items-center justify-center text-center ${hexClip}`}
                    >
                      <div className="w-5 h-5 mb-1 flex items-center justify-center text-brand-600">
                        <GrowthIcon size={16} />
                      </div>
                      <div className="text-[11px] font-bold leading-tight text-content-primary max-w-[80%] line-clamp-3 text-center">
                        {leftTrack.title}
                      </div>
                      <div className="text-[9px] font-semibold text-brand-600 mt-1 text-center">
                        {leftTrack.matchPercentage !== undefined
                          ? UI_TEXT.match(leftTrack.matchPercentage)
                          : UI_TEXT.explore}
                      </div>
                    </div>
                  </button>
                ) : (
                  <div
                    aria-hidden="true"
                    className="w-full aspect-square opacity-0 pointer-events-none"
                  />
                )}

                {/* Bottom Right Hexagon */}
                {rightTrack ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed="false"
                    aria-label={UI_TEXT.switchTrack(rightTrack.title)}
                    onClick={() => handleTrackClick(rightTrack.id, rightTrack.title)}
                    className="relative w-full aspect-square min-w-0 group cursor-pointer disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className={`absolute inset-0 bg-line-strong ${hexClip}`} />
                    <div
                      className={`absolute inset-[2.5px] bg-surface-primary group-hover:bg-surface-secondary transition-colors text-content-primary flex flex-col items-center justify-center text-center ${hexClip}`}
                    >
                      <div className="w-5 h-5 mb-1 flex items-center justify-center text-content-secondary">
                        <CompassIcon size={16} />
                      </div>
                      <div className="text-[11px] font-bold leading-tight text-content-heading max-w-[80%] line-clamp-3 text-center">
                        {rightTrack.title}
                      </div>
                      <div className="text-[9px] font-medium text-content-secondary mt-1 text-center">
                        {rightTrack.matchPercentage !== undefined
                          ? UI_TEXT.match(rightTrack.matchPercentage)
                          : UI_TEXT.explore}
                      </div>
                    </div>
                  </button>
                ) : (
                  <div
                    aria-hidden="true"
                    className="w-full aspect-square opacity-0 pointer-events-none"
                  />
                )}
              </div>
            </div>
            <span aria-hidden="true" className={busy ? "text-xs text-brand-600" : "sr-only"}>
              {pendingTrack ? UI_TEXT.switchingTrack(pendingTrack) : ""}
            </span>
            {!selectedTrack && (
              <p className="text-sm text-content-secondary">
                {UI_TEXT.careerTrackEmptyDescription}
              </p>
            )}

            {/* View Path Button */}
            <button
              type="button"
              onClick={() => navigate(ROUTES.MY_COURSES)}
              className="w-4/5 max-w-[190px] py-2 bg-white border border-brand-200 hover:border-brand-300 text-brand-600 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 mt-3"
            >
              <span>{UI_TEXT.viewPath}</span>
              <ArrowRightIcon size={14} />
            </button>
          </div>

          {/* Right Rationale & Stats Box Card */}
          <div className="@container/career-details @[34rem]/widget:col-span-7 border border-line-default/90 rounded-2xl p-5 bg-surface-primary flex flex-col space-y-4 min-w-0">
            {/* Why It Fits Callout Box */}
            <div className="p-4 bg-surface-subtle/80 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">
                {UI_TEXT.whyItFits}
              </div>
              <p
                id={rationaleId}
                className={`text-xs sm:text-[13px] text-content-body leading-relaxed font-medium ${isExpanded ? "" : "line-clamp-[8]"}`}
              >
                {data.whyItFits || UI_TEXT.careerPathDescription}
              </p>
              {data.whyItFits && data.whyItFits.length > CAREER_RATIONALE_PREVIEW_LENGTH && (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={rationaleId}
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 mt-1 cursor-pointer inline-flex items-center"
                >
                  {isExpanded ? UI_TEXT.showLess : UI_TEXT.showMore}
                </button>
              )}
            </div>

            {/* Overall Progress */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">
                {UI_TEXT.overallProgress}
              </div>
              <div
                role="progressbar"
                aria-label={UI_TEXT.careerPathProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={toPercentage(data.overallProgress)}
                className="w-full bg-surface-emphasis rounded-full h-2 overflow-hidden"
              >
                <div
                  className="bg-brand-600 h-full rounded-full"
                  style={{ width: `${toPercentage(data.overallProgress)}%` }}
                />
              </div>
            </div>

            {/* 3 Metrics Columns with Vertical Dividers */}
            <div className="grid grid-cols-1 @[18rem]/career-details:grid-cols-3 gap-y-3 text-center py-2 border-t border-b border-line-subtle/70">
              <div className="min-w-0 border-b border-line-subtle/80 pb-3 @[18rem]/career-details:border-b-0 @[18rem]/career-details:pb-0 @[18rem]/career-details:border-r @[18rem]/career-details:pr-2">
                <div className="text-base sm:text-lg font-bold text-content-primary">
                  {data.capabilitiesCount}
                </div>
                <div className="text-[10px] font-bold text-content-secondary uppercase tracking-wider mt-0.5">
                  {UI_TEXT.roles}
                </div>
              </div>
              <div className="min-w-0 border-b border-line-subtle/80 pb-3 @[18rem]/career-details:border-b-0 @[18rem]/career-details:pb-0 @[18rem]/career-details:border-r @[18rem]/career-details:px-2">
                <div className="text-base sm:text-lg font-bold text-content-primary">
                  {data.competitionCount}
                </div>
                <div className="text-[10px] font-bold text-content-secondary uppercase tracking-wider mt-0.5">
                  {UI_TEXT.completion}
                </div>
              </div>
              <div className="min-w-0 @[18rem]/career-details:pl-2">
                <div className="text-base sm:text-lg font-bold text-success-700">
                  {data.marketStatusPercentage}%
                </div>
                <div className="text-[10px] font-bold text-content-secondary uppercase tracking-wider mt-0.5">
                  {UI_TEXT.marketStatus}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.MY_COURSES)}
                className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-content-inverse text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{UI_TEXT.curriculumAnalysis}</span>
                <ArrowRightIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      </WidgetCard>
      <span role="status" className="sr-only">
        {pendingTrack ? UI_TEXT.switchingTrack(pendingTrack) : ""}
      </span>
      <Dialog
        open={showTracks}
        onClose={() => setShowTracks(false)}
        title={UI_TEXT.exploreCareerPaths}
      >
        <p className="mb-4 text-sm text-content-secondary">{UI_TEXT.careerTracksDescription}</p>
        <div className="space-y-3" aria-busy={busy}>
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              disabled={busy}
              aria-pressed={track.id === selectedTrack?.id}
              onClick={() => void handleTrackClick(track.id, track.title)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-line-default p-4 text-left hover:bg-surface-secondary cursor-pointer disabled:cursor-wait disabled:opacity-60"
            >
              <span className="text-sm font-semibold">{track.title}</span>
              <span className="text-xs text-brand-600 shrink-0">
                {track.id === selectedTrack?.id
                  ? UI_TEXT.active
                  : track.matchPercentage !== undefined
                    ? UI_TEXT.match(track.matchPercentage)
                    : UI_TEXT.explore}
              </span>
            </button>
          ))}
          {!tracks.length && (
            <p className="text-sm text-content-secondary">{UI_TEXT.noCareerTracksAvailableYet}</p>
          )}
          <p aria-hidden="true" className="text-sm text-brand-600">
            {pendingTrack ? UI_TEXT.switchingTrack(pendingTrack) : ""}
          </p>
        </div>
      </Dialog>
    </>
  );
};
