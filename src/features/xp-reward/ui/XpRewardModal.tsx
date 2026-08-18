import type React from "react";
import { CloseIcon, TrendUpIcon, XpHexagonIcon } from "@/shared/ui";

interface XpRewardModalProps {
  isOpen: boolean;
  xpAmount: number;
  totalXp: number;
  stageName: string;
  onClose: () => void;
  xpCategory?: "evidence" | "engagement";
}

export const XpRewardModal: React.FC<XpRewardModalProps> = ({
  isOpen,
  xpAmount,
  totalXp,
  stageName,
  onClose,
  xpCategory = "evidence",
}) => {
  if (!isOpen) return null;

  const isEngagement = xpCategory === "engagement";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-100 bg-white pt-5 pb-4 px-5 text-center shadow-2xl transition-all duration-300 transform scale-100 flex flex-col items-center">
        {/* Close button in top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1.5 rounded-full hover:bg-slate-50"
          aria-label="Close dialog"
        >
          <CloseIcon size={16} />
        </button>

        {/* Visual illustration: Pointy double-bordered hexagon badge with glowing ray backdrop */}
        <div className="relative mb-0.5 w-20 h-20 flex items-center justify-center">
          {/* Glowing backdrop circle */}
          <div
            className={`absolute w-16 h-16 rounded-full blur-lg animate-pulse ${
              isEngagement ? "bg-indigo-100/60" : "bg-yellow-100/60"
            }`}
          />

          {/* Light rays/sparkles backdrop */}
          <div
            className={`absolute inset-0 animate-spin [animation-duration:15s] ${
              isEngagement
                ? "bg-[radial-gradient(circle,rgba(99,102,241,0.22)_0%,transparent_70%)]"
                : "bg-[radial-gradient(circle,rgba(252,211,77,0.22)_0%,transparent_70%)]"
            }`}
          />

          {/* Floating tiny particles (sparkles, circles) */}
          <div className="absolute top-0 left-3 text-emerald-400 text-[10px] animate-bounce [animation-delay:0.2s]">
            ✦
          </div>
          <div className="absolute top-0 right-4 text-indigo-400 text-[10px] animate-bounce [animation-delay:0.5s]">
            ✦
          </div>
          <div className="absolute bottom-2 left-2 text-purple-400 text-[10px] animate-bounce [animation-delay:0.8s]">
            ✦
          </div>
          <div className="absolute bottom-1 right-3 text-amber-400 text-[10px] animate-bounce [animation-delay:1.1s]">
            ✦
          </div>
          <div className="absolute top-5 left-0.5 w-1 h-1 rounded-full bg-brand-400/60" />
          <div className="absolute bottom-5 right-0.5 w-1 h-1 rounded-full bg-success-400/60" />

          {/* Hexagon icon */}
          <XpHexagonIcon size={64} className="relative z-10" />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-black tracking-tight text-slate-800 font-sans mb-1">
          {stageName === "course_completed_on_time" && xpAmount === 0 ? (
            <span className="text-emerald-500">Level Completed!</span>
          ) : (
            <>
              <span className={isEngagement ? "text-indigo-500" : "text-emerald-500"}>
                +{xpAmount}
              </span>{" "}
              XP Earned!
            </>
          )}
        </h3>

        {/* Star & Line Detail */}
        <div className="flex items-center justify-between gap-3 w-full my-2.5 px-6">
          <div className="h-px bg-slate-200/80 flex-1"></div>
          <span
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${
              isEngagement ? "text-indigo-600" : "text-emerald-600"
            }`}
          >
            {isEngagement ? "★ ENGAGEMENT XP ★" : "★ READINESS XP ★"}
          </span>
          <div className="h-px bg-slate-200/80 flex-1"></div>
        </div>

        {/* Subtitle / Description */}
        <p className="text-xs text-content-body font-medium leading-relaxed px-2 mb-4">
          {isEngagement ? (
            <>
              {stageName === "daily_login" && (
                <>
                  Awesome job! You earned engagement XP for your daily active login. This engagement
                  XP helps you build strong daily learning habits.
                </>
              )}
              {stageName === "streak_7_day" && (
                <>
                  Fantastic! You have logged in for 7 consecutive days and earned a streak bonus.
                  Keep up this amazing consistency!
                </>
              )}
              {stageName === "consistency_30_day" && (
                <>
                  Incredible! You have logged in for 30 consecutive days and earned a consistency
                  bonus. Your commitment to learning is outstanding!
                </>
              )}
              {stageName === "legacy_consistency_bonus" && (
                <>
                  Welcome back! You earned a legacy re-engagement bonus for returning to LTE. We are
                  excited to support your continued learning journey!
                </>
              )}
              {stageName === "profile_completed" && (
                <>
                  Fantastic job! You completed your profile and earned a profile completion bonus.
                  Let's keep building your skill identity!
                </>
              )}
              {stageName === "readiness_milestone_25" && (
                <>
                  Amazing! You crossed the 25% readiness milestone for this capability level. Keep
                  learning to level up further!
                </>
              )}
              {stageName === "readiness_milestone_50" && (
                <>
                  Halfway there! You achieved the 50% readiness milestone. Excellent work in
                  demonstrating your capability progress!
                </>
              )}
              {stageName === "readiness_milestone_75" && (
                <>
                  Outstanding! You reached the 75% readiness milestone. You are well on your way to
                  mastering this capability!
                </>
              )}
              {stageName === "readiness_milestone_100" && (
                <>
                  Incredible! You completed the 100% readiness milestone. You have fully
                  demonstrated all required capability metrics!
                </>
              )}
              {stageName === "promotional_xp" && (
                <>
                  Congratulations! You received a promotional XP reward. Keep up the active learning
                  and participation!
                </>
              )}
              {![
                "daily_login",
                "streak_7_day",
                "consistency_30_day",
                "legacy_consistency_bonus",
                "profile_completed",
                "readiness_milestone_25",
                "readiness_milestone_50",
                "readiness_milestone_75",
                "readiness_milestone_100",
                "promotional_xp",
              ].includes(stageName) && (
                <>
                  Awesome job! You earned engagement XP for your login consistency, streak
                  milestone, or profile completion. This engagement XP helps you build strong
                  learning habits.
                </>
              )}
            </>
          ) : stageName === "course_completed_on_time" ? (
            xpAmount > 0 ? (
              <>
                Outstanding! You completed the capability level within the target timeline and
                earned an on-time completion bonus. This readiness XP has been added to your
                profile!
              </>
            ) : (
              <>
                Excellent work! You have completed all modules in this capability level. Keep up the
                great work to unlock your next levels!
              </>
            )
          ) : stageName === "practice_artifact_accepted" ? (
            <>
              Excellent work! Your practice artifact submission has been evaluated and accepted.
              Your evidence has been logged to your capability profile.
            </>
          ) : stageName === "practice_artifact_failed" ? (
            <>
              Thank you for submitting your practice artifact! Your attempt has been evaluated and
              logged. Review the feedback and try again to improve your score.
            </>
          ) : [
              "final_artifact_accepted_1",
              "final_artifact_accepted_2",
              "final_artifact_accepted_3",
            ].includes(stageName) ? (
            <>
              Outstanding! Your final artifact submission was accepted. This readiness proof has
              been successfully logged to your capability profile.
            </>
          ) : stageName === "final_artifact_failed" ? (
            <>
              Thank you for submitting your final artifact. Your attempt has been evaluated. Review
              the feedback, iterate, and submit again to prove your mastery.
            </>
          ) : stageName === "manual_eval_accepted" ? (
            <>
              Great news! Your manual evaluation has been completed and accepted. Your readiness
              proof has been updated.
            </>
          ) : stageName === "fallback_eval_failed" ? (
            <>
              Your fallback evaluation is complete. Review the evaluator's feedback to adjust and
              resubmit your final artifact.
            </>
          ) : stageName === "fast_track_capability" ? (
            <>
              Incredible! You fast-tracked this capability by successfully passing the initial
              assessment. Your readiness points have been awarded!
            </>
          ) : stageName === "capstone_completed" ? (
            <>
              Congratulations on completing your Capstone project! Your evaluation has been
              accepted, marking major progress towards role mastery.
            </>
          ) : (
            <>
              Excellent work! You completed the{" "}
              <span className="font-extrabold text-emerald-600 capitalize">{stageName}</span> stage.
              This readiness XP has been logged to your capability profile to boost your overall
              role readiness.
            </>
          )}
        </p>

        {/* Total XP Summary Card */}
        <div
          className={`w-full border rounded-2xl py-3 px-4 flex items-center justify-between gap-4 mb-4 text-left ${
            isEngagement ? "bg-indigo-50/30 border-indigo-100" : "bg-[#f4fbf8] border-[#e6f4ee]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isEngagement ? "bg-indigo-100/50 text-indigo-600" : "bg-[#e3f6ed] text-emerald-600"
              }`}
            >
              <TrendUpIcon size={20} />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-800">Keep Going!</div>
              <div className="text-[11px] font-medium text-slate-500 leading-normal">
                You're building real skills and getting closer to your goals.
              </div>
            </div>
          </div>

          <div className="w-px h-10 bg-slate-200 shrink-0"></div>

          <div className="text-right shrink-0">
            <div className="text-[9px] font-black text-slate-400 tracking-wider uppercase">
              TOTAL XP
            </div>
            <div className="text-xl font-black text-slate-800 leading-none mt-1">
              <span
                className={`${isEngagement ? "text-indigo-600" : "text-emerald-600"} font-extrabold`}
              >
                {totalXp}
              </span>{" "}
              <span className="text-[11px] font-bold text-slate-500 uppercase">XP</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className={`w-full rounded-2xl py-2.5 text-xs font-extrabold text-white shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r ${
            isEngagement
              ? "from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600"
              : "from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600"
          }`}
        >
          <span>Continue</span>
          <span className="text-base leading-none">→</span>
        </button>
      </div>
    </div>
  );
};
