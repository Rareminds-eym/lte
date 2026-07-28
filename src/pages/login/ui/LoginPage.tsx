import { useEffect } from "react";
import { getSkillpassportUrl } from "@/shared";
import { Button } from "@/shared/ui";

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
    <div className="grid place-items-center min-h-screen bg-surface-secondary p-8">
      <div className="bg-white px-8 py-10 rounded-2xl shadow-lg text-center max-w-md w-full">
        <h2 className="text-2xl font-bold mb-3 text-content-primary">Sign In to LTE</h2>
        <p className="text-content-secondary text-sm mb-7">
          Please sign in with your SkillPassport account to access LTE.
        </p>
        <Button variant="primary" size="md" onClick={handleLogin}>
          Sign In with SkillPassport
        </Button>
      </div>
    </div>
  );
};
