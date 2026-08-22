import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { type SubmitArtifactInput, submitArtifact } from "../api";

/**
 * P0-2: one idempotency key per logical submission attempt. The key is kept
 * for the lifetime of the mutation and reused across retries after a failure,
 * then reset once the request succeeds (onSuccess), so a retried request never creates a
 * duplicate submission server-side, but subsequent new user submissions get fresh keys.
 */
export const useSubmitArtifact = () => {
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  return useMutation({
    mutationFn: (input: SubmitArtifactInput) => {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      return submitArtifact(input, idempotencyKeyRef.current);
    },
    onSuccess: () => {
      idempotencyKeyRef.current = undefined;
    },
  });
};
