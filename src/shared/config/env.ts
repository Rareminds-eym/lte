import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_SKILLPASSPORT_URL: z.string().url("VITE_SKILLPASSPORT_URL must be a valid URL"),
});

export const getClientEnv = () => {
  const url = import.meta.env["VITE_SKILLPASSPORT_URL"];
  if (!url || url.trim() === "") {
    throw new Error("VITE_SKILLPASSPORT_URL environment variable is not configured");
  }
  const result = clientEnvSchema.safeParse(import.meta.env);
  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Client environment variable validation failed: ${errorMsg}`);
  }
  return result.data;
};
