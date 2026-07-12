import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import type { DibaoDatabase } from "./types.js";
import { runMigrations } from "./migration-runner.js";

export type OpenDatabaseOptions = {
  loadSqliteVec?: boolean;
  migrate?: boolean;
};

export function openDatabase(
  path: string = ":memory:",
  options: OpenDatabaseOptions = {}
): DibaoDatabase {
  const { loadSqliteVec = true, migrate = false } = options;
  const db = new Database(path);

  if (loadSqliteVec) {
    sqliteVec.load(db);
  }

  configureDatabase(db);

  if (migrate) {
    runMigrations(db);
  }

  return db;
}

export function configureDatabase(db: DibaoDatabase): void {
  db.pragma(`journal_mode = ${sqliteJournalMode()}`);
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
}

function sqliteJournalMode(): string {
  const mode = process.env.DIBAO_SQLITE_JOURNAL_MODE?.trim().toUpperCase();
  return mode === "DELETE" ? "DELETE" : "WAL";
}

export function getSqliteVecVersion(db: DibaoDatabase): { version: string } {
  return db.prepare("select vec_version() as version").get() as { version: string };
}
