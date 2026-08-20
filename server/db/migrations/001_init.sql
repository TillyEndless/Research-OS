PRAGMA foreign_keys = ON;

-- =========================================================
-- Schema migrations
-- =========================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- Global entity registry
-- =========================================================

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,

    type TEXT NOT NULL CHECK (
        type IN (
            'source',
            'hypothesis',
            'experiment',
            'finding',
            'decision',
            'action',
            'paper',
            'concept'
        )
    ),

    title TEXT NOT NULL,

    status TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- Sources
-- =========================================================

CREATE TABLE IF NOT EXISTS sources (
    entity_id TEXT PRIMARY KEY,

    source_type TEXT NOT NULL CHECK (
        source_type IN (
            'advisor_chat',
            'meeting_transcript',
            'experiment_log',
            'paper',
            'user_update',
            'other'
        )
    ),

    source_date TEXT,

    file_name TEXT,
    uri TEXT,

    raw_text TEXT,
    summary TEXT,

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Hypotheses
-- =========================================================

CREATE TABLE IF NOT EXISTS hypotheses (
    entity_id TEXT PRIMARY KEY,

    statement TEXT NOT NULL,

    confidence TEXT CHECK (
        confidence IS NULL OR
        confidence IN (
            'low',
            'medium',
            'high'
        )
    ),

    rationale TEXT,

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Experiments
-- =========================================================

CREATE TABLE IF NOT EXISTS experiments (
    entity_id TEXT PRIMARY KEY,

    question TEXT,

    baseline TEXT,
    variant TEXT,

    model TEXT,
    dataset TEXT,

    configuration_json TEXT,
    controlled_variables_json TEXT,

    metrics_json TEXT,

    result_summary TEXT,

    started_at TEXT,
    completed_at TEXT,

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Findings
-- observation / interpretation / conclusion
-- =========================================================

CREATE TABLE IF NOT EXISTS findings (
    entity_id TEXT PRIMARY KEY,

    kind TEXT NOT NULL CHECK (
        kind IN (
            'observation',
            'interpretation',
            'conclusion'
        )
    ),

    statement TEXT NOT NULL,

    confidence TEXT CHECK (
        confidence IS NULL OR
        confidence IN (
            'low',
            'medium',
            'high'
        )
    ),

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Decisions
-- =========================================================

CREATE TABLE IF NOT EXISTS decisions (
    entity_id TEXT PRIMARY KEY,

    decision_text TEXT NOT NULL,
    reason TEXT,

    effective_date TEXT,

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Actions / next experiments / tasks
-- =========================================================

CREATE TABLE IF NOT EXISTS actions (
    entity_id TEXT PRIMARY KEY,

    task TEXT NOT NULL,

    priority TEXT CHECK (
        priority IS NULL OR
        priority IN (
            'low',
            'medium',
            'high',
            'critical'
        )
    ),

    due_date TEXT,

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Papers
-- =========================================================

CREATE TABLE IF NOT EXISTS papers (
    entity_id TEXT PRIMARY KEY,

    authors TEXT,
    venue TEXT,
    year INTEGER,

    arxiv_id TEXT,
    url TEXT,

    research_area TEXT,

    background TEXT,
    problem TEXT,
    core_insight TEXT,
    method TEXT,

    experiment_summary TEXT,
    limitations TEXT,

    relation_to_our_work TEXT,

    metadata_json TEXT,

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Concepts
-- =========================================================

CREATE TABLE IF NOT EXISTS concepts (
    entity_id TEXT PRIMARY KEY,

    term TEXT NOT NULL UNIQUE,

    aliases_json TEXT,

    definition_short TEXT,
    definition_detailed TEXT,

    intuition TEXT,
    why_it_matters TEXT,

    tags_json TEXT,

    FOREIGN KEY (entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE
);


-- =========================================================
-- Relations = edges in the research graph
-- =========================================================

CREATE TABLE IF NOT EXISTS relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    source_entity_id TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,

    relation_type TEXT NOT NULL,

    metadata_json TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE,

    FOREIGN KEY (target_entity_id)
        REFERENCES entities(id)
        ON DELETE CASCADE,

    UNIQUE (
        source_entity_id,
        target_entity_id,
        relation_type
    )
);


-- =========================================================
-- Current research state
-- This is a derived current-state view, not historical truth.
-- =========================================================

CREATE TABLE IF NOT EXISTS workspace_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    core_question TEXT,

    current_summary TEXT,

    major_contradictions_json TEXT,
    blockers_json TEXT,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


INSERT OR IGNORE INTO workspace_state (
    id,
    core_question,
    current_summary,
    major_contradictions_json,
    blockers_json
)
VALUES (
    1,
    NULL,
    NULL,
    '[]',
    '[]'
);


-- =========================================================
-- Useful indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_entities_type
ON entities(type);

CREATE INDEX IF NOT EXISTS idx_entities_status
ON entities(status);

CREATE INDEX IF NOT EXISTS idx_relations_source
ON relations(source_entity_id);

CREATE INDEX IF NOT EXISTS idx_relations_target
ON relations(target_entity_id);

CREATE INDEX IF NOT EXISTS idx_relations_type
ON relations(relation_type);


INSERT OR IGNORE INTO schema_migrations (
    version,
    name
)
VALUES (
    1,
    'initial_schema'
);