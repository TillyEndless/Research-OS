import "dotenv/config";

import {
  spawn,
} from "node:child_process";


const INTERVAL_MS =
  Number(
    process.env.RESEARCH_OS_SYNC_INTERVAL_MS
    ?? 15000,
  );


let shouldStop =
  false;


// =========================================================
// Helpers
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


function runNpmScript(
  scriptName: string,
): Promise<void> {

  return new Promise(
    (
      resolve,
      reject,
    ) => {

      console.log(
        `\n[sync-loop] npm run ${scriptName}`,
      );


      const child =
        spawn(
          "npm",
          [
            "run",
            scriptName,
          ],
          {
            stdio:
              "inherit",

            env:
              process.env,
          },
        );


      child.on(
        "error",
        (error) => {

          reject(
            error,
          );
        },
      );


      child.on(
        "exit",
        (code) => {

          if (code === 0) {

            resolve();

            return;
          }


          reject(
            new Error(
              `${scriptName} exited with code ${code}`,
            ),
          );
        },
      );
    },
  );
}


// =========================================================
// One sync cycle
// =========================================================

async function runSyncCycle():
Promise<void> {

  const startedAt =
    new Date();


  console.log(
    "\n======================================",
  );

  console.log(
    "ResearchOS sync cycle",
  );

  console.log(
    startedAt.toISOString(),
  );

  console.log(
    "======================================",
  );


  /*
   * Step 1:
   * Consume pending ChatGPT/Airtable mutations.
   *
   * Airtable WriteQueue
   *        ↓
   * ResearchOS services
   *        ↓
   * SQLite
   */
  await runNpmScript(
    "sync:airtable:pull",
  );


  /*
   * Step 2:
   * Publish canonical SQLite state
   * back to Airtable mirror tables.
   *
   * SQLite
   *    ↓
   * Entities / Relations /
   * WorkspaceState / Sources
   */
  await runNpmScript(
    "sync:airtable:push",
  );


  const finishedAt =
    new Date();


  console.log(
    "\n[sync-loop] cycle complete",
  );

  console.log(
    `[sync-loop] duration: ${
      finishedAt.getTime()
      -
      startedAt.getTime()
    } ms`,
  );
}


// =========================================================
// Graceful shutdown
// =========================================================

function requestStop(
  signal: string,
): void {

  console.log(
    `\n[sync-loop] received ${signal}; stopping after current cycle...`,
  );


  shouldStop =
    true;
}


process.on(
  "SIGINT",
  () => {

    requestStop(
      "SIGINT",
    );
  },
);


process.on(
  "SIGTERM",
  () => {

    requestStop(
      "SIGTERM",
    );
  },
);


// =========================================================
// Main
// =========================================================

async function main():
Promise<void> {

  if (
    !Number.isFinite(
      INTERVAL_MS,
    )
    ||
    INTERVAL_MS < 1000
  ) {

    throw new Error(
      "RESEARCH_OS_SYNC_INTERVAL_MS must be a number >= 1000.",
    );
  }


  console.log(
    "======================================",
  );

  console.log(
    "ResearchOS automatic sync",
  );

  console.log(
    "======================================",
  );


  console.log(
    `[sync-loop] interval: ${INTERVAL_MS} ms`,
  );


  console.log(
    `[sync-loop] database: ${
      process.env.RESEARCH_OS_DB_PATH
      ?? "default database"
    }`,
  );


  while (
    !shouldStop
  ) {

    try {

      await runSyncCycle();

    } catch (error) {

      console.error(
        "\n[sync-loop] cycle failed",
      );


      console.error(
        error,
      );
    }


    if (
      shouldStop
    ) {
      break;
    }


    console.log(
      `[sync-loop] sleeping ${INTERVAL_MS} ms`,
    );


    await sleep(
      INTERVAL_MS,
    );
  }


  console.log(
    "\n[sync-loop] stopped.",
  );
}


main().catch(
  (error) => {

    console.error(
      "\nResearchOS sync loop failed.",
    );


    console.error(
      error,
    );


    process.exitCode =
      1;
  },
);
