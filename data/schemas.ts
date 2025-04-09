import { z } from "zod";

export const logPageVisitRequestSchema = z.object({
  eipNo: z.string(),
  type: z.string(),
});

export type LogPageVisitRequest = z.infer<typeof logPageVisitRequestSchema>;

export const AISummaryRequestSchema = z.object({
  eipNo: z.string(),
  type: z.string().optional(),
});

export type AISummaryRequest = z.infer<typeof AISummaryRequestSchema>;
