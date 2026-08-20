import "dotenv/config";

import {
  createQueueRecord,
} from "../server/sync/airtableQueueClient.js";


async function main():
Promise<void> {

  const mutationId =
    `TEST-E001-${Date.now()}`;


  const record =
    await createQueueRecord({
      "Mutation ID":
        mutationId,

      Operation:
        "update_entity",

      "Entity ID":
        "E001",

      "Payload JSON":
        JSON.stringify({
          status:
            "running",
        }),

      Status:
        "pending",

      "Created At":
        new Date()
          .toISOString(),
    });


  console.log({
    mutation_id:
      mutationId,

    airtable_record_id:
      record.id,
  });
}


main().catch(
  (error) => {

    console.error(
      error,
    );

    process.exitCode = 1;
  },
);
