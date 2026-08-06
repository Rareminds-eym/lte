import { useMutation } from "@tanstack/react-query";
import { type SubmitArtifactInput, submitArtifact } from "../api";

export const useSubmitArtifact = () =>
  useMutation({
    mutationFn: (input: SubmitArtifactInput) => submitArtifact(input),
  });
