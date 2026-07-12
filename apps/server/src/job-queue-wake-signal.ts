import { writeFile, watchFile, unwatchFile, type Stats } from "node:fs";
import { dirname, join } from "node:path";

const JOB_QUEUE_WAKE_SIGNAL_FILE = "job-queue-wake.json";

export function jobQueueWakeSignalPath(databasePath: string | undefined): string | null {
  if (!databasePath || databasePath === ":memory:") {
    return null;
  }

  return join(dirname(databasePath), JOB_QUEUE_WAKE_SIGNAL_FILE);
}

export function writeJobQueueWakeSignal(
  signalPath: string,
  input: {
    now: number;
  },
  onError?: (error: unknown) => void
): void {
  writeFile(signalPath, JSON.stringify({ lastAt: input.now }), (error) => {
    if (error) {
      onError?.(error);
    }
  });
}

export function watchJobQueueWakeSignal(
  signalPath: string,
  onWake: () => void,
  onError?: (error: unknown) => void
): () => void {
  const listener = (current: Stats, previous: Stats) => {
    if (
      current.mtimeMs === 0 ||
      (current.mtimeMs === previous.mtimeMs && current.size === previous.size)
    ) {
      return;
    }

    try {
      onWake();
    } catch (error) {
      onError?.(error);
    }
  };

  watchFile(signalPath, { interval: 500 }, listener);
  return () => {
    unwatchFile(signalPath, listener);
  };
}
