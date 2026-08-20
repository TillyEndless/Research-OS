import type {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  SearchResearchMemorySchema,
} from "../schemas/search.js";

import {
  GetEntitySchema,
} from "../schemas/entity.js";

import {
  IngestResearchUpdateSchema,
} from "../schemas/ingest.js";

import {
  GetDashboardSnapshotSchema,
} from "../schemas/dashboard.js";

import {
  UpdateEntitySchema,
} from "../schemas/updateEntity.js";

import {
  SaveConceptSchema,
} from "../schemas/saveConcept.js";


import {
  searchResearchMemory,
} from "../services/searchResearchMemory.js";

import {
  getEntity,
} from "../services/getEntity.js";

import {
  ingestResearchUpdate,
} from "../services/ingestResearchUpdate.js";

import {
  getDashboardSnapshot,
} from "../services/getDashboardSnapshot.js";

import {
  updateEntity,
} from "../services/updateEntity.js";

import {
  saveConcept,
} from "../services/saveConcept.js";


// =========================================================
// Helpers
// =========================================================

function jsonText(
  value: unknown,
): string {
  return JSON.stringify(
    value,
    null,
    2,
  );
}


function errorText(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}


// =========================================================
// Register ResearchOS MCP tools
// =========================================================

export function registerResearchTools(
  server: McpServer,
): void {

  // =======================================================
  // 1. Search research memory
  // =======================================================

  server.registerTool(
    "search_research_memory",

    {
      title:
        "Search Research Memory",

      description:
        "Search the persistent ResearchOS memory before creating or updating research entities. Use this to detect whether a hypothesis, experiment, finding, decision, action, paper, concept, or source already exists.",

      inputSchema:
        SearchResearchMemorySchema.shape,

      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },

    async (args) => {
      try {

        const result =
          searchResearchMemory(
            args,
          );

        return {
          content: [
            {
              type: "text",
              text:
                jsonText(result),
            },
          ],
        };

      } catch (error) {

        return {
          isError: true,

          content: [
            {
              type: "text",
              text:
                errorText(error),
            },
          ],
        };
      }
    },
  );


  // =======================================================
  // 2. Get research entity
  // =======================================================

  server.registerTool(
    "get_research_entity",

    {
      title:
        "Get Research Entity",

      description:
        "Retrieve one ResearchOS entity in full, including subtype-specific details and incoming/outgoing graph relations. Use after search_research_memory when a candidate existing entity needs closer inspection.",

      inputSchema:
        GetEntitySchema.shape,

      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },

    async (args) => {
      try {

        const result =
          getEntity(
            args,
          );

        return {
          content: [
            {
              type: "text",
              text:
                jsonText(result),
            },
          ],
        };

      } catch (error) {

        return {
          isError: true,

          content: [
            {
              type: "text",
              text:
                errorText(error),
            },
          ],
        };
      }
    },
  );


  // =======================================================
  // 3. Ingest research update
  // =======================================================

  server.registerTool(
    "ingest_research_update",

    {
      title:
        "Ingest Research Update",

      description:
        "Persist a meaningful research update into ResearchOS. Use only after checking relevant existing memory when duplication is plausible. Can create new entities, update explicitly identified existing entities, connect them with relations, and update the derived workspace state.",

      inputSchema:
        IngestResearchUpdateSchema.shape,

      annotations: {
        readOnlyHint: false,
        destructiveHint: false,

        /*
         * Repeating a create request can create
         * duplicate entities, so this is NOT
         * automatically idempotent.
         */
        idempotentHint: false,

        openWorldHint: false,
      },
    },

    async (args) => {
      try {

        const result =
          ingestResearchUpdate(
            args,
          );

        return {
          content: [
            {
              type: "text",
              text:
                jsonText(result),
            },
          ],
        };

      } catch (error) {

        return {
          isError: true,

          content: [
            {
              type: "text",
              text:
                errorText(error),
            },
          ],
        };
      }
    },
  );


  // =======================================================
  // 4. Get dashboard snapshot
  // =======================================================

  server.registerTool(
    "get_dashboard_snapshot",

    {
      title:
        "Get Dashboard Snapshot",

      description:
        "Return the current ResearchOS dashboard state, including the core research question, current summary, major contradictions, blockers, active hypotheses, active experiments, planned actions, recent findings, recent decisions, statistics, and roadmap graph.",

      inputSchema:
        GetDashboardSnapshotSchema.shape,

      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },

    async () => {
      try {

        const result =
          getDashboardSnapshot();

        return {
          content: [
            {
              type: "text",
              text:
                jsonText(result),
            },
          ],
        };

      } catch (error) {

        return {
          isError: true,

          content: [
            {
              type: "text",
              text:
                errorText(error),
            },
          ],
        };
      }
    },
  );


  // =======================================================
  // 5. Update entity
  // =======================================================

  server.registerTool(
    "update_entity",

    {
      title:
        "Update Research Entity",

      description:
        "Make a targeted update to an existing ResearchOS entity. Use for small changes such as status, title, confidence, priority, due date, experiment result summary, or other explicitly whitelisted subtype fields.",

      inputSchema:
        UpdateEntitySchema.shape,

      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },

    async (args) => {
      try {

        const result =
          updateEntity(
            args,
          );

        return {
          content: [
            {
              type: "text",
              text:
                jsonText(result),
            },
          ],
        };

      } catch (error) {

        return {
          isError: true,

          content: [
            {
              type: "text",
              text:
                errorText(error),
            },
          ],
        };
      }
    },
  );


  // =======================================================
  // 6. Save concept
  // =======================================================

  server.registerTool(
    "save_concept",

    {
      title:
        "Save Concept",

      description:
        "Save a user-selected technical concept into the permanent ResearchOS Concept Vault, including definitions, intuition, relevance, aliases, tags, and optional conversation context. If the same term already exists, reuse the existing concept instead of creating a duplicate.",

      inputSchema:
        SaveConceptSchema.shape,

      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },

    async (args) => {
      try {

        const result =
          saveConcept(
            args,
          );

        return {
          content: [
            {
              type: "text",
              text:
                jsonText(result),
            },
          ],
        };

      } catch (error) {

        return {
          isError: true,

          content: [
            {
              type: "text",
              text:
                errorText(error),
            },
          ],
        };
      }
    },
  );
}