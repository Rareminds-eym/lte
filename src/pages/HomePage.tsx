import type React from "react";

export const HomePage: React.FC = () => {
  return (
    <div style={{ padding: "2rem" }}>
      <span>home </span>
      <a href="/dashboard" style={{ color: "#2563eb", textDecoration: "underline" }}>
        Dashboard
      </a>
    </div>
  );
};

export default HomePage;
