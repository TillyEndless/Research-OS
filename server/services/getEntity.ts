import { db } from "../db/database.js";

import {
  GetEntitySchema,
  type GetEntityInput,
} from "../schemas/entity.js";

import type {
  EntityType,
} from "../db/idAllocator.js";


// =========================================================
// Database rows
// =========================================================

type BaseEntityRow = {
  id: string;
  type: EntityType;
  title: string;
  status: string | null;
  created_at: string;
  updated_at: string;
};


type RelationRow = {
  relation_id: number;

  relation_type: string;

  metadata_json: string | null;

  neighbor_id: string;

  neighbor_type: EntityType;

  neighbor_title: string;

  neighbor_status: string | null;
};


// =========================================================
// Public result
// =========================================================

export type EntityRelation = {
  relation_id: number;

  relation_type: string;

  metadata: unknown | null;

  entity: {
    id: string;
    type: EntityType;
    title: string;
    status: string | null;
  };
};


export type GetEntityResult = {
  entity: {
    id: string;
    type: EntityType;
    title: string;
    status: string | null;

    created_at: string;
    updated_at: string;

    details: Record<string, unknown>;
  };

  outgoing_relations: EntityRelation[];

  incoming_relations: EntityRelation[];
};


// =========================================================
// Helpers
// =========================================================

function parseJson(
  value: string | null,
): unknown | null {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}


/**
 * Converts:
 *
 * configuration_json -> configuration
 * metrics_json       -> metrics
 *
 * while preserving normal columns unchanged.
 */
function decodeJsonColumns(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (
    const [key, value]
    of Object.entries(row)
  ) {

    if (
      key.endsWith("_json")
    ) {
      const decodedKey =
        key.slice(
          0,
          -"_json".length,
        );

      result[decodedKey] =
        typeof value === "string"
          ? parseJson(value)
          : value;

      continue;
    }

    result[key] = value;
  }

  return result;
}


/**
 * entity_id itself already exists on the base entity,
 * so remove it from subtype details.
 */
function cleanSubtypeRow(
  row: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!row) {
    return {};
  }

  const decoded =
    decodeJsonColumns(row);

  delete decoded.entity_id;

  return decoded;
}


// =========================================================
// Subtype loading
// =========================================================

function loadSubtypeDetails(
  entity: BaseEntityRow,
): Record<string, unknown> {

  switch (entity.type) {

    case "source": {
      const row = db
        .prepare(`
          SELECT *
          FROM sources
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    case "hypothesis": {
      const row = db
        .prepare(`
          SELECT *
          FROM hypotheses
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    case "experiment": {
      const row = db
        .prepare(`
          SELECT *
          FROM experiments
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    case "finding": {
      const row = db
        .prepare(`
          SELECT *
          FROM findings
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    case "decision": {
      const row = db
        .prepare(`
          SELECT *
          FROM decisions
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    case "action": {
      const row = db
        .prepare(`
          SELECT *
          FROM actions
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    case "paper": {
      const row = db
        .prepare(`
          SELECT *
          FROM papers
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    case "concept": {
      const row = db
        .prepare(`
          SELECT *
          FROM concepts
          WHERE entity_id = ?
        `)
        .get(entity.id) as
          | Record<string, unknown>
          | undefined;

      return cleanSubtypeRow(row);
    }


    default: {
      const unreachable: never =
        entity.type;

      throw new Error(
        `Unsupported entity type: ${unreachable}`,
      );
    }
  }
}


// =========================================================
// Relations
// =========================================================

function loadOutgoingRelations(
  entityId: string,
): EntityRelation[] {

  const rows = db
    .prepare(`
      SELECT
        r.id AS relation_id,

        r.relation_type,

        r.metadata_json,

        target.id
          AS neighbor_id,

        target.type
          AS neighbor_type,

        target.title
          AS neighbor_title,

        target.status
          AS neighbor_status

      FROM relations r

      JOIN entities target
        ON target.id =
           r.target_entity_id

      WHERE
        r.source_entity_id = ?

      ORDER BY r.id
    `)
    .all(entityId) as RelationRow[];


  return rows.map((row) => ({
    relation_id:
      row.relation_id,

    relation_type:
      row.relation_type,

    metadata:
      parseJson(
        row.metadata_json,
      ),

    entity: {
      id:
        row.neighbor_id,

      type:
        row.neighbor_type,

      title:
        row.neighbor_title,

      status:
        row.neighbor_status,
    },
  }));
}


function loadIncomingRelations(
  entityId: string,
): EntityRelation[] {

  const rows = db
    .prepare(`
      SELECT
        r.id AS relation_id,

        r.relation_type,

        r.metadata_json,

        source.id
          AS neighbor_id,

        source.type
          AS neighbor_type,

        source.title
          AS neighbor_title,

        source.status
          AS neighbor_status

      FROM relations r

      JOIN entities source
        ON source.id =
           r.source_entity_id

      WHERE
        r.target_entity_id = ?

      ORDER BY r.id
    `)
    .all(entityId) as RelationRow[];


  return rows.map((row) => ({
    relation_id:
      row.relation_id,

    relation_type:
      row.relation_type,

    metadata:
      parseJson(
        row.metadata_json,
      ),

    entity: {
      id:
        row.neighbor_id,

      type:
        row.neighbor_type,

      title:
        row.neighbor_title,

      status:
        row.neighbor_status,
    },
  }));
}


// =========================================================
// Main service
// =========================================================

export function getEntity(
  rawInput: unknown,
): GetEntityResult {

  const input: GetEntityInput =
    GetEntitySchema.parse(
      rawInput,
    );


  const entity = db
    .prepare(`
      SELECT
        id,
        type,
        title,
        status,
        created_at,
        updated_at

      FROM entities

      WHERE id = ?
    `)
    .get(
      input.entity_id,
    ) as
      | BaseEntityRow
      | undefined;


  if (!entity) {
    throw new Error(
      `Entity not found: ${input.entity_id}`,
    );
  }


  const details =
    loadSubtypeDetails(entity);


  const outgoingRelations =
    loadOutgoingRelations(
      entity.id,
    );


  const incomingRelations =
    loadIncomingRelations(
      entity.id,
    );


  return {
    entity: {
      id:
        entity.id,

      type:
        entity.type,

      title:
        entity.title,

      status:
        entity.status,

      created_at:
        entity.created_at,

      updated_at:
        entity.updated_at,

      details,
    },

    outgoing_relations:
      outgoingRelations,

    incoming_relations:
      incomingRelations,
  };
}