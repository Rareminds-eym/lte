import type React from "react";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/app/store";
import { getSkillpassportUrl } from "@/shared";

export const LoginPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    document.title = "Sign In | LTE";
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
      <div className="bg-white px-8 py-10 rounded-2xl shadow-lg text-center max-w-md w-full">
        <h2 className="text-2xl font-bold mb-3 text-slate-900">Sign In to LTE</h2>
        <p className="text-slate-500 text-sm mb-7">
          Please sign in with your SkillPassport account to access LTE.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          className="bg-blue-600 text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer"
        >
          Sign In with SkillPassport
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
