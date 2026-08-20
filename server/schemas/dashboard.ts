import { z } from "zod";

export const GetDashboardSnapshotSchema =
  z.object({});

export type GetDashboardSnapshotInput =
  z.infer<
    typeof GetDashboardSnapshotSchema
  >;