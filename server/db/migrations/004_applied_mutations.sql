CREATE TABLE IF NOT EXISTS applied_mutations (
  mutation_id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  result_json TEXT,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_applied_mutations_operation
ON applied_mutations(operation);


INSERT OR IGNORE INTO schema_migrations (
  version,
  name
)
VALUES (
  4,
  'applied_mutations'
);