import { db } from "../db/database.js";

import {
  allocateEntityId,
  type EntityType,
} from "../db/idAllocator.js";

import {
  IngestResearchUpdateSchema,
  type IngestResearchUpdate,
  type WorkspaceStatePatch,
} from "../schemas/ingest.js";

type EntityRow = {
  id: string;
  type: EntityType;
};


type EntityDraftWithType = {
  type: EntityType;
  draft: any;
};


export type IngestResult = {
  client_ref_map: Record<string, string>;

  created_entities: string[];

  updated_entities: string[];

  relation_count: number;

  workspace_state_updated: boolean;
};


/**
 * SQLite cannot bind undefined.
 * Convert optional JS values into SQL NULL.
 */
function nullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}


/**
 * Convert structured values into JSON for SQLite TEXT columns.
 */
function jsonOrNull(
  value: unknown | undefined,
): string | null {
  return value === undefined
    ? null
    : JSON.stringify(value);
}


/**
 * Check whether an entity already exists.
 */
function getExistingEntity(
  entityId: string,
): EntityRow | undefined {
  return db
    .prepare(`
      SELECT id, type
      FROM entities
      WHERE id = ?
    `)
    .get(entityId) as EntityRow | undefined;
}


/**
 * Resolve either:
 *
 *   "h_decoder_bypass" -> H017
 *
 * or directly:
 *
 *   "H017" -> H017
 */
function resolveEntityReference(
  ref: string,
  clientRefMap: Map<string, string>,
): string {
  const local = clientRefMap.get(ref);

  if (local) {
    return local;
  }

  const existing = getExistingEntity(ref);

  if (existing) {
    return existing.id;
  }

  throw new Error(
    `Unable to resolve entity reference: ${ref}`,
  );
}


/**
 * Insert or update the global entities registry.
 */
function persistBaseEntity(
  type: EntityType,
  draft: any,
  clientRefMap: Map<string, string>,
  created: string[],
  updated: string[],
): string {
  let entityId: string;

  if (draft.entity_id) {
    // -----------------------------------------
    // Existing entity
    // -----------------------------------------

    const existing = getExistingEntity(
      draft.entity_id,
    );

    if (!existing) {
      throw new Error(
        `Entity ${draft.entity_id} does not exist`,
      );
    }

    if (existing.type !== type) {
      throw new Error(
        `Entity type mismatch for ${draft.entity_id}: ` +
        `database=${existing.type}, incoming=${type}`,
      );
    }

    entityId = draft.entity_id;

    db.prepare(`
      UPDATE entities

      SET
        title = ?,

        status = CASE
          WHEN ? IS NULL
          THEN status
          ELSE ?
        END,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = ?
    `).run(
      draft.title,
      nullable(draft.status),
      nullable(draft.status),
      entityId,
    );

    updated.push(entityId);
  } else {
    // -----------------------------------------
    // New entity
    // -----------------------------------------

    entityId = allocateEntityId(type);

    db.prepare(`
      INSERT INTO entities (
        id,
        type,
        title,
        status
      )

      VALUES (?, ?, ?, ?)
    `).run(
      entityId,
      type,
      draft.title,
      nullable(draft.status),
    );

    created.push(entityId);
  }

  clientRefMap.set(
    draft.client_ref,
    entityId,
  );

  return entityId;
}


/**
 * Persist subtype-specific data.
 *
 * UPSERT is used so the same function works for both
 * new entities and existing entities.
 */
function persistSubtype(
  type: EntityType,
  entityId: string,
  draft: any,
): void {
  switch (type) {

    // =====================================================
    // Source
    // =====================================================

    case "source": {
      db.prepare(`
        INSERT INTO sources (
          entity_id,
          source_type,
          source_date,
          file_name,
          uri,
          raw_text,
          summary
        )

        VALUES (?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(entity_id)
        DO UPDATE SET
          source_type = excluded.source_type,
          source_date = excluded.source_date,
          file_name = excluded.file_name,
          uri = excluded.uri,
          raw_text = excluded.raw_text,
          summary = excluded.summary
      `).run(
        entityId,
        draft.source_type,
        nullable(draft.source_date),
        nullable(draft.file_name),
        nullable(draft.uri),
        nullable(draft.raw_text),
        nullable(draft.summary),
      );

      break;
    }


    // =====================================================
    // Hypothesis
    // =====================================================

    case "hypothesis": {
      db.prepare(`
        INSERT INTO hypotheses (
          entity_id,
          statement,
          confidence,
          rationale
        )

        VALUES (?, ?, ?, ?)

        ON CONFLICT(entity_id)
        DO UPDATE SET
          statement = excluded.statement,
          confidence = excluded.confidence,
          rationale = excluded.rationale
      `).run(
        entityId,
        draft.statement,
        nullable(draft.confidence),
        nullable(draft.rationale),
      );

      break;
    }


    // =====================================================
    // Experiment
    // =====================================================

    case "experiment": {
      db.prepare(`
        INSERT INTO experiments (
          entity_id,
          question,
          baseline,
          variant,
          model,
          dataset,
          configuration_json,
          controlled_variables_json,
          metrics_json,
          result_summary,
          started_at,
          completed_at
        )

        VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )

        ON CONFLICT(entity_id)
        DO UPDATE SET
          question = excluded.question,
          baseline = excluded.baseline,
          variant = excluded.variant,
          model = excluded.model,
          dataset = excluded.dataset,
          configuration_json =
            excluded.configuration_json,
          controlled_variables_json =
            excluded.controlled_variables_json,
          metrics_json =
            excluded.metrics_json,
          result_summary =
            excluded.result_summary,
          started_at =
            excluded.started_at,
          completed_at =
            excluded.completed_at
      `).run(
        entityId,
        nullable(draft.question),
        nullable(draft.baseline),
        nullable(draft.variant),
        nullable(draft.model),
        nullable(draft.dataset),
        jsonOrNull(draft.configuration),
        jsonOrNull(draft.controlled_variables),
        jsonOrNull(draft.metrics),
        nullable(draft.result_summary),
        nullable(draft.started_at),
        nullable(draft.completed_at),
      );

      break;
    }


    // =====================================================
    // Finding
    // =====================================================

    case "finding": {
      db.prepare(`
        INSERT INTO findings (
          entity_id,
          kind,
          statement,
          confidence
        )

        VALUES (?, ?, ?, ?)

        ON CONFLICT(entity_id)
        DO UPDATE SET
          kind = excluded.kind,
          statement = excluded.statement,
          confidence = excluded.confidence
      `).run(
        entityId,
        draft.kind,
        draft.statement,
        nullable(draft.confidence),
      );

      break;
    }


    // =====================================================
    // Decision
    // =====================================================

    case "decision": {
      db.prepare(`
        INSERT INTO decisions (
          entity_id,
          decision_text,
          reason,
          effective_date
        )

        VALUES (?, ?, ?, ?)

        ON CONFLICT(entity_id)
        DO UPDATE SET
          decision_text =
            excluded.decision_text,
          reason =
            excluded.reason,
          effective_date =
            excluded.effective_date
      `).run(
        entityId,
        draft.decision_text,
        nullable(draft.reason),
        nullable(draft.effective_date),
      );

      break;
    }


    // =====================================================
    // Action
    // =====================================================

    case "action": {
      db.prepare(`
        INSERT INTO actions (
          entity_id,
          task,
          priority,
          due_date
        )

        VALUES (?, ?, ?, ?)

        ON CONFLICT(entity_id)
        DO UPDATE SET
          task = excluded.task,
          priority = excluded.priority,
          due_date = excluded.due_date
      `).run(
        entityId,
        draft.task,
        nullable(draft.priority),
        nullable(draft.due_date),
      );

      break;
    }


    // =====================================================
    // Paper
    // =====================================================

    case "paper": {
      db.prepare(`
        INSERT INTO papers (
          entity_id,
          authors,
          venue,
          year,
          arxiv_id,
          url,
          research_area,
          background,
          problem,
          core_insight,
          method,
          experiment_summary,
          limitations,
          relation_to_our_work,
          metadata_json
        )

        VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?
        )

        ON CONFLICT(entity_id)
        DO UPDATE SET
          authors = excluded.authors,
          venue = excluded.venue,
          year = excluded.year,
          arxiv_id = excluded.arxiv_id,
          url = excluded.url,
          research_area = excluded.research_area,
          background = excluded.background,
          problem = excluded.problem,
          core_insight = excluded.core_insight,
          method = excluded.method,
          experiment_summary =
            excluded.experiment_summary,
          limitations = excluded.limitations,
          relation_to_our_work =
            excluded.relation_to_our_work,
          metadata_json =
            excluded.metadata_json
      `).run(
        entityId,
        nullable(draft.authors),
        nullable(draft.venue),
        nullable(draft.year),
        nullable(draft.arxiv_id),
        nullable(draft.url),
        nullable(draft.research_area),
        nullable(draft.background),
        nullable(draft.problem),
        nullable(draft.core_insight),
        nullable(draft.method),
        nullable(draft.experiment_summary),
        nullable(draft.limitations),
        nullable(draft.relation_to_our_work),
        jsonOrNull(draft.metadata),
      );

      break;
    }


    // =====================================================
    // Concept
    // =====================================================

    case "concept": {
      db.prepare(`
        INSERT INTO concepts (
          entity_id,
          term,
          aliases_json,
          definition_short,
          definition_detailed,
          intuition,
          why_it_matters,
          tags_json
        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(entity_id)
        DO UPDATE SET
          term = excluded.term,
          aliases_json = excluded.aliases_json,
          definition_short =
            excluded.definition_short,
          definition_detailed =
            excluded.definition_detailed,
          intuition =
            excluded.intuition,
          why_it_matters =
            excluded.why_it_matters,
          tags_json =
            excluded.tags_json
      `).run(
        entityId,
        draft.term,
        jsonOrNull(draft.aliases),
        nullable(draft.definition_short),
        nullable(draft.definition_detailed),
        nullable(draft.intuition),
        nullable(draft.why_it_matters),
        jsonOrNull(draft.tags),
      );

      break;
    }


    default: {
      const unreachable: never = type;

      throw new Error(
        `Unsupported entity type: ${unreachable}`,
      );
    }
  }
}
// =========================================================
// Workspace state
// =========================================================

/**
 * Persist the derived current research state.
 *
 * IMPORTANT:
 *
 * workspace_state is only a current-state projection.
 * It does NOT replace historical entities, findings,
 * decisions, experiments, or relations.
 *
 * Undefined fields mean:
 *   keep the existing database value unchanged.
 */
function persistWorkspaceState(
  patch: WorkspaceStatePatch | undefined,
): boolean {

  if (!patch) {
    return false;
  }


  const coreQuestion =
    nullable(
      patch.core_question,
    );


  const currentSummary =
    nullable(
      patch.current_summary,
    );


  const majorContradictions =
    patch.major_contradictions === undefined
      ? null
      : JSON.stringify(
          patch.major_contradictions,
        );


  const blockers =
    patch.blockers === undefined
      ? null
      : JSON.stringify(
          patch.blockers,
        );


  db.prepare(`
    UPDATE workspace_state

    SET
      core_question = CASE
        WHEN ? IS NULL
        THEN core_question
        ELSE ?
      END,

      current_summary = CASE
        WHEN ? IS NULL
        THEN current_summary
        ELSE ?
      END,

      major_contradictions_json = CASE
        WHEN ? IS NULL
        THEN major_contradictions_json
        ELSE ?
      END,

      blockers_json = CASE
        WHEN ? IS NULL
        THEN blockers_json
        ELSE ?
      END,

      updated_at = CURRENT_TIMESTAMP

    WHERE id = 1
  `).run(
    coreQuestion,
    coreQuestion,

    currentSummary,
    currentSummary,

    majorContradictions,
    majorContradictions,

    blockers,
    blockers,
  );


  return true;
}

/**
 * Main ResearchOS ingestion service.
 */
export function ingestResearchUpdate(
  rawInput: unknown,
): IngestResult {

  // -------------------------------------------------------
  // 1. Validate all incoming data with Zod.
  // -------------------------------------------------------

  const input: IngestResearchUpdate =
    IngestResearchUpdateSchema.parse(rawInput);


  // -------------------------------------------------------
  // 2. Flatten typed entity arrays.
  // -------------------------------------------------------

  const allEntities: EntityDraftWithType[] = [
    ...input.sources.map((draft) => ({
      type: "source" as const,
      draft,
    })),

    ...input.hypotheses.map((draft) => ({
      type: "hypothesis" as const,
      draft,
    })),

    ...input.experiments.map((draft) => ({
      type: "experiment" as const,
      draft,
    })),

    ...input.findings.map((draft) => ({
      type: "finding" as const,
      draft,
    })),

    ...input.decisions.map((draft) => ({
      type: "decision" as const,
      draft,
    })),

    ...input.actions.map((draft) => ({
      type: "action" as const,
      draft,
    })),

    ...input.papers.map((draft) => ({
      type: "paper" as const,
      draft,
    })),

    ...input.concepts.map((draft) => ({
      type: "concept" as const,
      draft,
    })),
  ];


  // -------------------------------------------------------
  // 3. Reject duplicate client_ref values.
  // -------------------------------------------------------

  const seenClientRefs = new Set<string>();

  for (const { draft } of allEntities) {
    if (seenClientRefs.has(draft.client_ref)) {
      throw new Error(
        `Duplicate client_ref: ${draft.client_ref}`,
      );
    }

    seenClientRefs.add(draft.client_ref);
  }


  const clientRefMap =
    new Map<string, string>();

  const createdEntities: string[] = [];

  const updatedEntities: string[] = [];

  // -------------------------------------------------------
  // 4. Atomic transaction.
  // -------------------------------------------------------

  let workspaceStateUpdated = false;

  db.exec("BEGIN IMMEDIATE");

  try {

    // -----------------------------------------------------
    // Persist every entity first.
    //
    // Relations come later because every reference must
    // already have a permanent ID.
    // -----------------------------------------------------

    for (const {
      type,
      draft,
    } of allEntities) {

      const entityId =
        persistBaseEntity(
          type,
          draft,
          clientRefMap,
          createdEntities,
          updatedEntities,
        );

      persistSubtype(
        type,
        entityId,
        draft,
      );
    }


    // -----------------------------------------------------
    // Persist graph relations.
    // -----------------------------------------------------

    for (const relation of input.relations) {

      const sourceId =
        resolveEntityReference(
          relation.source_ref,
          clientRefMap,
        );

      const targetId =
        resolveEntityReference(
          relation.target_ref,
          clientRefMap,
        );

      db.prepare(`
        INSERT OR IGNORE INTO relations (
          source_entity_id,
          target_entity_id,
          relation_type,
          metadata_json
        )

        VALUES (?, ?, ?, ?)
      `).run(
        sourceId,
        targetId,
        relation.relation_type,
        jsonOrNull(
          relation.metadata,
        ),
      );
    }


    // -----------------------------------------------------
    // Persist derived current workspace state.
    //
    // This is a current-state projection only.
    // Historical entities and relations remain preserved.
    // -----------------------------------------------------

    workspaceStateUpdated =
      persistWorkspaceState(
        input.workspace_state,
      );


    // -----------------------------------------------------
    // Commit only after everything succeeded.
    // -----------------------------------------------------

    db.exec("COMMIT");

  } catch (error) {

    // -----------------------------------------------------
    // No half-written research memory.
    // -----------------------------------------------------

    db.exec("ROLLBACK");

    throw error;
  }


  return {
    client_ref_map:
      Object.fromEntries(clientRefMap),

    created_entities:
      createdEntities,

    updated_entities:
      updatedEntities,

    relation_count:
      input.relations.length,

    workspace_state_updated:
      workspaceStateUpdated,
  };
}