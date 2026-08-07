import { useEffect } from "react";
import { getSkillpassportUrl } from "@/shared";
import { Button } from "@/shared/ui";
import { DesignCanvas } from "./DesignCanvas";

export const LoginPage = () => {
  useEffect(() => {
    document.title = "Sign In | LTE";
  }, []);

  const handleLogin = () => {
    const skillpassportUrl = getSkillpassportUrl();
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    window.location.href = `${skillpassportUrl}/login?target_app=lte&redirect_uri=${redirectUri}`;
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#f8fafc] overflow-hidden p-6">
      {/* Background Canvas */}
      <DesignCanvas
        animate
        className="absolute inset-0 w-full h-full object-cover"
        style={{ width: "100%", height: "100%", aspectRatio: "auto" }}
      />

      {/* Wrapper to center everything vertically */}
      <div className="relative z-10 flex flex-col items-center max-w-[420px] w-full">
        {/* Card Content */}
        <div className="bg-white px-8 py-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100/80 text-center w-full">
          {/* Bulb Logo Header */}
          <div className="flex justify-center mb-6">
            <img
              src="/assets/images/rm-bulb.webp"
              alt="SkillPassport Logo"
              className="w-12 h-12 object-contain"
            />
          </div>

          <h2 className="text-2xl font-bold mb-3 text-slate-900">
            Sign In to <span className="text-blue-600">LTE</span>
          </h2>
          <p className="text-slate-500 text-sm mb-7 leading-relaxed">
            Please sign in with your SkillPassport account to access LTE.
          </p>
          <Button variant="primary" size="md" onClick={handleLogin}>
            Sign In with SkillPassport
          </Button>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-xs text-slate-400 flex items-center gap-1.5 justify-center">
          <span>&copy; 2026 SkillPassport</span>
          <span className="text-slate-300">&middot;</span>
          <a href="/privacy" className="hover:text-slate-600 transition-colors">
            Privacy
          </a>
          <span className="text-slate-300">&middot;</span>
          <a href="/terms" className="hover:text-slate-600 transition-colors">
            Terms
          </a>
          <span className="text-slate-300">&middot;</span>
          <a href="/help" className="hover:text-slate-600 transition-colors">
            Help
          </a>
        </div>
      </div>
    </div>
  );
};
