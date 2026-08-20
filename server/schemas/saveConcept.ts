import { z } from "zod";


export const SaveConceptSchema =
  z.object({
    term:
      z.string().min(1),

    aliases:
      z.array(
        z.string().min(1),
      )
      .optional(),

    definition_short:
      z.string()
        .optional(),

    definition_detailed:
      z.string()
        .optional(),

    intuition:
      z.string()
        .optional(),

    why_it_matters:
      z.string()
        .optional(),

    tags:
      z.array(
        z.string().min(1),
      )
      .optional(),

    source_context:
      z.object({
        user_question:
          z.string()
            .optional(),

        assistant_answer:
          z.string()
            .optional(),

        conversation_note:
          z.string()
            .optional(),
      })
      .optional(),
  });


export type SaveConceptInput =
  z.infer<
    typeof SaveConceptSchema
  >;