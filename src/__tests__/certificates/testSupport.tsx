import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type { Certificate } from "@/entities/certificate";

export const certificate: Certificate = {
  credentialId: "LTE-0123456789ABCDEF",
  certificateType: "course_completion",
  status: "issued",
  title: "Problem solving",
  subtitle: "Engineering",
  levelLabel: "Level 1",
  badge: "skilled",
  completionDate: "2026-10-08T00:00:00Z",
  issuedAt: "2026-10-08T00:00:00Z",
  levelId: "22222222-2222-4222-8222-222222222222",
  roleId: null,
  verifyUrl: "https://skillpassport.rareminds.in/verify/LTE-0123456789ABCDEF",
  downloadable: true,
};
export function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
}
