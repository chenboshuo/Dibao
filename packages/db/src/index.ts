import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export type DibaoDatabase = Database.Database;

export function openDatabase(path: string = ":memory:"): DibaoDatabase {
  const db = new Database(path);
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function getSqliteVecVersion(db: DibaoDatabase) {
  return db.prepare("select vec_version() as version").get() as { version: string };
}

export function float32VectorToBuffer(values: readonly number[]) {
  return Buffer.from(new Float32Array(values).buffer);
}

export function vectorToJson(values: readonly number[]) {
  return JSON.stringify(values);
}
