import type { z } from "zod";
import type { certificateSchema } from "../schemas/certificateSchemas";
export type Certificate = z.infer<typeof certificateSchema>;
export interface CertificateFilters {
  type?: Certificate["certificateType"];
  levelId?: string;
}
