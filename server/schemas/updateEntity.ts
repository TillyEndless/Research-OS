import { z } from "zod";

import {
  EntityId,
} from "./ingest.js";


export const UpdateEntitySchema =
  z.object({
    entity_id:
      EntityId,

    title:
      z.string()
        .min(1)
        .optional(),

    status:
      z.string()
        .min(1)
        .optional(),

    details:
      z.record(
        z.string(),
        z.unknown(),
      )
      .optional(),
  });


export type UpdateEntityInput =
  z.infer<
    typeof UpdateEntitySchema
  >;