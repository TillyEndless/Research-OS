import { db } from "../db/database.js";

import {
  SearchResearchMemorySchema,
  type SearchResearchMemoryInput,
  type SearchableEntityType,
} from "../schemas/search.js";


type SearchRow = {
  id: string;
  type: SearchableEntityType;
  title: string;
  status: string | null;

  source_type: string | null;
  source_summary: string | null;
  source_raw_text: string | null;

  hypothesis_statement: string | null;
  hypothesis_rationale: string | null;

  experiment_question: string | null;
  experiment_baseline: string | null;
  experiment_variant: string | null;
  experiment_model: string | null;
  experiment_dataset: string | null;
  experiment_result_summary: string | null;

  finding_kind: string | null;
  finding_statement: string | null;

  decision_text: string | null;
  decision_reason: string | null;

  action_task: string | null;

  paper_authors: string | null;
  paper_venue: string | null;
  paper_research_area: string | null;
  paper_problem: string | null;
  paper_core_insight: string | null;
  paper_method: string | null;
  paper_relation_to_our_work: string | null;

  concept_term: string | null;
  concept_aliases_json: string | null;
  concept_definition_short: string | null;
  concept_definition_detailed: string | null;
  concept_intuition: string | null;
  concept_why_it_matters: string | null;
};


export type SearchResearchMemoryResultItem = {
  id: string;

  type: SearchableEntityType;

  title: string;

  status: string | null;

  score: number;

  summary: string;

  matched_terms: string[];
};


export type SearchResearchMemoryResult = {
  query: string;

  count: number;

  results: SearchResearchMemoryResultItem[];
};


/**
 * Normalize text for lightweight lexical matching.
 *
 * We deliberately keep Chinese text unchanged.
 */
function normalizeText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .toLowerCase()
    .trim();
}


/**
 * Remove duplicate / empty search terms.
 */
function buildSearchTerms(
  query: string,
  keywords: string[],
): string[] {
  const terms = [
    query,
    ...keywords,
  ]
    .map(normalizeText)
    .filter((value) => value.length > 0);

  return Array.from(
    new Set(terms),
  );
}


/**
 * Convert one database row into searchable text.
 */
function buildSearchText(
  row: SearchRow,
): string {
  return normalizeText(
    [
      row.id,
      row.type,
      row.title,
      row.status,

      row.source_type,
      row.source_summary,
      row.source_raw_text,

      row.hypothesis_statement,
      row.hypothesis_rationale,

      row.experiment_question,
      row.experiment_baseline,
      row.experiment_variant,
      row.experiment_model,
      row.experiment_dataset,
      row.experiment_result_summary,

      row.finding_kind,
      row.finding_statement,

      row.decision_text,
      row.decision_reason,

      row.action_task,

      row.paper_authors,
      row.paper_venue,
      row.paper_research_area,
      row.paper_problem,
      row.paper_core_insight,
      row.paper_method,
      row.paper_relation_to_our_work,

      row.concept_term,
      row.concept_aliases_json,
      row.concept_definition_short,
      row.concept_definition_detailed,
      row.concept_intuition,
      row.concept_why_it_matters,
    ]
      .filter(
        (value) =>
          value !== null &&
          value !== undefined,
      )
      .join("\n"),
  );
}


/**
 * Return the most useful human-readable content for
 * displaying a search candidate to GPT.
 */
function buildSummary(
  row: SearchRow,
): string {
  switch (row.type) {
    case "source":
      return (
        row.source_summary ??
        row.source_raw_text ??
        row.title
      );

    case "hypothesis":
      return (
        row.hypothesis_statement ??
        row.title
      );

    case "experiment":
      return (
        row.experiment_result_summary ??
        row.experiment_question ??
        row.title
      );

    case "finding":
      return (
        row.finding_statement ??
        row.title
      );

    case "decision":
      return (
        row.decision_text ??
        row.title
      );

    case "action":
      return (
        row.action_task ??
        row.title
      );

    case "paper":
      return (
        row.paper_core_insight ??
        row.paper_problem ??
        row.title
      );

    case "concept":
      return (
        row.concept_definition_short ??
        row.concept_definition_detailed ??
        row.title
      );
  }
}


/**
 * Lightweight deterministic lexical score.
 *
 * We intentionally keep this transparent rather than
 * introducing embeddings at v1.
 */
function calculateScore(
  row: SearchRow,
  query: string,
  terms: string[],
): {
  score: number;
  matchedTerms: string[];
} {
  const normalizedQuery =
    normalizeText(query);

  const title =
    normalizeText(row.title);

  const searchText =
    buildSearchText(row);

  let score = 0;

  const matchedTerms: string[] = [];


  // -------------------------------------------------------
  // Strong exact matches
  // -------------------------------------------------------

  if (
    normalizeText(row.id) ===
    normalizedQuery
  ) {
    score += 200;
  }

  if (
    title === normalizedQuery
  ) {
    score += 120;
  }

  if (
    normalizeText(row.concept_term) ===
    normalizedQuery
  ) {
    score += 120;
  }


  // -------------------------------------------------------
  // Whole-query matches
  // -------------------------------------------------------

  if (
    normalizedQuery.length > 0 &&
    title.includes(normalizedQuery)
  ) {
    score += 60;
  }

  if (
    normalizedQuery.length > 0 &&
    searchText.includes(normalizedQuery)
  ) {
    score += 40;
  }


  // -------------------------------------------------------
  // Keyword matches
  // -------------------------------------------------------

  for (const term of terms) {
    if (!searchText.includes(term)) {
      continue;
    }

    matchedTerms.push(term);

    if (title.includes(term)) {
      score += 20;
    } else {
      score += 8;
    }

    if (
      normalizeText(row.concept_term)
        .includes(term)
    ) {
      score += 20;
    }
  }


  // More distinct matched terms gives additional confidence.
  score +=
    matchedTerms.length * 3;


  return {
    score,
    matchedTerms,
  };
}


function loadSearchRows(): SearchRow[] {
  return db
    .prepare(`
      SELECT
        e.id,
        e.type,
        e.title,
        e.status,

        s.source_type,
        s.summary
          AS source_summary,
        s.raw_text
          AS source_raw_text,

        h.statement
          AS hypothesis_statement,
        h.rationale
          AS hypothesis_rationale,

        ex.question
          AS experiment_question,
        ex.baseline
          AS experiment_baseline,
        ex.variant
          AS experiment_variant,
        ex.model
          AS experiment_model,
        ex.dataset
          AS experiment_dataset,
        ex.result_summary
          AS experiment_result_summary,

        f.kind
          AS finding_kind,
        f.statement
          AS finding_statement,

        d.decision_text,
        d.reason
          AS decision_reason,

        a.task
          AS action_task,

        p.authors
          AS paper_authors,
        p.venue
          AS paper_venue,
        p.research_area
          AS paper_research_area,
        p.problem
          AS paper_problem,
        p.core_insight
          AS paper_core_insight,
        p.method
          AS paper_method,
        p.relation_to_our_work
          AS paper_relation_to_our_work,

        c.term
          AS concept_term,
        c.aliases_json
          AS concept_aliases_json,
        c.definition_short
          AS concept_definition_short,
        c.definition_detailed
          AS concept_definition_detailed,
        c.intuition
          AS concept_intuition,
        c.why_it_matters
          AS concept_why_it_matters

      FROM entities e

      LEFT JOIN sources s
        ON s.entity_id = e.id

      LEFT JOIN hypotheses h
        ON h.entity_id = e.id

      LEFT JOIN experiments ex
        ON ex.entity_id = e.id

      LEFT JOIN findings f
        ON f.entity_id = e.id

      LEFT JOIN decisions d
        ON d.entity_id = e.id

      LEFT JOIN actions a
        ON a.entity_id = e.id

      LEFT JOIN papers p
        ON p.entity_id = e.id

      LEFT JOIN concepts c
        ON c.entity_id = e.id
    `)
    .all() as SearchRow[];
}


export function searchResearchMemory(
  rawInput: unknown,
): SearchResearchMemoryResult {

  const input: SearchResearchMemoryInput =
    SearchResearchMemorySchema.parse(
      rawInput,
    );


  const terms =
    buildSearchTerms(
      input.query,
      input.keywords,
    );


  let rows =
    loadSearchRows();


  // -------------------------------------------------------
  // Optional type filtering
  // -------------------------------------------------------

  if (
    input.entity_types &&
    input.entity_types.length > 0
  ) {
    const allowedTypes =
      new Set(input.entity_types);

    rows = rows.filter(
      (row) =>
        allowedTypes.has(row.type),
    );
  }


  // -------------------------------------------------------
  // Optional status filtering
  // -------------------------------------------------------

  if (
    input.statuses &&
    input.statuses.length > 0
  ) {
    const allowedStatuses =
      new Set(input.statuses);

    rows = rows.filter(
      (row) =>
        row.status !== null &&
        allowedStatuses.has(row.status),
    );
  }


  // -------------------------------------------------------
  // Score candidates
  // -------------------------------------------------------

  const results =
    rows
      .map((row) => {
        const {
          score,
          matchedTerms,
        } = calculateScore(
          row,
          input.query,
          terms,
        );

        return {
          id: row.id,
          type: row.type,
          title: row.title,
          status: row.status,
          score,

          summary:
            buildSummary(row),

          matched_terms:
            matchedTerms,
        };
      })

      // Completely unrelated entities should not be returned.
      .filter(
        (result) =>
          result.score > 0,
      )

      .sort(
        (a, b) =>
          b.score - a.score,
      )

      .slice(
        0,
        input.limit,
      );


  return {
    query: input.query,

    count: results.length,

    results,
  };
}