# Research-OS

Research-OS is a personal long-term AI research assistant designed for
continuous research work rather than one-off conversations.

It combines:

- ChatGPT Project as the conversational reasoning interface
- SQLite as the canonical long-term research memory
- Airtable as the cloud bridge between ChatGPT and the local database
- A structured research knowledge model for hypotheses, experiments,
  findings, decisions, actions, papers, concepts, and sources
- A local dashboard for tracking the current research state
- An MCP server reserved for extensibility and future direct integrations

The goal is to make research conversations persistent, structured,
traceable, and reusable across weeks, months, and projects.


## Architecture

```text
                         ChatGPT Project
                      AI Research Assistant
                              │
                 read / write structured memory
                              │
                              ▼
                         Airtable Bridge
                  ┌───────────┴───────────┐
                  │                       │
             Mirror Tables          WriteQueue
                  │                       │
                  │                       ▼
                  │              Local Sync Worker
                  │                       │
                  └───────────┬───────────┘
                              ▼
                    ResearchOS Service Layer
                              │
                              ▼
                      SQLite Canonical DB
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
       Research Memory     Concept Vault    Paper Memory
            │
            ▼
       Dashboard UI


Optional / extensibility layer:

                         MCP Server
                              │
                search / get / ingest / update
                              │
                              ▼
                      ResearchOS Services
````

The core principle is:

```text
SQLite = source of truth
Airtable = cloud mirror + write transport
ChatGPT = reasoning and interaction layer
Dashboard = visualization layer
```

## Why Research-OS?

Normal AI conversations are ephemeral.

A research project is not.

Research work accumulates:

* hypotheses
* failed ideas
* experimental evidence
* contradictory results
* advisor discussions
* design decisions
* papers
* concepts
* follow-up actions

Research-OS converts these into a persistent research graph instead of
leaving them scattered across chat histories, notes, PDFs, and meeting
transcripts.

## Research Memory Model

Research-OS currently uses eight primary entity types:

| ID  | Entity     | Purpose                                    |
| --- | ---------- | ------------------------------------------ |
| `S` | Source     | Meetings, chats, documents, notes, logs    |
| `H` | Hypothesis | Research hypotheses to be tested           |
| `E` | Experiment | Controlled experiments and evaluations     |
| `F` | Finding    | Observations, interpretations, conclusions |
| `D` | Decision   | Research or engineering decisions          |
| `A` | Action     | Planned or ongoing tasks                   |
| `P` | Paper      | Structured paper memory                    |
| `C` | Concept    | Permanent technical concept memory         |

Entities are connected through relations such as:

```text
introduces
discusses
supports
weakens
contradicts
refines
supersedes
motivates
tested_by
evaluates
designed_to_evaluate
leads_to
```

This forms a lightweight research DAG.

Example:

```text
Advisor Meeting
      │
      │ introduces
      ▼
 Hypothesis
      │
      │ tested_by
      ▼
 Experiment
      │
      │ produces
      ▼
   Finding
      │
      │ weakens
      ▼
 Hypothesis
      │
      │ motivates
      ▼
   Decision
      │
      │ leads_to
      ▼
    Action
```

## Workspace State

In addition to historical entities, Research-OS maintains a current
project-level projection:

```text
Core Question
Current Summary
Major Contradictions
Blockers
```

`WorkspaceState` is intentionally treated as a current-state cache rather
than historical truth.

Historical evolution remains stored in entities and relations.

## ChatGPT Integration

The intended user experience is natural conversation.

You should not need to manually manage IDs or issue commands such as:

```text
/create_hypothesis
/update_E001
/save_finding
```

Instead, interact normally:

> 今天导师认为 decode loss 可能主要被 decoder 自身吸收。
> 我们下一步先 freeze decoder 做 controlled experiment。
> 帮我结合之前研究状态分析，并更新 ResearchOS。

ChatGPT should:

```text
read existing research state
        ↓
identify relevant existing entities
        ↓
reason about the new information
        ↓
update or create structured research memory
        ↓
write a mutation to WriteQueue
```

## Airtable Bridge

ChatGPT Plus does not directly access the local SQLite database.

Airtable therefore acts as the cloud bridge.

### Read path

```text
SQLite
   ↓
ResearchOS sync
   ↓
Airtable mirror
   ↓
ChatGPT Project
```

The mirror currently contains:

```text
Entities
Relations
WorkspaceState
Sources
```

### Write path

Persistent changes from ChatGPT are written to:

```text
WriteQueue
```

Supported operations:

```text
update_entity
ingest_research_update
save_concept
```

The local worker consumes pending mutations:

```text
ChatGPT
   ↓
WriteQueue
   ↓
airtablePull.ts
   ↓
ResearchOS services
   ↓
SQLite
```

Afterwards the canonical state is pushed back to Airtable.

## Important Data Rule

The mirror tables should be treated as read-only from the ChatGPT side:

```text
Entities
Relations
WorkspaceState
Sources
```

Persistent modifications should go through:

```text
WriteQueue
```

This prevents Airtable and SQLite from becoming competing sources of
truth.

## Automatic Synchronization

The local sync worker runs:

```text
WriteQueue
   ↓
pull
   ↓
SQLite
   ↓
push
   ↓
Airtable mirror
```

Development command:

```bash
RESEARCH_OS_DB_PATH=data/test.db \
npm run sync:airtable:watch
```

The sync loop is designed to:

* process queued mutations serially
* avoid overlapping sync cycles
* tolerate temporary Airtable failures
* skip unchanged Airtable records
* prevent duplicate processing through mutation IDs

## macOS Background Service

For daily use, the sync worker can run through macOS `launchd`.

The intended user experience becomes:

```text
Login to Mac
     ↓
ResearchOS starts automatically
     ↓
Open ChatGPT
     ↓
Enter ResearchOS Project
     ↓
Start working
```

No Terminal interaction is required during normal use.

If the Mac is offline, ChatGPT can still enqueue mutations in Airtable.

When the Mac comes online again:

```text
pending WriteQueue mutations
        ↓
local worker
        ↓
SQLite
        ↓
Airtable mirror
```

This gives Research-OS a simple offline-queue behavior.

## Dashboard

Research-OS includes a local dashboard for inspecting the current research
state.

Start it with:

```bash
RESEARCH_OS_DB_PATH=data/test.db \
npm run dashboard:dev
```

Then open:

```text
http://127.0.0.1:3001
```

The dashboard currently exposes:

```text
Current Research State
Active Hypotheses
Experiments
Planned Actions
Recent Findings
Recent Decisions
Research Roadmap
Entity Counts
```

The dashboard is a visualization layer only.

It is not the canonical database and is not used as the ChatGPT bridge.

## Example Workflow

Suppose a meeting produces the following discussion:

> Decoder supervision improves teacher-forcing metrics,
> but free generation becomes worse.
>
> One possible explanation is that the decoder learns to reconstruct the
> textual chain-of-thought itself instead of forcing the upstream latent
> representation to contain reasoning information.
>
> We should freeze the decoder and run a controlled experiment.

Research-OS may represent this as:

```text
S001
Advisor discussion
    │
    └── introduces ──→ H001

H001
Decoder bypass hypothesis
    │
    ├── motivates ──→ D001
    │
    └── tested_by ──→ E001

D001
Freeze decoder during training
    │
    └── leads_to ──→ A001

E001
Freeze-decoder controlled experiment
```

After the experiment finishes, new findings can support, weaken, or
contradict the hypothesis without deleting the earlier research history.

## Historical Research Import

Research-OS can also be populated from existing material:

```text
ChatGPT histories
meeting transcripts
research notes
experiment logs
paper notes
research proposals
README files
```

Recommended workflow:

```text
historical material
       ↓
ChatGPT analysis
       ↓
deduplicate against ResearchOS
       ↓
extract entities
       ↓
construct relations
       ↓
WriteQueue
       ↓
SQLite
```

The system should preserve the distinction between:

```text
what somebody proposed
what was hypothesized
what was experimentally observed
what was interpreted
what was concluded
what was decided
```

## Concept Vault

Concepts are intentionally not saved automatically.

Normal question:

> 什么是 self-speculative decoding？

is treated as a normal conversation.

Explicit request:

> 把 self-speculative decoding 保存到 Concept Vault。

creates persistent concept memory.

This prevents the concept database from being polluted by every technical
term mentioned during conversation.

## MCP Server

Research-OS also contains an MCP server exposing structured research tools.

Current tool categories include:

```text
search research memory
get research entity
ingest research update
get dashboard snapshot
update entity
save concept
```

The MCP layer is retained as an extensibility interface.

The current ChatGPT Plus web workflow primarily uses the Airtable bridge,
because the local MCP server is not directly reachable from the standard
web Project environment.

## Project Structure

A simplified repository layout:

```text
Research-OS/
│
├── server/
│   ├── db/
│   │   ├── database.ts
│   │   ├── runMigrations.ts
│   │   └── migrations/
│   │
│   ├── schemas/
│   │
│   ├── services/
│   │
│   ├── sync/
│   │   ├── airtableSync.ts
│   │   ├── airtablePull.ts
│   │   ├── airtableQueueClient.ts
│   │   └── syncLoop.ts
│   │
│   ├── dashboard/
│   │   └── index.ts
│   │
│   └── index.ts
│
├── dashboard/
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── data/
│   ├── research-os.db
│   └── test.db
│
├── tests/
│
├── docs/
│   └── chatgpt-project-instructions.md
│
└── package.json
```

## Development

Install dependencies:

```bash
npm install
```

Run migrations:

```bash
RESEARCH_OS_DB_PATH=data/test.db \
npm run db:migrate
```

Type-check:

```bash
npm run typecheck
```

Run the MCP server:

```bash
npm run mcp:dev
```

Run Airtable pull:

```bash
RESEARCH_OS_DB_PATH=data/test.db \
npm run sync:airtable:pull
```

Run Airtable push:

```bash
RESEARCH_OS_DB_PATH=data/test.db \
npm run sync:airtable:push
```

Run continuous synchronization:

```bash
RESEARCH_OS_DB_PATH=data/test.db \
npm run sync:airtable:watch
```

Run the dashboard:

```bash
RESEARCH_OS_DB_PATH=data/test.db \
npm run dashboard:dev
```

## Design Principles

Research-OS follows several design principles:

1. **SQLite is authoritative**

   Cloud services are transport and mirrors, not the source of truth.

2. **Research history should not be silently overwritten**

   New evidence should update the research graph rather than erase earlier
   reasoning.

3. **Existing entities should be reused whenever possible**

   Search before creating.

4. **Observation and interpretation are different**

   Experimental results should not automatically become conclusions.

5. **Conversation should remain natural**

   The database should adapt to the research workflow, not force the user
   to think in database commands.

6. **Persistent memory should be selective**

   Not every conversation deserves permanent storage.

7. **Research state should remain inspectable**

   The dashboard and entity graph make the accumulated reasoning auditable.

## Current Status

Research-OS currently supports:

```text
Structured research memory          ✓
Research entity graph               ✓
SQLite persistence                  ✓
Airtable mirror                     ✓
Airtable WriteQueue                 ✓
ChatGPT-readable research memory    ✓
Queued ChatGPT → SQLite writes      ✓
Automatic pull / push sync          ✓
Idempotent mirror synchronization   ✓
Local research dashboard            ✓
MCP research tools                  ✓
macOS background worker             ✓
```

The current focus is moving from infrastructure development to real-world
research use and historical research-memory migration.

## License

Personal research project.

License TBD.
