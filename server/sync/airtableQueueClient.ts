import "dotenv/config";


const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN;


if (!AIRTABLE_TOKEN) {
  throw new Error(
    "Missing AIRTABLE_TOKEN environment variable.",
  );
}


const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID
  ?? "appVPibNCLo8QKxuP";


const WRITE_QUEUE_TABLE =
  process.env.AIRTABLE_WRITE_QUEUE_TABLE
  ?? "WriteQueue";


const AIRTABLE_API_BASE =
  "https://api.airtable.com/v0";


export type AirtableQueueRecord = {
  id: string;

  fields: Record<
    string,
    unknown
  >;
};


type AirtableListResponse = {
  records: AirtableQueueRecord[];
  offset?: string;
};


type AirtableMutationResponse = {
  records: AirtableQueueRecord[];
};


// =========================================================
// Helpers
// =========================================================

function tableUrl(): string {

  return (
    `${AIRTABLE_API_BASE}/`
    + `${AIRTABLE_BASE_ID}/`
    + encodeURIComponent(
        WRITE_QUEUE_TABLE,
      )
  );
}


async function request<T>(
  method:
    | "GET"
    | "POST"
    | "PATCH",

  url: string,

  body?: unknown,
): Promise<T> {

  const requestInit:
    RequestInit = {

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


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      [
        "Airtable request failed",
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
// List queue
// =========================================================

export async function listQueueRecords():
Promise<AirtableQueueRecord[]> {

  const result:
    AirtableQueueRecord[] = [];


  let offset:
    string
    | undefined;


  do {

    const url =
      new URL(
        tableUrl(),
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
      await request<
        AirtableListResponse
      >(
        "GET",
        url.toString(),
      );


    result.push(
      ...response.records,
    );


    offset =
      response.offset;

  } while (offset);


  return result;
}


// =========================================================
// Create queue mutation
// =========================================================

export async function createQueueRecord(
  fields:
    Record<
      string,
      unknown
    >,
): Promise<AirtableQueueRecord> {

  const response =
    await request<
      AirtableMutationResponse
    >(
      "POST",

      tableUrl(),

      {
        records: [
          {
            fields,
          },
        ],

        typecast:
          true,
      },
    );


  const record =
    response.records[0];


  if (!record) {
    throw new Error(
      "Airtable did not return the created queue record.",
    );
  }


  return record;
}


// =========================================================
// Update queue mutation
// =========================================================

export async function updateQueueRecord(
  recordId: string,

  fields:
    Record<
      string,
      unknown
    >,
): Promise<void> {

  await request(
    "PATCH",

    tableUrl(),

    {
      records: [
        {
          id:
            recordId,

          fields,
        },
      ],

      typecast:
        true,
    },
  );
}