import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const defaultDbPath = path.resolve(
  process.cwd(),
  "data/research-os.db"
);

const dbPath =
  process.env.RESEARCH_OS_DB_PATH
    ? path.resolve(
        process.cwd(),
        process.env.RESEARCH_OS_DB_PATH
      )
    : defaultDbPath;

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
`);

export function getDatabasePath(): string {
  return dbPath;
}