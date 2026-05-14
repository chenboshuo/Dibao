import type { DibaoDatabase } from "../types.js";

export interface AppSettingsRepository {
  getJson<T>(key: string): T | null;
  setJson(key: string, value: unknown, now?: number): void;
  delete(key: string): void;
}

export class SqliteAppSettingsRepository implements AppSettingsRepository {
  constructor(private readonly db: DibaoDatabase) {}

  getJson<T>(key: string): T | null {
    const row = this.db
      .prepare("select value_json as valueJson from app_settings where key = ?")
      .get(key) as { valueJson: string } | undefined;

    return row ? (JSON.parse(row.valueJson) as T) : null;
  }

  setJson(key: string, value: unknown, now: number = Date.now()): void {
    this.db
      .prepare(
        `
          insert into app_settings (key, value_json, updated_at)
          values (?, ?, ?)
          on conflict(key) do update set
            value_json = excluded.value_json,
            updated_at = excluded.updated_at
        `
      )
      .run(key, JSON.stringify(value), now);
  }

  delete(key: string): void {
    this.db.prepare("delete from app_settings where key = ?").run(key);
  }
}
