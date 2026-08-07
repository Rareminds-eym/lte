import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { type SubmitArtifactInput, submitArtifact } from "../api";

/**
 * P0-2: one idempotency key per logical submission attempt. The key is kept
 * for the lifetime of the mutation (including React Query's automatic retries)
 * and reset once the request settles, so a retried request never creates a
 * duplicate submission server-side.
 */
export const useSubmitArtifact = () => {
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  return useMutation({
    mutationFn: (input: SubmitArtifactInput) => {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      return submitArtifact(input, idempotencyKeyRef.current);
    },
    onSettled: () => {
      idempotencyKeyRef.current = undefined;
    },
  });
};
