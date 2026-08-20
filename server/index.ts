import express from "express";

import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type {
  Transport,
} from "@modelcontextprotocol/sdk/shared/transport.js";

import {
  runMigrations,
} from "./db/migrate.js";

import {
  registerResearchTools,
} from "./mcp/registerTools.js";


// =========================================================
// Database bootstrap
// =========================================================

runMigrations();


// =========================================================
// Express
// =========================================================

const app = express();

app.use(
  express.json({
    limit: "20mb",
  }),
);


// =========================================================
// Health check
// =========================================================

app.get(
  "/health",
  (_req, res) => {
    res.json({
      ok: true,
      service: "research-os",
    });
  },
);


// =========================================================
// MCP Server factory
// =========================================================

/**
 * Create one fresh MCP server per HTTP request.
 *
 * Do not reuse one McpServer instance across multiple
 * Streamable HTTP transports.
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "research-os",
    version: "0.1.0",
  });

  registerResearchTools(server);

  return server;
}


// =========================================================
// MCP HTTP endpoint
// =========================================================

app.post(
  "/mcp",

  async (
    req,
    res,
  ) => {

    // -----------------------------------------------------
    // Create a fresh MCP server for this request.
    // -----------------------------------------------------

    const server =
      createMcpServer();


    // -----------------------------------------------------
    // Stateless Streamable HTTP transport.
    //
    // IMPORTANT:
    //
    // Do NOT explicitly write:
    //
    //   sessionIdGenerator: undefined
    //
    // when exactOptionalPropertyTypes=true.
    //
    // Omitting the optional property gives the same
    // runtime value (undefined), while satisfying TS.
    // -----------------------------------------------------

    const transport =
      new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      });


    // -----------------------------------------------------
    // Cleanup
    // -----------------------------------------------------

    res.on(
      "close",

      () => {
        void transport.close();
      },
    );


    try {

      // ---------------------------------------------------
      // SDK v1.x currently has an exactOptionalPropertyTypes
      // incompatibility between
      //
      // StreamableHTTPServerTransport
      //
      // and
      //
      // Transport
      //
      // around the optional `onclose` callback.
      //
      // Keep strict TS enabled and use a narrow cast here.
      // ---------------------------------------------------

      await server.connect(
        transport as Transport,
      );


      await transport.handleRequest(
        req,
        res,
        req.body,
      );

    } catch (error) {

      console.error(
        "MCP request failed:",
        error,
      );


      if (!res.headersSent) {
        res
          .status(500)
          .json({
            jsonrpc: "2.0",

            error: {
              code: -32603,
              message:
                "Internal server error",
            },

            id: null,
          });
      }

    } finally {

      /*
       * The response close handler also closes the transport.
       * We don't explicitly close the McpServer here because
       * server.connect() owns the transport lifecycle.
       */
    }
  },
);


// =========================================================
// 404 for unsupported MCP methods
// =========================================================

app.get(
  "/mcp",
  (_req, res) => {
    res.status(405).json({
      error:
        "GET is not supported by this stateless MCP endpoint.",
    });
  },
);


app.delete(
  "/mcp",
  (_req, res) => {
    res.status(405).json({
      error:
        "DELETE is not supported by this stateless MCP endpoint.",
    });
  },
);


// =========================================================
// Start
// =========================================================

const port =
  Number(
    process.env.PORT ?? 3000,
  );


app.listen(
  port,
  "127.0.0.1",

  () => {
    console.log(
      `ResearchOS running at http://127.0.0.1:${port}`,
    );

    console.log(
      `Health endpoint: http://127.0.0.1:${port}/health`,
    );

    console.log(
      `MCP endpoint: http://127.0.0.1:${port}/mcp`,
    );
  },
);