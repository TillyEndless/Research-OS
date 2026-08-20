import fs from "node:fs";
import path from "node:path";

import { db } from "./database.js";


const migrationsDir = path.resolve(
  process.cwd(),
  "server/db/migrations"
);


function ensureMigrationTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}


function getAppliedVersions(): Set<number> {
  ensureMigrationTable();

  const rows = db
    .prepare(`
      SELECT version
      FROM schema_migrations
      ORDER BY version
    `)
    .all() as Array<{
      version: number;
    }>;

  return new Set(
    rows.map((row) => row.version)
  );
}


export function runMigrations(): void {
  ensureMigrationTable();

  const applied =
    getAppliedVersions();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) =>
      /^\d+_.*\.sql$/.test(file)
    )
    .sort();

  for (const file of files) {
    const version = Number(
      file.split("_")[0]
    );

    if (applied.has(version)) {
      continue;
    }

    const migrationPath =
      path.join(
        migrationsDir,
        file
      );

    const sql =
      fs.readFileSync(
        migrationPath,
        "utf8"
      );

    console.log(
      `Applying migration ${file}`
    );

    db.exec("BEGIN IMMEDIATE");

    try {
      db.exec(sql);

      /*
       * Some migration files already insert themselves
       * into schema_migrations.
       *
       * Therefore we do not insert another row here.
       */

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");

      throw new Error(
        `Migration failed: ${file}`,
        {
          cause: error,
        }
      );
    }
  }
}