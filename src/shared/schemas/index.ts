import { z } from "zod";
import { SEARCH_QUERY_MAX_LENGTH } from "@/shared/config";

// Shared Zod schemas for validation

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

export type User = z.infer<typeof UserSchema>;

export const PaginationParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const SearchQuerySchema = z.string().trim().max(SEARCH_QUERY_MAX_LENGTH);
