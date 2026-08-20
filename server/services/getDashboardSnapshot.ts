import { db } from "../db/database.js";


type WorkspaceRow = {
  core_question: string | null;
  current_summary: string | null;
  major_contradictions_json: string;
  blockers_json: string;
  updated_at: string;
};


type EntitySummaryRow = {
  id: string;
  type: string;
  title: string;
  status: string | null;
  updated_at: string;
};


type RelationRow = {
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
};


function parseJson<T>(
  value: string | null,
  fallback: T,
): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}


function loadEntities(
  type: string,
  statuses?: string[],
  limit = 20,
): EntitySummaryRow[] {

  let sql = `
    SELECT
      id,
      type,
      title,
      status,
      updated_at

    FROM entities

    WHERE type = ?
  `;

    type SqlBindValue =
        | null
        | number
        | bigint
        | string
        | NodeJS.ArrayBufferView;


    const params: SqlBindValue[] = [
        type,
    ];


  if (
    statuses &&
    statuses.length > 0
  ) {

    sql += `
      AND status IN (
        ${statuses
          .map(() => "?")
          .join(",")}
      )
    `;

    params.push(
      ...statuses,
    );
  }


  sql += `
    ORDER BY updated_at DESC
    LIMIT ?
  `;

  params.push(limit);


  return db
    .prepare(sql)
    .all(...params) as
      EntitySummaryRow[];
}


export function getDashboardSnapshot() {

  // =====================================================
  // Workspace state
  // =====================================================

  const workspace = db
    .prepare(`
      SELECT
        core_question,
        current_summary,
        major_contradictions_json,
        blockers_json,
        updated_at

      FROM workspace_state

      WHERE id = 1
    `)
    .get() as WorkspaceRow;


  // =====================================================
  // Important entity sets
  // =====================================================

  const activeHypotheses =
    loadEntities(
      "hypothesis",
      [
        "proposed",
        "active",
        "partially_supported",
        "supported",
      ],
      30,
    );


  const activeExperiments =
    loadEntities(
      "experiment",
      [
        "planned",
        "running",
        "active",
      ],
      30,
    );


  const plannedActions =
    loadEntities(
      "action",
      [
        "planned",
        "running",
        "blocked",
      ],
      30,
    );


  const recentFindings =
    loadEntities(
      "finding",
      undefined,
      20,
    );


  const recentDecisions =
    loadEntities(
      "decision",
      undefined,
      20,
    );


  // =====================================================
  // Stats
  // =====================================================

  const statRows = db
    .prepare(`
      SELECT
        type,
        COUNT(*) AS count

      FROM entities

      GROUP BY type
    `)
    .all() as Array<{
      type: string;
      count: number;
    }>;


  const stats: Record<
    string,
    number
  > = {};

  for (
    const row
    of statRows
  ) {
    stats[row.type] =
      row.count;
  }


  // =====================================================
  // Roadmap graph
  // =====================================================

  const roadmapTypes = [
    "hypothesis",
    "experiment",
    "finding",
    "decision",
    "action",
  ];


  const roadmapNodes = db
    .prepare(`
      SELECT
        id,
        type,
        title,
        status

      FROM entities

      WHERE type IN (
        'hypothesis',
        'experiment',
        'finding',
        'decision',
        'action'
      )

      ORDER BY created_at
    `)
    .all() as Array<{
      id: string;
      type: string;
      title: string;
      status: string | null;
    }>;


  const nodeIds =
    new Set(
      roadmapNodes.map(
        (node) => node.id,
      ),
    );


  const allRelations = db
    .prepare(`
      SELECT
        source_entity_id,
        target_entity_id,
        relation_type

      FROM relations

      ORDER BY id
    `)
    .all() as RelationRow[];


  const roadmapEdges =
    allRelations.filter(
      (edge) =>
        nodeIds.has(
          edge.source_entity_id,
        ) &&
        nodeIds.has(
          edge.target_entity_id,
        ),
    );


  return {
    workspace: {
      core_question:
        workspace.core_question,

      current_summary:
        workspace.current_summary,

      major_contradictions:
        parseJson(
          workspace
            .major_contradictions_json,
          [],
        ),

      blockers:
        parseJson(
          workspace.blockers_json,
          [],
        ),

      updated_at:
        workspace.updated_at,
    },

    active_hypotheses:
      activeHypotheses,

    active_experiments:
      activeExperiments,

    planned_actions:
      plannedActions,

    recent_findings:
      recentFindings,

    recent_decisions:
      recentDecisions,

    roadmap: {
      nodes:
        roadmapNodes,

      edges:
        roadmapEdges,

      supported_types:
        roadmapTypes,
    },

    stats,
  };
}