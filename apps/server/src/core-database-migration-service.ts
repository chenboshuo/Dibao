import {
  checksumSql,
  getAppliedMigrations,
  loadDefaultMigrations,
  runMigrations,
  type AppliedMigration,
  type DibaoDatabase,
  type Migration
} from "@dibao/db";

export const CORE_DATABASE_MIGRATION_ID = "core-database-schema-migrations" as const;
export const CORE_DATABASE_MIGRATION_TARGET_VERSION = "0.2" as const;

export type CoreDatabaseMigrationState =
  | "not_required"
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type CoreDatabaseMigrationStep =
  | "detecting"
  | "schemaMigration"
  | "completed"
  | "failed"
  | "skipped";

export type CoreDatabaseMigrationStatus = {
  id: typeof CORE_DATABASE_MIGRATION_ID;
  targetVersion: typeof CORE_DATABASE_MIGRATION_TARGET_VERSION;
  state: CoreDatabaseMigrationState;
  blocking: boolean;
  step: CoreDatabaseMigrationStep;
  activeIndexId: null;
  reason: string | null;
  progress: {
    current: number;
    total: number;
    chunksProcessed: number;
    percent: number;
  };
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  result: {
    appliedNow: AppliedMigration[];
  } | null;
};

export type CoreDatabaseMigrationServiceOptions = {
  db: DibaoDatabase;
  migrations?: readonly Migration[];
  now?: () => number;
  deferMs?: number;
  onError?: (error: unknown) => void;
};

export class CoreDatabaseMigrationService {
  private readonly migrations: readonly Migration[];
  private readonly now: () => number;
  private readonly deferMs: number;
  private status: CoreDatabaseMigrationStatus | null = null;
  private running: Promise<CoreDatabaseMigrationStatus> | null = null;

  constructor(private readonly options: CoreDatabaseMigrationServiceOptions) {
    this.migrations = options.migrations ?? loadDefaultMigrations();
    this.now = options.now ?? Date.now;
    this.deferMs = options.deferMs ?? 1500;
  }

  getStatus(): CoreDatabaseMigrationStatus {
    if (this.status?.state === "running" && this.running) {
      return this.status;
    }
    if (this.status?.state === "completed" || this.status?.state === "failed") {
      return this.status;
    }

    const detection = this.detectPendingMigrations();
    if (!detection.required) {
      this.status = statusFor({
        state: "not_required",
        blocking: false,
        step: "skipped",
        reason: detection.reason,
        total: 0,
        current: 0,
        now: this.now(),
        result: null
      });
      return this.status;
    }

    this.status = statusFor({
      state: "pending",
      blocking: true,
      step: "detecting",
      reason: detection.reason,
      total: detection.pending.length,
      current: 0,
      now: this.now(),
      result: null
    });
    return this.status;
  }

  isBlocking(): boolean {
    return this.getStatus().blocking;
  }

  startIfRequired(): Promise<CoreDatabaseMigrationStatus> {
    const status = this.getStatus();
    if (!status.blocking || status.state === "failed") {
      return Promise.resolve(status);
    }
    if (this.running) {
      return this.running;
    }

    this.running = this.runMigration(status).finally(() => {
      this.running = null;
    });
    this.running.catch((error) => this.options.onError?.(error));
    return this.running;
  }

  retry(): Promise<CoreDatabaseMigrationStatus> {
    if (this.status?.state === "failed") {
      this.status = null;
    }
    return this.startIfRequired();
  }

  private async runMigration(initial: CoreDatabaseMigrationStatus): Promise<CoreDatabaseMigrationStatus> {
    if (this.deferMs > 0) {
      await delay(this.deferMs);
    }

    const pending = this.detectPendingMigrations().pending;
    const startedAt = this.now();
    this.status = {
      ...initial,
      state: "running",
      blocking: true,
      step: "schemaMigration",
      progress: {
        current: 0,
        total: pending.length,
        chunksProcessed: 0,
        percent: pending.length > 0 ? 0 : 1
      },
      startedAt,
      finishedAt: null,
      error: null
    };

    try {
      const appliedNow = runMigrations(this.options.db, this.migrations, this.now);
      this.status = {
        ...this.status,
        state: "completed",
        blocking: false,
        step: "completed",
        progress: {
          current: appliedNow.length,
          total: pending.length,
          chunksProcessed: appliedNow.length,
          percent: 1
        },
        finishedAt: this.now(),
        error: null,
        result: { appliedNow }
      };
      return this.status;
    } catch (error) {
      this.status = {
        ...this.status,
        state: "failed",
        blocking: true,
        step: "failed",
        finishedAt: this.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      throw error;
    }
  }

  private detectPendingMigrations(): {
    required: boolean;
    reason: string;
    pending: readonly Migration[];
  } {
    const applied = getAppliedMigrations(this.options.db);
    const appliedByVersion = new Map(applied.map((migration) => [migration.version, migration]));
    const pending: Migration[] = [];

    for (const migration of this.migrations) {
      const checksum = migration.checksum ?? checksumSql(migration.sql);
      const existing = appliedByVersion.get(migration.version);
      if (!existing) {
        pending.push(migration);
        continue;
      }
      if (existing.checksum !== checksum || existing.name !== migration.name) {
        throw new Error(`Migration ${migration.version} has changed since it was applied`);
      }
    }

    return pending.length > 0
      ? {
          required: true,
          reason: `pending_core_migrations:${pending.map((migration) => migration.version).join(",")}`,
          pending
        }
      : { required: false, reason: "no_pending_core_migrations", pending };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function statusFor(input: {
  state: CoreDatabaseMigrationState;
  blocking: boolean;
  step: CoreDatabaseMigrationStep;
  reason: string;
  total: number;
  current: number;
  now: number;
  result: CoreDatabaseMigrationStatus["result"];
}): CoreDatabaseMigrationStatus {
  return {
    id: CORE_DATABASE_MIGRATION_ID,
    targetVersion: CORE_DATABASE_MIGRATION_TARGET_VERSION,
    state: input.state,
    blocking: input.blocking,
    step: input.step,
    activeIndexId: null,
    reason: input.reason,
    progress: {
      current: input.current,
      total: input.total,
      chunksProcessed: input.current,
      percent: input.total > 0 ? input.current / input.total : input.blocking ? 0 : 1
    },
    startedAt: null,
    finishedAt: input.state === "not_required" ? input.now : null,
    error: null,
    result: input.result
  };
}
