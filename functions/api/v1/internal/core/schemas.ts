import { z } from "zod";

/**
 * Shared gateway action payload: every learner-scoped sync action only needs the
 * authenticated user's id (the actual subject is verified against the signed
 * per-user claim by `defineAction`, so this is purely declarative).
 */
export const UserPayloadSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
});
