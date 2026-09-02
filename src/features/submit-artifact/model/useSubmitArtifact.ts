import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { type SubmitArtifactInput, submitArtifact } from "../api";

/**
 * Submits an artifact for evaluation with a retry-safe idempotency key.
 */
export const useSubmitArtifact = () => {
  const idempotencyKeyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitArtifactInput) => {
      idempotencyKeyRef.current = idempotencyKeyRef.current ?? crypto.randomUUID();
      return submitArtifact(input, idempotencyKeyRef.current);
    },
    onSuccess: () => {
      idempotencyKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["submission-evaluation"] });
      queryClient.invalidateQueries({ queryKey: ["levelModuleDetails"] });
      queryClient.invalidateQueries({ queryKey: ["levelContent"] });
    },
  });
};
