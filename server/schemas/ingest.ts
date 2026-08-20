import { z } from "zod";


// =========================================================
// References
// =========================================================

/**
 * Temporary reference used only inside one ingest request.
 *
 * Examples:
 *   meeting_today
 *   h_decoder_bypass
 *   e_freeze_b
 *
 * The server later resolves these into permanent IDs
 * such as S001, H017, E031, etc.
 */
export const ClientRef = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "client_ref must use lowercase letters, numbers and underscores"
  );


/**
 * Permanent ResearchOS entity ID.
 *
 * Prefixes:
 *   S = source
 *   H = hypothesis
 *   E = experiment
 *   F = finding
 *   D = decision
 *   A = action
 *   P = paper
 *   C = concept
 *
 * Examples:
 *   H001
 *   E031
 *   D009
 */
export const EntityId = z
  .string()
  .regex(
    /^[SHEFDAPC]\d{3,}$/,
    "entity_id must look like H001, E031, D009, etc."
  );


/**
 * A relation may point either to:
 *
 * 1. a temporary client_ref created in the current ingest
 * 2. an already-existing permanent ResearchOS entity ID
 *
 * Examples:
 *   h_decoder_bypass
 *   H017
 */
export const EntityReference = z.union([
  ClientRef,
  EntityId,
]);


// =========================================================
// Base entity
// =========================================================

/**
 * Every entity appearing in an ingest request has a
 * client_ref so relations within the current request
 * can refer to it.
 *
 * entity_id:
 *   omitted -> create a new entity
 *   present -> update/link an existing entity
 */
const BaseEntity = z.object({
  client_ref: ClientRef,

  entity_id: EntityId.optional(),

  title: z.string().min(1),

  status: z.string().optional(),
});


// =========================================================
// Source
// =========================================================

export const SourceDraftSchema = BaseEntity.extend({
  source_type: z.enum([
    "advisor_chat",
    "meeting_transcript",
    "experiment_log",
    "paper",
    "user_update",
    "other",
  ]),

  source_date: z.string().optional(),

  file_name: z.string().optional(),

  uri: z.string().optional(),

  summary: z.string().optional(),

  raw_text: z.string().optional(),
});


// =========================================================
// Hypothesis
// =========================================================

export const HypothesisDraftSchema = BaseEntity.extend({
  statement: z.string().min(1),

  confidence: z
    .enum([
      "low",
      "medium",
      "high",
    ])
    .optional(),

  rationale: z.string().optional(),
});


// =========================================================
// Experiment
// =========================================================

export const ExperimentDraftSchema = BaseEntity.extend({
  question: z.string().optional(),

  baseline: z.string().optional(),

  variant: z.string().optional(),

  model: z.string().optional(),

  dataset: z.string().optional(),

  configuration: z
    .record(
      z.string(),
      z.unknown()
    )
    .optional(),

  controlled_variables: z
    .record(
      z.string(),
      z.unknown()
    )
    .optional(),

  metrics: z
    .record(
      z.string(),
      z.unknown()
    )
    .optional(),

  result_summary: z.string().optional(),

  started_at: z.string().optional(),

  completed_at: z.string().optional(),
});


// =========================================================
// Finding
// =========================================================

/**
 * Important distinction:
 *
 * observation:
 *   directly observed experimental fact
 *
 * interpretation:
 *   explanation inferred from observations
 *
 * conclusion:
 *   stronger conclusion supported by accumulated evidence
 */
export const FindingDraftSchema = BaseEntity.extend({
  kind: z.enum([
    "observation",
    "interpretation",
    "conclusion",
  ]),

  statement: z.string().min(1),

  confidence: z
    .enum([
      "low",
      "medium",
      "high",
    ])
    .optional(),
});


// =========================================================
// Decision
// =========================================================

export const DecisionDraftSchema = BaseEntity.extend({
  decision_text: z.string().min(1),

  reason: z.string().optional(),

  effective_date: z.string().optional(),
});


// =========================================================
// Action
// =========================================================

export const ActionDraftSchema = BaseEntity.extend({
  task: z.string().min(1),

  priority: z
    .enum([
      "low",
      "medium",
      "high",
      "critical",
    ])
    .optional(),

  due_date: z.string().optional(),
});


// =========================================================
// Paper
// =========================================================

export const PaperDraftSchema = BaseEntity.extend({
  authors: z.string().optional(),

  venue: z.string().optional(),

  year: z
    .number()
    .int()
    .optional(),

  arxiv_id: z.string().optional(),

  url: z.string().optional(),

  research_area: z.string().optional(),

  background: z.string().optional(),

  problem: z.string().optional(),

  core_insight: z.string().optional(),

  method: z.string().optional(),

  experiment_summary: z.string().optional(),

  limitations: z.string().optional(),

  relation_to_our_work: z.string().optional(),

  metadata: z
    .record(
      z.string(),
      z.unknown()
    )
    .optional(),
});


// =========================================================
// Concept
// =========================================================

export const ConceptDraftSchema = BaseEntity.extend({
  term: z.string().min(1),

  aliases: z
    .array(z.string())
    .optional(),

  definition_short: z.string().optional(),

  definition_detailed: z.string().optional(),

  intuition: z.string().optional(),

  why_it_matters: z.string().optional(),

  tags: z
    .array(z.string())
    .optional(),
});


// =========================================================
// Relation
// =========================================================

/**
 * Both ends of a relation may point to:
 *
 * - an entity created in this ingest request via client_ref
 * - an existing entity via permanent entity_id
 *
 * Example:
 *
 * {
 *   source_ref: "meeting_today",
 *   relation_type: "updates",
 *   target_ref: "H017"
 * }
 */
export const RelationDraftSchema = z.object({
  source_ref: EntityReference,

  relation_type: z
    .string()
    .min(1),

  target_ref: EntityReference,

  metadata: z
    .record(
      z.string(),
      z.unknown()
    )
    .optional(),
});


// =========================================================
// Complete ingest request
// =========================================================

export const IngestResearchUpdateSchema = z.object({
  sources: z
    .array(SourceDraftSchema)
    .default([]),

  hypotheses: z
    .array(HypothesisDraftSchema)
    .default([]),

  experiments: z
    .array(ExperimentDraftSchema)
    .default([]),

  findings: z
    .array(FindingDraftSchema)
    .default([]),

  decisions: z
    .array(DecisionDraftSchema)
    .default([]),

  actions: z
    .array(ActionDraftSchema)
    .default([]),

  papers: z
    .array(PaperDraftSchema)
    .default([]),

  concepts: z
    .array(ConceptDraftSchema)
    .default([]),

  relations: z
    .array(RelationDraftSchema)
    .default([]),
});


// =========================================================
// Inferred TypeScript types
// =========================================================

export type IngestResearchUpdate =
  z.infer<typeof IngestResearchUpdateSchema>;

export type SourceDraft =
  z.infer<typeof SourceDraftSchema>;

export type HypothesisDraft =
  z.infer<typeof HypothesisDraftSchema>;

export type ExperimentDraft =
  z.infer<typeof ExperimentDraftSchema>;

export type FindingDraft =
  z.infer<typeof FindingDraftSchema>;

export type DecisionDraft =
  z.infer<typeof DecisionDraftSchema>;

export type ActionDraft =
  z.infer<typeof ActionDraftSchema>;

export type PaperDraft =
  z.infer<typeof PaperDraftSchema>;

export type ConceptDraft =
  z.infer<typeof ConceptDraftSchema>;

export type RelationDraft =
  z.infer<typeof RelationDraftSchema>;