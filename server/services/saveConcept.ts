import { db } from "../db/database.js";

import {
  allocateEntityId,
} from "../db/idAllocator.js";

import {
  SaveConceptSchema,
} from "../schemas/saveConcept.js";


export function saveConcept(
  rawInput: unknown,
) {
  const input =
    SaveConceptSchema.parse(
      rawInput,
    );


  const existing = db
    .prepare(`
      SELECT entity_id
      FROM concepts
      WHERE lower(term) = lower(?)
    `)
    .get(
      input.term,
    ) as
      | {
          entity_id: string;
        }
      | undefined;


  if (existing) {
    return {
      entity_id:
        existing.entity_id,

      created:
        false,

      reason:
        "concept_already_exists",
    };
  }


  db.exec(
    "BEGIN IMMEDIATE",
  );


  try {
    const entityId =
      allocateEntityId(
        "concept",
      );


    db.prepare(`
      INSERT INTO entities (
        id,
        type,
        title,
        status
      )

      VALUES (
        ?,
        'concept',
        ?,
        'starred'
      )
    `).run(
      entityId,
      input.term,
    );


    db.prepare(`
      INSERT INTO concepts (
        entity_id,
        term,
        aliases_json,
        definition_short,
        definition_detailed,
        intuition,
        why_it_matters,
        tags_json,
        source_context_json
      )

      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entityId,

      input.term,

      input.aliases === undefined
        ? null
        : JSON.stringify(
            input.aliases,
          ),

      input.definition_short ??
        null,

      input.definition_detailed ??
        null,

      input.intuition ??
        null,

      input.why_it_matters ??
        null,

      input.tags === undefined
        ? null
        : JSON.stringify(
            input.tags,
          ),

      input.source_context === undefined
        ? null
        : JSON.stringify(
            input.source_context,
          ),
    );


    db.exec(
      "COMMIT",
    );


    return {
      entity_id:
        entityId,

      created:
        true,
    };

  } catch (error) {
    db.exec(
      "ROLLBACK",
    );

    throw error;
  }
}