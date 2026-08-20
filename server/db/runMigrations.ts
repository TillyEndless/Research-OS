import {
  runMigrations,
} from "./migrate.js";


runMigrations();

console.log(
  "All database migrations are up to date."
);