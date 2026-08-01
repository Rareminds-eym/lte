import type React from "react";
import { CloseIcon, TrendUpIcon, XpHexagonIcon } from "@/shared/ui";

interface XpRewardModalProps {
  isOpen: boolean;
  xpAmount: number;
  totalXp: number;
  stageName: string;
  onClose: () => void;
}

export const XpRewardModal: React.FC<XpRewardModalProps> = ({
  isOpen,
  xpAmount,
  totalXp,
  stageName,
  onClose,
}) => {
  if (!isOpen) return null;

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

        {/* Visual illustration: Pointy double-bordered green hexagon badge with glowing yellowish ray backdrop */}
        <div className="relative mb-0.5 w-20 h-20 flex items-center justify-center">
          {/* Glowing backdrop circle: Yellow/Amber */}
          <div className="absolute w-16 h-16 rounded-full bg-yellow-100/60 blur-lg animate-pulse" />

          {/* Light rays/sparkles backdrop: Yellowish */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(252,211,77,0.22)_0%,transparent_70%)] animate-spin [animation-duration:15s]" />

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
          <span className="text-emerald-500">+{xpAmount}</span> XP Earned!
        </h3>

        {/* Star & Line Detail */}
        <div className="flex items-center justify-between gap-3 w-full my-2.5 px-6">
          <div className="h-px bg-slate-200/80 flex-1"></div>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-accent-purple-600 uppercase tracking-widest">
            ★ READINESS XP ★
          </span>
          <div className="h-px bg-slate-200/80 flex-1"></div>
        </div>

        {/* Subtitle / Description */}
        <p className="text-xs text-content-body font-medium leading-relaxed px-2 mb-4">
          Excellent work! You completed the{" "}
          <span className="font-extrabold text-emerald-600 capitalize">{stageName}</span> stage.
          This readiness XP has been logged to your capability profile to boost your overall role
          readiness.
        </p>

        {/* Total XP Summary Card */}
        <div className="w-full bg-[#f4fbf8] border border-[#e6f4ee] rounded-2xl py-3 px-4 flex items-center justify-between gap-4 mb-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e3f6ed] flex items-center justify-center text-emerald-600 shrink-0">
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
              <span className="text-emerald-600 font-extrabold">{totalXp}</span>{" "}
              <span className="text-[11px] font-bold text-slate-500 uppercase">XP</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-2.5 text-xs font-extrabold text-white shadow-lg hover:shadow-xl hover:from-emerald-500 hover:to-teal-600 active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Continue</span>
          <span className="text-base leading-none">→</span>
        </button>
      </div>
    </div>
  );
};
