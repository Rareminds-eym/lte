import type React from "react";
import { useNavigate } from "react-router-dom";

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <button type="button" onClick={() => navigate("/")} style={{ padding: "0.5rem 1rem" }}>
        Go back to Dashboard
      </button>
    </div>
  );
};
