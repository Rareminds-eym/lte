import type React from "react";
import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import gsap from "gsap";
import { useAuthStore } from "@/app/store";
import { getSkillpassportUrl } from "@/shared";
import { Button } from "@/shared/ui";

export const LoginPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Sign In | LTE";

    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.4)" },
      );
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = () => {
    const skillpassportUrl = getSkillpassportUrl();
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    window.location.href = `${skillpassportUrl}/login?target_app=lte&redirect_uri=${redirectUri}`;
  };

  return (
    <div className="grid place-items-center min-h-screen bg-slate-50 p-8">
      <div
        ref={cardRef}
        className="bg-white px-8 py-10 rounded-2xl shadow-lg text-center max-w-md w-full"
      >
        <h2 className="text-2xl font-bold mb-3 text-slate-900">Sign In to LTE</h2>
        <p className="text-slate-500 text-sm mb-7">
          Please sign in with your SkillPassport account to access LTE.
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-lg border-none"
        >
          Sign In with SkillPassport
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;
