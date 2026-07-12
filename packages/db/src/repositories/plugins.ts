import type {
  DibaoDatabase,
  InsertPluginDeliveryAttemptInput,
  PluginInstallRow,
  PluginInstallStatus,
  PluginDeliveryAttemptRow,
  PluginDeliveryListInput,
  PluginDeliveryRow,
  PluginSecretMetadata,
  PluginSecretRow,
  PluginScheduleRow,
  PluginSourceType,
  PluginTrustLevel,
  PluginUpdateCheckRow,
  UpsertPluginDeliveryInput,
  UpsertPluginInstallInput,
  UpsertPluginSecretInput,
  UpsertPluginScheduleInput,
  UpsertPluginUpdateCheckInput
} from "../types.js";

type PluginInstallDbRow = {
  id: string;
  version: string;
  sourceType: PluginSourceType;
  sourceUrl: string | null;
  updateUrl: string | null;
  packagePath: string | null;
  dataPath: string | null;
  manifestJson: string;
  status: PluginInstallStatus;
  official: number;
  bundled: number;
  trustLevel: PluginTrustLevel;
  installedAt: number;
  updatedAt: number;
  enabledAt: number | null;
  disabledAt: number | null;
  lastError: string | null;
};

type PluginUpdateCheckDbRow = {
  pluginId: string;
  latestVersion: string | null;
  updateUrl: string | null;
  packageUrl: string | null;
  checksum: string | null;
  metadataJson: string | null;
  checkedAt: number;
  error: string | null;
};

type PluginScheduleDbRow = {
  pluginId: string;
  taskId: string;
  enabled: number;
  schedule: PluginScheduleRow["schedule"];
  intervalMs: number | null;
  localTime: string | null;
  timezone: string | null;
  nextRunAt: number | null;
  lastRunAt: number | null;
  lastJobId: string | null;
  updatedAt: number;
};

type PluginSecretDbRow = {
  pluginId: string;
  key: string;
  ciphertext: string;
  hint: string | null;
  createdAt: number;
  updatedAt: number;
};

type PluginDeliveryDbRow = {
  id: string;
  pluginId: string;
  status: PluginDeliveryRow["status"];
  method: PluginDeliveryRow["method"];
  url: string;
  requestJson: string;
  responseJson: string | null;
  error: string | null;
  idempotencyKey: string | null;
  jobId: string | null;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
};

type PluginDeliveryAttemptDbRow = {
  id: string;
  deliveryId: string;
  attempt: number;
  status: PluginDeliveryAttemptRow["status"];
  statusCode: number | null;
  durationMs: number | null;
  requestJson: string;
  responseJson: string | null;
  error: string | null;
  createdAt: number;
};

export interface PluginRepository {
  deleteInstall(pluginId: string): void;
  deleteKv(pluginId: string, key: string): void;
  deleteSecret(pluginId: string, key: string): void;
  findInstall(pluginId: string): PluginInstallRow | null;
  findDelivery(id: string): PluginDeliveryRow | null;
  findDeliveryByIdempotencyKey(pluginId: string, idempotencyKey: string): PluginDeliveryRow | null;
  getKv<T>(pluginId: string, key: string): T | null;
  getSecret(pluginId: string, key: string): PluginSecretRow | null;
  getSetting<T>(pluginId: string, key: string): T | null;
  grantCapabilities(pluginId: string, capabilities: string[], now?: number): void;
  insertDeliveryAttempt(input: InsertPluginDeliveryAttemptInput): PluginDeliveryAttemptRow;
  listCapabilityGrants(pluginId: string): string[];
  listDeliveryAttempts(deliveryId: string): PluginDeliveryAttemptRow[];
  listDeliveries(input: PluginDeliveryListInput): PluginDeliveryRow[];
  listDueSchedules(now: number): PluginScheduleRow[];
  listInstalls(): PluginInstallRow[];
  listKvByPrefix<T>(pluginId: string, prefix: string): Array<{ key: string; value: T; updatedAt: number }>;
  listSecrets(pluginId: string): PluginSecretMetadata[];
  listSettings(pluginId: string): Record<string, unknown>;
  listSchedules(pluginId: string): PluginScheduleRow[];
  setKv(pluginId: string, key: string, value: unknown, now?: number): void;
  setSetting(pluginId: string, key: string, value: unknown, now?: number): void;
  setStatus(pluginId: string, status: PluginInstallStatus, error?: string | null, now?: number): void;
  updateDeliveryStatus(
    id: string,
    input: {
      status: PluginDeliveryRow["status"];
      responseJson?: string | null;
      error?: string | null;
      jobId?: string | null;
      finishedAt?: number | null;
      now?: number;
    }
  ): PluginDeliveryRow | null;
  upsertDelivery(input: UpsertPluginDeliveryInput): PluginDeliveryRow;
  upsertInstall(input: UpsertPluginInstallInput): PluginInstallRow;
  upsertSecret(input: UpsertPluginSecretInput): PluginSecretMetadata;
  upsertSchedule(input: UpsertPluginScheduleInput): PluginScheduleRow;
  upsertUpdateCheck(input: UpsertPluginUpdateCheckInput): PluginUpdateCheckRow;
}

export class SqlitePluginRepository implements PluginRepository {
  constructor(private readonly db: DibaoDatabase) {}

  deleteInstall(pluginId: string): void {
    this.db.prepare("delete from plugin_installs where id = ?").run(pluginId);
  }

  deleteKv(pluginId: string, key: string): void {
    this.db.prepare("delete from plugin_kv where plugin_id = ? and key = ?").run(pluginId, key);
  }

  deleteSecret(pluginId: string, key: string): void {
    this.db.prepare("delete from plugin_secrets where plugin_id = ? and key = ?").run(pluginId, key);
  }

  findInstall(pluginId: string): PluginInstallRow | null {
    const row = this.db
      .prepare(`${basePluginInstallSelect()} where id = ?`)
      .get(pluginId) as PluginInstallDbRow | undefined;
    return row ? mapPluginInstall(row) : null;
  }

  findDelivery(id: string): PluginDeliveryRow | null {
    const row = this.db
      .prepare(`${basePluginDeliverySelect()} where id = ?`)
      .get(id) as PluginDeliveryDbRow | undefined;
    return row ?? null;
  }

  findDeliveryByIdempotencyKey(pluginId: string, idempotencyKey: string): PluginDeliveryRow | null {
    const row = this.db
      .prepare(`${basePluginDeliverySelect()} where plugin_id = ? and idempotency_key = ?`)
      .get(pluginId, idempotencyKey) as PluginDeliveryDbRow | undefined;
    return row ?? null;
  }

  getKv<T>(pluginId: string, key: string): T | null {
    return readJsonRow<T>(this.db, "plugin_kv", pluginId, key);
  }

  getSecret(pluginId: string, key: string): PluginSecretRow | null {
    const row = this.db
      .prepare(`${basePluginSecretSelect()} where plugin_id = ? and key = ?`)
      .get(pluginId, key) as PluginSecretDbRow | undefined;
    return row ?? null;
  }

  getSetting<T>(pluginId: string, key: string): T | null {
    return readJsonRow<T>(this.db, "plugin_settings", pluginId, key);
  }

  grantCapabilities(pluginId: string, capabilities: string[], now = Date.now()): void {
    const insert = this.db.prepare(`
      insert or ignore into plugin_capability_grants (plugin_id, capability, granted_at)
      values (?, ?, ?)
    `);

    this.db.transaction(() => {
      this.db.prepare("delete from plugin_capability_grants where plugin_id = ?").run(pluginId);
      for (const capability of capabilities) {
        insert.run(pluginId, capability, now);
      }
    })();
  }

  insertDeliveryAttempt(input: InsertPluginDeliveryAttemptInput): PluginDeliveryAttemptRow {
    const now = input.now ?? Date.now();
    this.db
      .prepare(
        `
          insert into plugin_delivery_attempts (
            id, delivery_id, attempt, status, status_code, duration_ms,
            request_json, response_json, error, created_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.id,
        input.deliveryId,
        input.attempt,
        input.status,
        input.statusCode ?? null,
        input.durationMs ?? null,
        input.requestJson,
        input.responseJson ?? null,
        input.error ?? null,
        now
      );

    const row = this.db
      .prepare(`${basePluginDeliveryAttemptSelect()} where id = ?`)
      .get(input.id) as PluginDeliveryAttemptDbRow | undefined;
    if (!row) {
      throw new Error(`Failed to insert plugin delivery attempt: ${input.id}`);
    }
    return row;
  }

  listCapabilityGrants(pluginId: string): string[] {
    return (
      this.db
        .prepare(
          `
            select capability
            from plugin_capability_grants
            where plugin_id = ?
            order by capability
          `
        )
        .all(pluginId) as Array<{ capability: string }>
    ).map((row) => row.capability);
  }

  listDeliveryAttempts(deliveryId: string): PluginDeliveryAttemptRow[] {
    return (
      this.db
        .prepare(
          `
            ${basePluginDeliveryAttemptSelect()}
            where delivery_id = ?
            order by attempt, created_at
          `
        )
        .all(deliveryId) as PluginDeliveryAttemptDbRow[]
    );
  }

  listDeliveries(input: PluginDeliveryListInput): PluginDeliveryRow[] {
    const conditions = ["plugin_id = ?"];
    const params: unknown[] = [input.pluginId];
    if (input.status) {
      conditions.push("status = ?");
      params.push(input.status);
    }
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    return (
      this.db
        .prepare(
          `
            ${basePluginDeliverySelect()}
            where ${conditions.join(" and ")}
            order by updated_at desc, id desc
            limit ?
          `
        )
        .all(...params, limit) as PluginDeliveryDbRow[]
    );
  }

  listDueSchedules(now: number): PluginScheduleRow[] {
    return (
      this.db
        .prepare(
          `
            ${basePluginScheduleSelect()}
            where enabled = 1
              and next_run_at is not null
              and next_run_at <= ?
            order by next_run_at, plugin_id, task_id
          `
        )
        .all(now) as PluginScheduleDbRow[]
    ).map(mapPluginSchedule);
  }

  listInstalls(): PluginInstallRow[] {
    return (
      this.db
        .prepare(
          `
            ${basePluginInstallSelect()}
            order by official desc, bundled desc, id
          `
        )
        .all() as PluginInstallDbRow[]
    ).map(mapPluginInstall);
  }

  listKvByPrefix<T>(pluginId: string, prefix: string): Array<{ key: string; value: T; updatedAt: number }> {
    const rows = this.db
      .prepare(
        `
          select key, value_json as valueJson, updated_at as updatedAt
          from plugin_kv
          where plugin_id = ?
            and key like ? escape '\\'
          order by key
        `
      )
      .all(pluginId, `${escapeLikePattern(prefix)}%`) as Array<{
        key: string;
        valueJson: string;
        updatedAt: number;
      }>;

    return rows.map((row) => ({
      key: row.key,
      value: JSON.parse(row.valueJson) as T,
      updatedAt: row.updatedAt
    }));
  }

  listSecrets(pluginId: string): PluginSecretMetadata[] {
    return (
      this.db
        .prepare(
          `
            ${basePluginSecretSelect()}
            where plugin_id = ?
            order by key
          `
        )
        .all(pluginId) as PluginSecretDbRow[]
    ).map(mapPluginSecretMetadata);
  }

  listSettings(pluginId: string): Record<string, unknown> {
    const rows = this.db
      .prepare(
        `
          select key, value_json as valueJson
          from plugin_settings
          where plugin_id = ?
          order by key
        `
      )
      .all(pluginId) as Array<{ key: string; valueJson: string }>;

    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      settings[row.key] = JSON.parse(row.valueJson);
    }
    return settings;
  }

  listSchedules(pluginId: string): PluginScheduleRow[] {
    return (
      this.db
        .prepare(
          `
            ${basePluginScheduleSelect()}
            where plugin_id = ?
            order by task_id
          `
        )
        .all(pluginId) as PluginScheduleDbRow[]
    ).map(mapPluginSchedule);
  }

  setKv(pluginId: string, key: string, value: unknown, now = Date.now()): void {
    writeJsonRow(this.db, "plugin_kv", pluginId, key, value, now);
  }

  setSetting(pluginId: string, key: string, value: unknown, now = Date.now()): void {
    writeJsonRow(this.db, "plugin_settings", pluginId, key, value, now);
  }

  setStatus(pluginId: string, status: PluginInstallStatus, error: string | null = null, now = Date.now()): void {
    this.db
      .prepare(
        `
          update plugin_installs
          set
            status = ?,
            last_error = ?,
            enabled_at = case when ? = 'enabled' then ? else enabled_at end,
            disabled_at = case
              when ? in ('enabled', 'installed') then null
              when ? in ('disabled', 'incompatible', 'failed') then ?
              else disabled_at
            end,
            updated_at = ?
          where id = ?
        `
      )
      .run(status, error, status, now, status, status, now, now, pluginId);
  }

  updateDeliveryStatus(
    id: string,
    input: {
      status: PluginDeliveryRow["status"];
      responseJson?: string | null;
      error?: string | null;
      jobId?: string | null;
      finishedAt?: number | null;
      now?: number;
    }
  ): PluginDeliveryRow | null {
    const now = input.now ?? Date.now();
    const existing = this.findDelivery(id);
    if (!existing) {
      return null;
    }
    this.db
      .prepare(
        `
          update plugin_deliveries
          set
            status = ?,
            response_json = ?,
            error = ?,
            job_id = ?,
            finished_at = ?,
            updated_at = ?
          where id = ?
        `
      )
      .run(
        input.status,
        input.responseJson === undefined ? existing.responseJson : input.responseJson,
        input.error === undefined ? existing.error : input.error,
        input.jobId === undefined ? existing.jobId : input.jobId,
        input.finishedAt === undefined ? existing.finishedAt : input.finishedAt,
        now,
        id
      );
    return this.findDelivery(id);
  }

  upsertDelivery(input: UpsertPluginDeliveryInput): PluginDeliveryRow {
    const now = input.now ?? Date.now();
    this.db
      .prepare(
        `
          insert into plugin_deliveries (
            id, plugin_id, status, method, url, request_json, response_json,
            error, idempotency_key, job_id, created_at, updated_at, finished_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(id) do update set
            status = excluded.status,
            method = excluded.method,
            url = excluded.url,
            request_json = excluded.request_json,
            response_json = excluded.response_json,
            error = excluded.error,
            idempotency_key = excluded.idempotency_key,
            job_id = excluded.job_id,
            updated_at = excluded.updated_at,
            finished_at = excluded.finished_at
        `
      )
      .run(
        input.id,
        input.pluginId,
        input.status,
        input.method,
        input.url,
        input.requestJson,
        input.responseJson ?? null,
        input.error ?? null,
        input.idempotencyKey ?? null,
        input.jobId ?? null,
        now,
        now,
        input.finishedAt ?? null
      );
    const row = this.findDelivery(input.id);
    if (!row) {
      throw new Error(`Failed to upsert plugin delivery: ${input.id}`);
    }
    return row;
  }

  upsertInstall(input: UpsertPluginInstallInput): PluginInstallRow {
    const now = input.now ?? Date.now();
    const existing = this.findInstall(input.id);
    this.db
      .prepare(
        `
          insert into plugin_installs (
            id, version, source_type, source_url, update_url, package_path, data_path,
            manifest_json, status, official, bundled, trust_level, installed_at, updated_at,
            enabled_at, disabled_at, last_error
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(id) do update set
            version = excluded.version,
            source_type = excluded.source_type,
            source_url = excluded.source_url,
            update_url = excluded.update_url,
            package_path = excluded.package_path,
            data_path = excluded.data_path,
            manifest_json = excluded.manifest_json,
            status = excluded.status,
            official = excluded.official,
            bundled = excluded.bundled,
            trust_level = excluded.trust_level,
            updated_at = excluded.updated_at,
            enabled_at = excluded.enabled_at,
            disabled_at = excluded.disabled_at,
            last_error = excluded.last_error
        `
      )
      .run(
        input.id,
        input.version,
        input.sourceType,
        input.sourceUrl ?? null,
        input.updateUrl ?? null,
        input.packagePath ?? null,
        input.dataPath ?? null,
        input.manifestJson,
        input.status,
        input.official ? 1 : 0,
        input.bundled ? 1 : 0,
        input.trustLevel,
        existing?.installedAt ?? now,
        now,
        input.status === "enabled" ? now : existing?.enabledAt ?? null,
        input.status === "enabled" || input.status === "installed"
          ? null
          : input.status === "disabled" || input.status === "incompatible" || input.status === "failed"
          ? now
          : existing?.disabledAt ?? null,
        input.lastError ?? null
      );

    const install = this.findInstall(input.id);
    if (!install) {
      throw new Error(`Failed to upsert plugin install: ${input.id}`);
    }
    return install;
  }

  upsertSecret(input: UpsertPluginSecretInput): PluginSecretMetadata {
    const now = input.now ?? Date.now();
    const existing = this.getSecret(input.pluginId, input.key);
    this.db
      .prepare(
        `
          insert into plugin_secrets (plugin_id, key, ciphertext, hint, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?)
          on conflict(plugin_id, key) do update set
            ciphertext = excluded.ciphertext,
            hint = excluded.hint,
            updated_at = excluded.updated_at
        `
      )
      .run(input.pluginId, input.key, input.ciphertext, input.hint ?? null, existing?.createdAt ?? now, now);
    const row = this.getSecret(input.pluginId, input.key);
    if (!row) {
      throw new Error(`Failed to upsert plugin secret: ${input.pluginId}:${input.key}`);
    }
    return mapPluginSecretMetadata(row);
  }

  upsertSchedule(input: UpsertPluginScheduleInput): PluginScheduleRow {
    const now = input.now ?? Date.now();
    this.db
      .prepare(
        `
          insert into plugin_schedules (
            plugin_id, task_id, enabled, schedule, interval_ms, local_time, timezone,
            next_run_at, last_run_at, last_job_id, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(plugin_id, task_id) do update set
            enabled = excluded.enabled,
            schedule = excluded.schedule,
            interval_ms = excluded.interval_ms,
            local_time = excluded.local_time,
            timezone = excluded.timezone,
            next_run_at = excluded.next_run_at,
            last_run_at = excluded.last_run_at,
            last_job_id = excluded.last_job_id,
            updated_at = excluded.updated_at
        `
      )
      .run(
        input.pluginId,
        input.taskId,
        input.enabled ? 1 : 0,
        input.schedule,
        input.intervalMs ?? null,
        input.localTime ?? null,
        input.timezone ?? null,
        input.nextRunAt ?? null,
        input.lastRunAt ?? null,
        input.lastJobId ?? null,
        now
      );

    const row = this.db
      .prepare(`${basePluginScheduleSelect()} where plugin_id = ? and task_id = ?`)
      .get(input.pluginId, input.taskId) as PluginScheduleDbRow | undefined;
    if (!row) {
      throw new Error(`Failed to upsert plugin schedule: ${input.pluginId}:${input.taskId}`);
    }
    return mapPluginSchedule(row);
  }

  upsertUpdateCheck(input: UpsertPluginUpdateCheckInput): PluginUpdateCheckRow {
    const now = input.now ?? Date.now();
    this.db
      .prepare(
        `
          insert into plugin_update_checks (
            plugin_id, latest_version, update_url, package_url, checksum, metadata_json, checked_at, error
          )
          values (?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(plugin_id) do update set
            latest_version = excluded.latest_version,
            update_url = excluded.update_url,
            package_url = excluded.package_url,
            checksum = excluded.checksum,
            metadata_json = excluded.metadata_json,
            checked_at = excluded.checked_at,
            error = excluded.error
        `
      )
      .run(
        input.pluginId,
        input.latestVersion ?? null,
        input.updateUrl ?? null,
        input.packageUrl ?? null,
        input.checksum ?? null,
        input.metadataJson ?? null,
        now,
        input.error ?? null
      );

    const row = this.db
      .prepare(
        `
          select
            plugin_id as pluginId,
            latest_version as latestVersion,
            update_url as updateUrl,
            package_url as packageUrl,
            checksum,
            metadata_json as metadataJson,
            checked_at as checkedAt,
            error
          from plugin_update_checks
          where plugin_id = ?
        `
      )
      .get(input.pluginId) as PluginUpdateCheckDbRow | undefined;
    if (!row) {
      throw new Error(`Failed to upsert plugin update check: ${input.pluginId}`);
    }
    return row;
  }
}

function basePluginInstallSelect(): string {
  return `
    select
      id,
      version,
      source_type as sourceType,
      source_url as sourceUrl,
      update_url as updateUrl,
      package_path as packagePath,
      data_path as dataPath,
      manifest_json as manifestJson,
      status,
      official,
      bundled,
      trust_level as trustLevel,
      installed_at as installedAt,
      updated_at as updatedAt,
      enabled_at as enabledAt,
      disabled_at as disabledAt,
      last_error as lastError
    from plugin_installs
  `;
}

function basePluginScheduleSelect(): string {
  return `
    select
      plugin_id as pluginId,
      task_id as taskId,
      enabled,
      schedule,
      interval_ms as intervalMs,
      local_time as localTime,
      timezone,
      next_run_at as nextRunAt,
      last_run_at as lastRunAt,
      last_job_id as lastJobId,
      updated_at as updatedAt
    from plugin_schedules
  `;
}

function basePluginSecretSelect(): string {
  return `
    select
      plugin_id as pluginId,
      key,
      ciphertext,
      hint,
      created_at as createdAt,
      updated_at as updatedAt
    from plugin_secrets
  `;
}

function basePluginDeliverySelect(): string {
  return `
    select
      id,
      plugin_id as pluginId,
      status,
      method,
      url,
      request_json as requestJson,
      response_json as responseJson,
      error,
      idempotency_key as idempotencyKey,
      job_id as jobId,
      created_at as createdAt,
      updated_at as updatedAt,
      finished_at as finishedAt
    from plugin_deliveries
  `;
}

function basePluginDeliveryAttemptSelect(): string {
  return `
    select
      id,
      delivery_id as deliveryId,
      attempt,
      status,
      status_code as statusCode,
      duration_ms as durationMs,
      request_json as requestJson,
      response_json as responseJson,
      error,
      created_at as createdAt
    from plugin_delivery_attempts
  `;
}

function mapPluginInstall(row: PluginInstallDbRow): PluginInstallRow {
  return {
    ...row,
    official: row.official === 1,
    bundled: row.bundled === 1
  };
}

function mapPluginSchedule(row: PluginScheduleDbRow): PluginScheduleRow {
  return {
    ...row,
    enabled: row.enabled === 1
  };
}

function mapPluginSecretMetadata(row: PluginSecretDbRow): PluginSecretMetadata {
  return {
    pluginId: row.pluginId,
    key: row.key,
    hasValue: Boolean(row.ciphertext),
    hint: row.hint,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function readJsonRow<T>(
  db: DibaoDatabase,
  table: "plugin_kv" | "plugin_settings",
  pluginId: string,
  key: string
): T | null {
  const row = db
    .prepare(
      `
        select value_json as valueJson
        from ${table}
        where plugin_id = ?
          and key = ?
      `
    )
    .get(pluginId, key) as { valueJson: string } | undefined;

  return row ? (JSON.parse(row.valueJson) as T) : null;
}

function writeJsonRow(
  db: DibaoDatabase,
  table: "plugin_kv" | "plugin_settings",
  pluginId: string,
  key: string,
  value: unknown,
  now: number
): void {
  db.prepare(
    `
      insert into ${table} (plugin_id, key, value_json, updated_at)
      values (?, ?, ?, ?)
      on conflict(plugin_id, key) do update set
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `
  ).run(pluginId, key, JSON.stringify(value), now);
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
