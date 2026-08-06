import { z } from "zod";

export const DashboardXpQuerySchema = z.object({
  since: z.coerce.date().optional(),
  todaySince: z.coerce.date().optional(),
});
