PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS id_counters (
    entity_type TEXT PRIMARY KEY,

    prefix TEXT NOT NULL UNIQUE,

    next_number INTEGER NOT NULL
        CHECK (next_number >= 1),

    CHECK (
        entity_type IN (
            'source',
            'hypothesis',
            'experiment',
            'finding',
            'decision',
            'action',
            'paper',
            'concept'
        )
    )
);

INSERT OR IGNORE INTO id_counters VALUES
('source',     'S', 1),
('hypothesis', 'H', 1),
('experiment', 'E', 1),
('finding',    'F', 1),
('decision',   'D', 1),
('action',     'A', 1),
('paper',      'P', 1),
('concept',    'C', 1);

INSERT OR IGNORE INTO schema_migrations (
    version,
    name
)
VALUES (
    2,
    'add_id_counters'
);