import { z } from "zod";
/** Validate only bindings owned by this machine-to-machine boundary. */
export const internalServiceEnvSchema = z.object({ LTE_INTERNAL_SECRET: z.string().min(32) });
