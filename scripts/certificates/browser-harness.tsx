import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "../../src/app/styles/index.css";
import { useAuthStore } from "../../src/entities/session";
import { CertificatesPage } from "../../src/pages/certificates";
import { authClient } from "../../src/shared/api";
import { queryClient } from "../../src/shared/lib/queryClient";

const apiOrigin = import.meta.env.VITE_CERTIFICATE_TEST_API;
if (!apiOrigin) throw new Error("VITE_CERTIFICATE_TEST_API is required");

// This browser-only harness replaces the SSO transport while retaining the
// production auth store, query hook, certificate page, actions, and API parser.
Object.assign(authClient, {
  request: (path: string, options?: RequestInit) => fetch(`${apiOrigin}${path}`, options),
});

export function Journey() {
  const user = useAuthStore((state) => state.user);
  const [completing, setCompleting] = useState(false);
  if (!user) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-bold">Local certificate journey</h1>
        <button
          type="button"
          className="mt-8 rounded-lg bg-brand-600 px-5 py-3 font-medium text-white"
          onClick={() =>
            useAuthStore.setState({
              user: {
                id: "local-certificate-learner",
                email: "certificate@example.test",
                roles: ["learner"],
                products: ["lte"],
                user_metadata: {},
              },
              isAuthenticated: true,
              initialized: true,
              loading: false,
            })
          }
        >
          Sign in as local learner
        </button>
      </main>
    );
  }
  return (
    <main className="p-8">
      <button
        type="button"
        disabled={completing}
        className="mb-8 rounded-lg bg-brand-600 px-5 py-3 font-medium text-white disabled:opacity-50"
        onClick={async () => {
          setCompleting(true);
          try {
            const response = await fetch(`${apiOrigin}/__certificate-test/complete`, {
              method: "POST",
            });
            if (!response.ok) throw new Error("Local completion failed");
            await queryClient.invalidateQueries({ queryKey: ["certificates"] });
          } finally {
            setCompleting(false);
          }
        }}
      >
        {completing ? "Completing…" : "Complete learning path"}
      </button>
      <CertificatesPage />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Journey />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
