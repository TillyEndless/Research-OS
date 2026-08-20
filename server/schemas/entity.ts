import { z } from "zod";

import {
  EntityId,
} from "./ingest.js";


export const GetEntitySchema = z.object({
  entity_id: EntityId,
});


export type GetEntityInput =
  z.infer<typeof GetEntitySchema>;