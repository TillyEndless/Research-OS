import "dotenv/config";

import {
  db,
  getDatabasePath,
} from "../db/database.js";

import {
  ingestResearchUpdate,
} from "../services/ingestResearchUpdate.js";

import {
  updateEntity,
} from "../services/updateEntity.js";

import {
  saveConcept,
} from "../services/saveConcept.js";

import {
  listQueueRecords,
  updateQueueRecord,
  type AirtableQueueRecord,
} from "./airtableQueueClient.js";


// =========================================================
// Types
// =========================================================

type QueueOperation =
  | "update_entity"
  | "ingest_research_update"
  | "save_concept";


type AppliedMutationRow = {
  mutation_id: string;
  operation: string;
  result_json: string | null;
};


// =========================================================
// Helpers
// =========================================================

function getString(
  fields:
    Record<
      string,
      unknown
    >,

  key: string,
): string | undefined {

  const value =
    fields[key];


  if (
    typeof value === "string"
    &&
    value.trim()
  ) {
    return value.trim();
  }


  return undefined;
}


function requireString(
  fields:
    Record<
      string,
      unknown
    >,

  key: string,
): string {

  const value =
    getString(
      fields,
      key,
    );


  if (!value) {
    throw new Error(
      `Missing Airtable field: ${key}`,
    );
  }


  return value;
}


function isOperation(
  value: string,
): value is QueueOperation {

  return (
    value === "update_entity"
    ||
    value === "ingest_research_update"
    ||
    value === "save_concept"
  );
}


function parsePayload(
  text: string,
): Record<string, unknown> {

  const parsed:
    unknown =
      JSON.parse(
        text,
      );


  if (
    parsed === null
    ||
    typeof parsed !== "object"
    ||
    Array.isArray(parsed)
  ) {

    throw new Error(
      "Payload JSON must contain a JSON object.",
    );
  }


  return parsed as
    Record<
      string,
      unknown
    >;
}


function getAppliedMutation(
  mutationId: string,
):
  | AppliedMutationRow
  | undefined {

  return db
    .prepare(`
      SELECT
        mutation_id,
        operation,
        result_json

      FROM applied_mutations

      WHERE mutation_id = ?
    `)
    .get(
      mutationId,
    ) as
      | AppliedMutationRow
      | undefined;
}


function recordAppliedMutation(
  mutationId: string,
  operation: QueueOperation,
  result: unknown,
): void {

  db.prepare(`
    INSERT OR IGNORE INTO applied_mutations (
      mutation_id,
      operation,
      result_json
    )

    VALUES (?, ?, ?)
  `).run(
    mutationId,
    operation,
    JSON.stringify(
      result,
    ) ?? "null",
  );
}


// =========================================================
// Domain dispatch
// =========================================================

function applyMutation(
  operation:
    QueueOperation,

  entityId:
    string
    | undefined,

  payload:
    Record<
      string,
      unknown
    >,
): unknown {

  switch (operation) {

    case "update_entity": {

      const updatePayload:
        Record<
          string,
          unknown
        > = {
          ...payload,
        };


      if (
        updatePayload.entity_id
        === undefined
      ) {

        if (!entityId) {
          throw new Error(
            "update_entity requires Entity ID.",
          );
        }


        updatePayload.entity_id =
          entityId;
      }


      return updateEntity(
        updatePayload,
      );
    }


    case "ingest_research_update":

      return ingestResearchUpdate(
        payload,
      );


    case "save_concept":

      return saveConcept(
        payload,
      );
  }
}


// =========================================================
// Process one queue record
// =========================================================

async function processRecord(
  record:
    AirtableQueueRecord,
): Promise<
  "applied"
  | "already_applied"
  | "failed"
  | "ignored"
> {

  const status =
    getString(
      record.fields,
      "Status",
    );


  if (
    status !== "pending"
    &&
    status !== "processing"
  ) {
    return "ignored";
  }


  let mutationId:
    string
    | undefined;


  try {

    mutationId =
      requireString(
        record.fields,
        "Mutation ID",
      );


    const operationRaw =
      requireString(
        record.fields,
        "Operation",
      );


    if (
      !isOperation(
        operationRaw,
      )
    ) {
      throw new Error(
        `Unsupported operation: ${operationRaw}`,
      );
    }


    const existing =
      getAppliedMutation(
        mutationId,
      );


    if (existing) {

      await updateQueueRecord(
        record.id,
        {
          Status:
            "applied",

          "Applied At":
            new Date()
              .toISOString(),

          Error:
            null,
        },
      );


      return "already_applied";
    }


    await updateQueueRecord(
      record.id,
      {
        Status:
          "processing",

        Error:
          null,
      },
    );


    const entityId =
      getString(
        record.fields,
        "Entity ID",
      );


    const payloadText =
      requireString(
        record.fields,
        "Payload JSON",
      );


    const payload =
      parsePayload(
        payloadText,
      );


    const result =
      applyMutation(
        operationRaw,
        entityId,
        payload,
      );


    recordAppliedMutation(
      mutationId,
      operationRaw,
      result,
    );


    await updateQueueRecord(
      record.id,
      {
        Status:
          "applied",

        "Applied At":
          new Date()
            .toISOString(),

        Error:
          null,
      },
    );


    return "applied";

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : String(error);


    console.error(
      `[queue] ${mutationId ?? record.id}: ${message}`,
    );


    await updateQueueRecord(
      record.id,
      {
        Status:
          "failed",

        Error:
          message,
      },
    );


    return "failed";
  }
}


// =========================================================
// Main
// =========================================================

async function main():
Promise<void> {

  console.log(
    "======================================",
  );

  console.log(
    "Airtable WriteQueue → ResearchOS",
  );

  console.log(
    "======================================",
  );


  console.log(
    `SQLite: ${getDatabasePath()}`,
  );


  const records =
    await listQueueRecords();


  let applied = 0;
  let alreadyApplied = 0;
  let failed = 0;
  let ignored = 0;


  for (
    const record
    of records
  ) {

    const result =
      await processRecord(
        record,
      );


    switch (result) {

      case "applied":
        applied++;
        break;

      case "already_applied":
        alreadyApplied++;
        break;

      case "failed":
        failed++;
        break;

      case "ignored":
        ignored++;
        break;
    }
  }


  console.log(
    "\n======================================",
  );

  console.log(
    "PULL COMPLETE",
  );

  console.log(
    "======================================",
  );


  console.log({
    applied,
    alreadyApplied,
    failed,
    ignored,
  });
}


main().catch(
  (error) => {

    console.error(
      "Airtable pull failed.",
    );

    console.error(
      error,
    );

    process.exitCode = 1;
  },
);