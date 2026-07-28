import type React from "react";

export const HomePage: React.FC = () => {
  return (
    <div className="p-8">
      <span>home </span>
      <a href="/dashboard" className="text-brand-600 underline">
        Dashboard
      </a>
    </div>
  );
};
