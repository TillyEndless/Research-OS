import {
  db,
  getDatabasePath,
} from "../db/database.js";
import "dotenv/config";

// =========================================================
// Airtable configuration
// =========================================================

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN;

if (!AIRTABLE_TOKEN) {
  throw new Error(
    "Missing AIRTABLE_TOKEN environment variable.",
  );
}


/*
 * This is the ResearchOS Airtable base
 * created for the ChatGPT-facing mirror.
 */
const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ??
  "appVPibNCLo8QKxuP";


const TABLES = {
  entities:
    "tbl4K0k4uCiXDF9hB",

  relations:
    "tblkEfr9G7b7Wm56z",

  workspaceState:
    "tblVg9VzWmeCva4KF",

  sources:
    "tbl65VmxeFjFaMAtF",
} as const;


const AIRTABLE_API_BASE =
  "https://api.airtable.com/v0";


// Airtable REST API accepts at most
// 10 records in one create/update request.
const BATCH_SIZE = 10;


// Stay comfortably below rate limits.
const REQUEST_DELAY_MS = 250;


// =========================================================
// Types
// =========================================================

type SqlRow =
  Record<
    string,
    unknown
  >;


type AirtableRecord = {
  id: string;

  fields:
    Record<
      string,
      unknown
    >;
};


type AirtableListResponse = {
  records:
    AirtableRecord[];

  offset?: string;
};


type MirrorRow = {
  key: string;

  fields:
    Record<
      string,
      unknown
    >;
};


type EntityType =
  | "source"
  | "hypothesis"
  | "experiment"
  | "finding"
  | "decision"
  | "action"
  | "paper"
  | "concept";


// =========================================================
// Static subtype table mapping
// =========================================================

const SUBTYPE_TABLES:
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


// =========================================================
// Utility helpers
// =========================================================

function sleep(
  ms: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        ms,
      );
    },
  );
}


function requireString(
  value: unknown,
  context: string,
): string {
  if (
    typeof value !== "string"
    ||
    value.length === 0
  ) {
    throw new Error(
      `Expected string for ${context}`,
    );
  }

  return value;
}


function optionalString(
  value: unknown,
): string | null {

  if (
    value === null
    ||
    value === undefined
  ) {
    return null;
  }

  return String(value);
}

function normalizeComparable(
  value: unknown,
): string {

  if (
    value === null
    ||
    value === undefined
  ) {
    return "";
  }


  if (
    typeof value === "string"
  ) {

    // Normalize ISO timestamps.
    const timestamp =
      Date.parse(value);


    if (
      /^\d{4}-\d{2}-\d{2}T/.test(value)
      &&
      !Number.isNaN(timestamp)
    ) {
      return new Date(timestamp)
        .toISOString();
    }


    return value;
  }


  if (
    typeof value === "object"
  ) {
    return JSON.stringify(value);
  }


  return String(value);
}


function fieldsEqual(
  localFields:
    Record<string, unknown>,

  remoteFields:
    Record<string, unknown>,
): boolean {

  for (
    const [
      fieldName,
      localValue,
    ]
    of Object.entries(localFields)
  ) {

    const remoteValue =
      remoteFields[fieldName];


    if (
      normalizeComparable(localValue)
      !==
      normalizeComparable(remoteValue)
    ) {
      return false;
    }
  }


  return true;
}

/*
 * node:sqlite CURRENT_TIMESTAMP normally yields:
 *
 * 2026-08-20 04:18:56
 *
 * Airtable wants ISO 8601:
 *
 * 2026-08-20T04:18:56Z
 */
function toIsoDateTime(
  value: unknown,
): string | null {

  if (
    value === null
    ||
    value === undefined
  ) {
    return null;
  }


  const text =
    String(value).trim();

  if (!text) {
    return null;
  }


  /*
   * Already ISO-like.
   */
  if (
    text.includes("T")
  ) {
    return text;
  }


  /*
   * SQLite CURRENT_TIMESTAMP is UTC.
   */
  return (
    text.replace(
      " ",
      "T",
    )
    + "Z"
  );
}


function safeParseJson(
  value: unknown,
): unknown {

  if (
    typeof value !== "string"
  ) {
    return value;
  }


  try {
    return JSON.parse(
      value,
    );
  } catch {
    return value;
  }
}


function safeJsonStringify(
  value: unknown,
): string {

  return JSON.stringify(
    value,
    (_key, currentValue) => {

      if (
        typeof currentValue
        === "bigint"
      ) {
        return currentValue.toString();
      }

      return currentValue;
    },
    2,
  );
}


/*
 * Convert:
 *
 * aliases_json -> aliases
 * tags_json    -> tags
 *
 * and parse JSON strings.
 */
function normalizeSubtypeRow(
  row:
    | SqlRow
    | undefined,
): Record<
  string,
  unknown
> {

  if (!row) {
    return {};
  }


  const result:
  Record<
    string,
    unknown
  > = {};


  for (
    const [
      key,
      value,
    ]
    of Object.entries(row)
  ) {

    /*
     * entity_id is already represented
     * by the parent entity.
     */
    if (
      key === "entity_id"
    ) {
      continue;
    }


    if (
      key.endsWith(
        "_json",
      )
    ) {

      const normalizedKey =
        key.slice(
          0,
          -5,
        );

      result[
        normalizedKey
      ] =
        safeParseJson(
          value,
        );

      continue;
    }


    result[key] =
      value;
  }


  return result;
}


/*
 * Remove only undefined.
 *
 * Keep null because null should clear
 * a stale Airtable mirror field.
 */
function removeUndefined(
  fields:
    Record<
      string,
      unknown
    >,
): Record<
  string,
  unknown
> {

  return Object.fromEntries(
    Object.entries(
      fields,
    ).filter(
      ([, value]) =>
        value !== undefined,
    ),
  );
}


// =========================================================
// Build human-readable entity summary
// =========================================================

function firstText(
  details:
    Record<
      string,
      unknown
    >,

  keys:
    string[],
): string | null {

  for (
    const key
    of keys
  ) {

    const value =
      details[key];

    if (
      typeof value === "string"
      &&
      value.trim()
    ) {
      return value;
    }
  }


  return null;
}


function buildEntitySummary(
  type: EntityType,

  details:
    Record<
      string,
      unknown
    >,
): string | null {

  switch (type) {

    case "source":
      return firstText(
        details,
        [
          "summary",
          "raw_text",
        ],
      );


    case "hypothesis":
      return firstText(
        details,
        [
          "statement",
          "rationale",
        ],
      );


    case "experiment":
      return firstText(
        details,
        [
          "result_summary",
          "question",
        ],
      );


    case "finding":
      return firstText(
        details,
        [
          "statement",
        ],
      );


    case "decision":
      return firstText(
        details,
        [
          "decision_text",
          "reason",
        ],
      );


    case "action":
      return firstText(
        details,
        [
          "task",
        ],
      );


    case "paper":
      return firstText(
        details,
        [
          "core_insight",
          "problem",
          "background",
        ],
      );


    case "concept":
      return firstText(
        details,
        [
          "definition_short",
          "intuition",
          "term",
        ],
      );
  }
}


// =========================================================
// SQLite loaders
// =========================================================

function loadSubtypeDetails(
  type: EntityType,
  entityId: string,
): Record<
  string,
  unknown
> {

  const table =
    SUBTYPE_TABLES[type];


  /*
   * Table name comes only from our
   * hardcoded whitelist above.
   */
  const row =
    db.prepare(`
      SELECT *
      FROM ${table}
      WHERE entity_id = ?
    `).get(
      entityId,
    ) as
      | SqlRow
      | undefined;


  return normalizeSubtypeRow(
    row,
  );
}


// ---------------------------------------------------------
// Entities
// ---------------------------------------------------------

function loadEntityMirrorRows():
MirrorRow[] {

  const rows =
    db.prepare(`
      SELECT
        id,
        type,
        title,
        status,
        created_at,
        updated_at

      FROM entities

      ORDER BY id
    `).all() as SqlRow[];


  return rows.map(
    (row) => {

      const id =
        requireString(
          row.id,
          "entities.id",
        );


      const type =
        requireString(
          row.type,
          "entities.type",
        ) as EntityType;


      const details =
        loadSubtypeDetails(
          type,
          id,
        );


      return {
        key:
          id,

        fields:
          removeUndefined({
            "Entity ID":
              id,

            "Type":
              type,

            "Title":
              optionalString(
                row.title,
              ),

            "Status":
              optionalString(
                row.status,
              ),

            "Summary":
              buildEntitySummary(
                type,
                details,
              ),

            "Details JSON":
              safeJsonStringify(
                details,
              ),

            "Created At":
              toIsoDateTime(
                row.created_at,
              ),

            "Updated At":
              toIsoDateTime(
                row.updated_at,
              ),

            /*
             * v1 sync protocol.
             *
             * Later we can replace this
             * with a real revision counter.
             */
            "Sync Version":
              1,
          }),
      };
    },
  );
}


// ---------------------------------------------------------
// Relations
// ---------------------------------------------------------

function loadRelationMirrorRows():
MirrorRow[] {

  const rows =
    db.prepare(`
      SELECT *
      FROM relations

      ORDER BY
        source_entity_id,
        relation_type,
        target_entity_id
    `).all() as SqlRow[];


  return rows.map(
    (row) => {

      const source =
        requireString(
          row.source_entity_id,
          "relations.source_entity_id",
        );


      const relationType =
        requireString(
          row.relation_type,
          "relations.relation_type",
        );


      const target =
        requireString(
          row.target_entity_id,
          "relations.target_entity_id",
        );


      const relationKey =
        [
          source,
          relationType,
          target,
        ].join("|");


      let metadata:
        string | null =
          null;


      if (
        row.metadata_json
        !== null
        &&
        row.metadata_json
        !== undefined
      ) {

        if (
          typeof row.metadata_json
          === "string"
        ) {
          metadata =
            row.metadata_json;
        } else {
          metadata =
            safeJsonStringify(
              row.metadata_json,
            );
        }
      }


      return {
        key:
          relationKey,

        fields:
          removeUndefined({
            "Relation Key":
              relationKey,

            "Source Entity ID":
              source,

            "Relation Type":
              relationType,

            "Target Entity ID":
              target,

            "Metadata JSON":
              metadata,

            "Created At":
              toIsoDateTime(
                row.created_at,
              ),
          }),
      };
    },
  );
}


// ---------------------------------------------------------
// WorkspaceState
// ---------------------------------------------------------

function loadWorkspaceStateMirrorRows():
MirrorRow[] {

  const row =
    db.prepare(`
      SELECT *
      FROM workspace_state
      WHERE id = 1
    `).get() as
      | SqlRow
      | undefined;


  if (!row) {
    return [];
  }


  return [
    {
      key:
        "main",

      fields:
        removeUndefined({
          "Workspace ID":
            "main",

          "Core Question":
            optionalString(
              row.core_question,
            ),

          "Current Summary":
            optionalString(
              row.current_summary,
            ),

          "Major Contradictions JSON":
            optionalString(
              row.major_contradictions_json,
            ),

          "Blockers JSON":
            optionalString(
              row.blockers_json,
            ),

          "Updated At":
            toIsoDateTime(
              row.updated_at,
            ),
        }),
    },
  ];
}


// ---------------------------------------------------------
// Sources
// ---------------------------------------------------------

function loadSourceMirrorRows():
MirrorRow[] {

  /*
   * Keep the query minimal so it remains
   * compatible if the source subtype gains
   * new columns later.
   */
  const rows =
    db.prepare(`
      SELECT
        e.id AS source_id,
        e.title AS entity_title,
        s.*

      FROM sources s

      INNER JOIN entities e
        ON e.id = s.entity_id

      ORDER BY e.id
    `).all() as SqlRow[];


  return rows.map(
    (row) => {

      const sourceId =
        requireString(
          row.source_id,
          "sources.entity_id",
        );


      /*
       * Support a few schema naming variants
       * without breaking synchronization.
       */
      const sourceType =
        row.source_type
        ??
        row.source_kind
        ??
        row.kind
        ??
        null;


      const rawText =
        row.raw_text
        ??
        row.content
        ??
        null;


      return {
        key:
          sourceId,

        fields:
          removeUndefined({
            "Source ID":
              sourceId,

            "Source Type":
              optionalString(
                sourceType,
              ),

            "Source Date":
              optionalString(
                row.source_date,
              ),

            "Title":
              optionalString(
                row.entity_title,
              ),

            "Summary":
              optionalString(
                row.summary,
              ),

            "Raw Text":
              optionalString(
                rawText,
              ),

            "URI":
              optionalString(
                row.uri,
              ),
          }),
      };
    },
  );
}


// =========================================================
// Airtable HTTP client
// =========================================================

async function airtableRequest<T>(
  method:
    | "GET"
    | "POST"
    | "PATCH",

  url: string,

  body?: unknown,

  attempt = 0,
): Promise<T> {

    const requestInit: RequestInit = {
        method,

        headers: {
            Authorization:
            `Bearer ${AIRTABLE_TOKEN}`,

            "Content-Type":
            "application/json",
        },
    };


    if (
        body !== undefined
    ) {
      requestInit.body =
        JSON.stringify(
            body,
        );
    }


    const response =
        await fetch(
            url,
            requestInit,
    );

  /*
   * Airtable rate limit / transient error.
   */
  if (
    (
      response.status === 429
      ||
      response.status >= 500
    )
    &&
    attempt < 5
  ) {

    const retryAfter =
      response.headers.get(
        "retry-after",
      );


    const retryMs =
      retryAfter
        ? Number(
            retryAfter,
          ) * 1000
        : Math.min(
            1000
              * 2 ** attempt,
            8000,
          );


    console.warn(
      `[airtable] HTTP ${response.status}; retrying in ${retryMs} ms`,
    );


    await sleep(
      retryMs,
    );


    return airtableRequest<T>(
      method,
      url,
      body,
      attempt + 1,
    );
  }


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      [
        `Airtable request failed`,
        `${method} ${url}`,
        `HTTP ${response.status}`,
        text,
      ].join("\n"),
    );
  }


  if (!text) {
    return undefined as T;
  }


  return JSON.parse(
    text,
  ) as T;
}


// =========================================================
// Airtable record listing
// =========================================================

async function listAllRemoteRecords(
  tableId: string,
): Promise<
  AirtableRecord[]
> {

  const all:
  AirtableRecord[] = [];


  let offset:
    string
    | undefined;


  do {

    const url =
      new URL(
        `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${tableId}`,
      );


    url.searchParams.set(
      "pageSize",
      "100",
    );


    if (offset) {
      url.searchParams.set(
        "offset",
        offset,
      );
    }


    const response =
      await airtableRequest<
        AirtableListResponse
      >(
        "GET",
        url.toString(),
      );


    all.push(
      ...response.records,
    );


    offset =
      response.offset;


    await sleep(
      REQUEST_DELAY_MS,
    );

  } while (offset);


  return all;
}


// =========================================================
// Batch helpers
// =========================================================

function chunk<T>(
  values: T[],
  size: number,
): T[][] {

  const result:
  T[][] = [];


  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    result.push(
      values.slice(
        index,
        index + size,
      ),
    );
  }


  return result;
}


// =========================================================
// Generic table mirror sync
// =========================================================

async function syncMirrorTable(
  tableName: string,
  tableId: string,
  primaryFieldName: string,
  localRows: MirrorRow[],
): Promise<{
  created: number;
  updated: number;
}> {

  console.log(
    `\n[sync] ${tableName}`,
  );


  console.log(
    `[sync] local rows: ${localRows.length}`,
  );


  const remoteRecords =
    await listAllRemoteRecords(
      tableId,
    );


  console.log(
    `[sync] remote rows: ${remoteRecords.length}`,
  );


  const remoteByKey =
    new Map<
      string,
      AirtableRecord
    >();


  for (
    const record
    of remoteRecords
  ) {

    const rawKey =
      record.fields[
        primaryFieldName
      ];


    if (
      typeof rawKey === "string"
      &&
      rawKey
    ) {
      remoteByKey.set(
        rawKey,
        record,
      );
    }
  }


  const creates:
  Array<{
    fields:
      Record<
        string,
        unknown
      >;
  }> = [];


  const updates:
  Array<{
    id: string;

    fields:
      Record<
        string,
        unknown
      >;
  }> = [];


  for (
    const local
    of localRows
  ) {

    const remote =
      remoteByKey.get(
        local.key,
      );


    if (remote) {

        if (
            fieldsEqual(
            local.fields,
            remote.fields,
            )
        ) {
            continue;
        }


        updates.push({
            id:
            remote.id,

            fields:
            local.fields,
        });

        } else {
            creates.push({
                fields:
                local.fields,
            });
        }
  }


  // -------------------------------------------------------
  // Create
  // -------------------------------------------------------

  for (
    const batch
    of chunk(
      creates,
      BATCH_SIZE,
    )
  ) {

    await airtableRequest(
      "POST",

      `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${tableId}`,

      {
        records:
          batch,
      },
    );


    await sleep(
      REQUEST_DELAY_MS,
    );
  }


  // -------------------------------------------------------
  // Update
  // -------------------------------------------------------

  for (
    const batch
    of chunk(
      updates,
      BATCH_SIZE,
    )
  ) {

    await airtableRequest(
      "PATCH",

      `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${tableId}`,

      {
        records:
          batch,
      },
    );


    await sleep(
      REQUEST_DELAY_MS,
    );
  }


  console.log(
    `[sync] created: ${creates.length}`,
  );


  console.log(
    `[sync] updated: ${updates.length}`,
  );


  /*
   * Intentionally NO deletion in v1.
   *
   * We do not want an accidental local
   * mistake to destroy Airtable records.
   */
  return {
    created:
      creates.length,

    updated:
      updates.length,
  };
}


// =========================================================
// Main sync
// =========================================================

async function main():
Promise<void> {

  console.log(
    "======================================",
  );

  console.log(
    "ResearchOS → Airtable sync",
  );

  console.log(
    "======================================",
  );


  console.log(
    `SQLite: ${getDatabasePath()}`,
  );


  console.log(
    `Airtable base: ${AIRTABLE_BASE_ID}`,
  );


  const entityRows =
    loadEntityMirrorRows();


  const relationRows =
    loadRelationMirrorRows();


  const workspaceRows =
    loadWorkspaceStateMirrorRows();


  const sourceRows =
    loadSourceMirrorRows();


  const entitiesResult =
    await syncMirrorTable(
      "Entities",
      TABLES.entities,
      "Entity ID",
      entityRows,
    );


  const relationsResult =
    await syncMirrorTable(
      "Relations",
      TABLES.relations,
      "Relation Key",
      relationRows,
    );


  const workspaceResult =
    await syncMirrorTable(
      "WorkspaceState",
      TABLES.workspaceState,
      "Workspace ID",
      workspaceRows,
    );


  const sourcesResult =
    await syncMirrorTable(
      "Sources",
      TABLES.sources,
      "Source ID",
      sourceRows,
    );


  console.log(
    "\n======================================",
  );

  console.log(
    "SYNC COMPLETE",
  );

  console.log(
    "======================================",
  );


  console.log({
    entities:
      entitiesResult,

    relations:
      relationsResult,

    workspaceState:
      workspaceResult,

    sources:
      sourcesResult,
  });
}


// =========================================================
// Entrypoint
// =========================================================

main().catch(
  (error) => {

    console.error(
      "\nResearchOS Airtable sync failed.",
    );

    console.error(
      error,
    );

    process.exitCode = 1;
  },
);