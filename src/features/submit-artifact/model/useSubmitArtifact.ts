import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { type SubmitArtifactInput, submitArtifact } from "../api";

/**
 * P0-2: one idempotency key per logical submission attempt. The key is kept
 * for the lifetime of the mutation and reused across retries after a failure,
 * then reset once the request succeeds (onSuccess), so a retried request never creates a
 * duplicate submission server-side, but subsequent new user submissions get fresh keys.
 */
export const useSubmitArtifact = () => {
  const idempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const queryClient = useQueryClient();

  const getKey = (artifactId: string) => {
    if (!idempotencyKeysRef.current.has(artifactId)) {
      idempotencyKeysRef.current.set(artifactId, crypto.randomUUID());
    }
    // biome-ignore lint/style/noNonNullAssertion: map has() + set() guarantees existence
    return idempotencyKeysRef.current.get(artifactId)!;
  };

  return useMutation({
    mutationFn: (input: SubmitArtifactInput) => {
      const key = getKey(input.artifactId);
      return submitArtifact(input, key);
    },
    onSuccess: (_data, variables) => {
      idempotencyKeysRef.current.delete(variables.artifactId);
      queryClient.invalidateQueries({ queryKey: ["submission-evaluation"] });
      queryClient.invalidateQueries({ queryKey: ["levelModuleDetails"] });
      queryClient.invalidateQueries({ queryKey: ["levelContent"] });
    },
  });
};
