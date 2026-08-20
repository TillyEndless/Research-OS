import { z } from "zod";

export const SearchableEntityTypeSchema = z.enum([
  "source",
  "hypothesis",
  "experiment",
  "finding",
  "decision",
  "action",
  "paper",
  "concept",
]);

export const SearchResearchMemorySchema = z.object({
  query: z.string().min(1),

  /**
   * GPT can provide additional canonical keywords.
   *
   * Example:
   * query:
   *   "老师说 B 可能自己学会 textual CoT"
   *
   * keywords:
   *   ["decoder", "B", "textual CoT", "latent"]
   */
  keywords: z
    .array(z.string().min(1))
    .default([]),

  entity_types: z
    .array(SearchableEntityTypeSchema)
    .optional(),

  statuses: z
    .array(z.string())
    .optional(),

  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10),
});

export type SearchResearchMemoryInput =
  z.infer<typeof SearchResearchMemorySchema>;

export type SearchableEntityType =
  z.infer<typeof SearchableEntityTypeSchema>;