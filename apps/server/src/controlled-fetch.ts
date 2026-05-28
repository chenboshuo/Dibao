import { isIP } from "node:net";

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
export const DEFAULT_FEED_FETCH_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_FULL_CONTENT_FETCH_MAX_BYTES = 3 * 1024 * 1024;

export type ControlledFetchResponse = {
  ok: boolean;
  status: number;
  statusText?: string;
  url?: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
};

export type ControlledFetcher = (
  url: string,
  init?: RequestInit
) => Promise<ControlledFetchResponse>;

export type FetchPrivacyWarning = {
  url: string;
  hostname: string;
  reason: string;
};

export type ControlledFetchTextOptions = {
  fetcher?: ControlledFetcher;
  headers?: RequestInit["headers"];
  timeoutMs?: number;
  maxBytes?: number;
  onWarning?: (warning: FetchPrivacyWarning) => void;
};

export class ControlledFetchError extends Error {
  constructor(
    readonly code: "FETCH_TIMEOUT" | "FETCH_TOO_LARGE" | "FETCH_READ_FAILED",
    message: string
  ) {
    super(message);
    this.name = "ControlledFetchError";
  }
}

export async function controlledFetchText(
  url: string,
  options: ControlledFetchTextOptions = {}
): Promise<{ response: ControlledFetchResponse; body: string }> {
  const timeoutMs = normalizePositiveInteger(
    options.timeoutMs ?? readPositiveIntegerEnv("DIBAO_FETCH_TIMEOUT_MS"),
    DEFAULT_FETCH_TIMEOUT_MS
  );
  const maxBytes = normalizePositiveInteger(options.maxBytes, DEFAULT_FEED_FETCH_MAX_BYTES);
  const fetcher = options.fetcher ?? fetch;

  warnIfPrivateTarget(url, options.onWarning);

  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    const fetchPromise = fetcher(url, {
      headers: options.headers,
      signal: controller.signal
    });
    fetchPromise.catch(() => undefined);
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ControlledFetchError("FETCH_TIMEOUT", `Fetch timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const response = await Promise.race([
      fetchPromise,
      timeoutPromise
    ]);
    if (response.url && response.url !== url) {
      warnIfPrivateTarget(response.url, options.onWarning);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const parsedLength = Number(contentLength);
      if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
        throw new ControlledFetchError(
          "FETCH_TOO_LARGE",
          `Fetch response exceeded ${maxBytes} bytes`
        );
      }
    }

    const body = await Promise.race([
      readResponseBody(response, maxBytes),
      timeoutPromise
    ]);
    return { response, body };
  } catch (error) {
    if (timedOut || isAbortError(error)) {
      throw new ControlledFetchError("FETCH_TIMEOUT", `Fetch timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function feedFetchMaxBytes(): number {
  return normalizePositiveInteger(
    readPositiveIntegerEnv("DIBAO_FETCH_FEED_MAX_BYTES"),
    DEFAULT_FEED_FETCH_MAX_BYTES
  );
}

export function fullContentFetchMaxBytes(): number {
  return normalizePositiveInteger(
    readPositiveIntegerEnv("DIBAO_FETCH_FULL_CONTENT_MAX_BYTES"),
    DEFAULT_FULL_CONTENT_FETCH_MAX_BYTES
  );
}

async function readResponseBody(response: ControlledFetchResponse, maxBytes: number): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ControlledFetchError(
          "FETCH_TOO_LARGE",
          `Fetch response exceeded ${maxBytes} bytes`
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } catch (error) {
    if (error instanceof ControlledFetchError) {
      throw error;
    }
    throw new ControlledFetchError("FETCH_READ_FAILED", errorMessage(error));
  }
}

function warnIfPrivateTarget(urlValue: string, onWarning?: (warning: FetchPrivacyWarning) => void): void {
  if (!onWarning) {
    return;
  }

  try {
    const url = new URL(urlValue);
    const hostname = url.hostname.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
    const reason = privateTargetReason(hostname);
    if (reason) {
      onWarning({ url: url.toString(), hostname, reason });
    }
  } catch {
    return;
  }
}

function privateTargetReason(hostname: string): string | null {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return "localhost";
  }
  if (hostname.endsWith(".local")) {
    return "local-domain";
  }
  if (hostname === "metadata.google.internal") {
    return "metadata-host";
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    return privateIpv4Reason(hostname);
  }
  if (ipVersion === 6) {
    return privateIpv6Reason(hostname);
  }

  return null;
}

function privateIpv4Reason(hostname: string): string | null {
  const parts = hostname.split(".").map((part) => Number(part));
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) {
    return "private-ipv4";
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return "private-ipv4";
  }
  if (a === 192 && b === 168) {
    return "private-ipv4";
  }
  if (a === 169 && b === 254) {
    return "link-local-ipv4";
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return "carrier-grade-nat-ipv4";
  }
  return null;
}

function privateIpv6Reason(hostname: string): string | null {
  if (hostname === "::1") {
    return "loopback-ipv6";
  }
  if (hostname.startsWith("fc") || hostname.startsWith("fd")) {
    return "unique-local-ipv6";
  }
  if (hostname.startsWith("fe80:")) {
    return "link-local-ipv6";
  }
  return null;
}

function readPositiveIntegerEnv(name: string): number | undefined {
  const value = process.env[name];
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
