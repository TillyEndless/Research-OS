import { db } from "./database.js";

export type EntityType =
  | "source"
  | "hypothesis"
  | "experiment"
  | "finding"
  | "decision"
  | "action"
  | "paper"
  | "concept";

type CounterRow = {
  prefix: string;
  next_number: number;
};

export function allocateEntityId(type: EntityType): string {
  const row = db
    .prepare(`
      SELECT prefix, next_number
      FROM id_counters
      WHERE entity_type = ?
    `)
    .get(type) as CounterRow | undefined;

  if (!row) {
    throw new Error(`No ID counter configured for entity type: ${type}`);
  }

  const id =
    `${row.prefix}${String(row.next_number).padStart(3, "0")}`;

  db.prepare(`
    UPDATE id_counters
    SET next_number = ?
    WHERE entity_type = ?
  `).run(row.next_number + 1, type);

  return id;
}