ALTER TABLE concepts
ADD COLUMN source_context_json TEXT;


INSERT OR IGNORE INTO schema_migrations (
  version,
  name
)
VALUES (
  3,
  'concept_source_context'
);