import { db } from "../db/database.js";

import {
  UpdateEntitySchema,
} from "../schemas/updateEntity.js";

import type {
  EntityType,
} from "../db/idAllocator.js";


type EntityRow = {
  id: string;
  type: EntityType;
};


const tableByType:
Record<EntityType, string> = {
  source:
    "sources",

  hypothesis:
    "hypotheses",

  experiment:
    "experiments",

  finding:
    "findings",

  decision:
    "decisions",

  action:
    "actions",

  paper:
    "papers",

  concept:
    "concepts",
};


const editableFields:
Record<EntityType, Set<string>> = {
  source: new Set([
    "source_date",
    "summary",
    "uri",
  ]),

  hypothesis: new Set([
    "statement",
    "confidence",
    "rationale",
  ]),

  experiment: new Set([
    "question",
    "baseline",
    "variant",
    "model",
    "dataset",
    "result_summary",
    "started_at",
    "completed_at",
  ]),

  finding: new Set([
    "kind",
    "statement",
    "confidence",
  ]),

  decision: new Set([
    "decision_text",
    "reason",
    "effective_date",
  ]),

  action: new Set([
    "task",
    "priority",
    "due_date",
  ]),

  paper: new Set([
    "authors",
    "venue",
    "year",
    "research_area",
    "background",
    "problem",
    "core_insight",
    "method",
    "experiment_summary",
    "limitations",
    "relation_to_our_work",
  ]),

  concept: new Set([
    "term",
    "definition_short",
    "definition_detailed",
    "intuition",
    "why_it_matters",
  ]),
};


export function updateEntity(
  rawInput: unknown,
) {
  const input =
    UpdateEntitySchema.parse(
      rawInput,
    );


  const entity = db
    .prepare(`
      SELECT
        id,
        type

      FROM entities

      WHERE id = ?
    `)
    .get(
      input.entity_id,
    ) as
      | EntityRow
      | undefined;


  if (!entity) {
    throw new Error(
      `Entity not found: ${input.entity_id}`,
    );
  }


  db.exec(
    "BEGIN IMMEDIATE",
  );


  try {

    if (
      input.title !== undefined
    ) {
      db.prepare(`
        UPDATE entities

        SET
          title = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
      `).run(
        input.title,
        entity.id,
      );
    }


    if (
      input.status !== undefined
    ) {
      db.prepare(`
        UPDATE entities

        SET
          status = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
      `).run(
        input.status,
        entity.id,
      );
    }


    if (input.details) {

      const allowed =
        editableFields[
          entity.type
        ];

      const table =
        tableByType[
          entity.type
        ];


      for (
        const [
          field,
          value,
        ]
        of Object.entries(
          input.details,
        )
      ) {

        if (
          !allowed.has(field)
        ) {
          throw new Error(
            `Field "${field}" is not editable for entity type ${entity.type}`,
          );
        }


        db.prepare(`
          UPDATE ${table}

          SET ${field} = ?

          WHERE entity_id = ?
        `).run(
          value === undefined
            ? null
            : value as
                | string
                | number
                | bigint
                | null,

          entity.id,
        );
      }


      db.prepare(`
        UPDATE entities

        SET updated_at =
          CURRENT_TIMESTAMP

        WHERE id = ?
      `).run(
        entity.id,
      );
    }


    db.exec(
      "COMMIT",
    );


    return {
      entity_id:
        entity.id,

      updated:
        true,
    };

  } catch (error) {

    db.exec(
      "ROLLBACK",
    );

    throw error;
  }
}