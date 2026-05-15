import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type {
  AppSettingsRepository,
  AuthCredentialRepository,
  SessionRepository
} from "@dibao/db";

export const AUTH_CREDENTIAL_ID = "single_user";
export const PASSWORD_ALGO = "scrypt:v1";
export const SCRYPT_N = 16_384;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SCRYPT_SALT_BYTES = 32;
export const SCRYPT_KEYLEN = 64;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 1024;
export const SESSION_TOKEN_BYTES = 32;
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthSessionStatus = {
  setupCompleted: boolean;
  authenticated: boolean;
};

export type AuthSessionResult = {
  token: string;
  expiresAt: number;
};

export type AuthRequestMeta = {
  userAgent?: string | null;
  ip?: string | null;
};

export class AuthServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export type AuthServiceOptions = {
  credentials: AuthCredentialRepository;
  sessions: SessionRepository;
  settings: AppSettingsRepository;
  now?: () => number;
};

export class AuthService {
  private readonly now: () => number;

  constructor(private readonly options: AuthServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  async setup(password: string, meta: AuthRequestMeta = {}): Promise<AuthSessionResult> {
    validatePassword(password);

    if (this.options.credentials.hasCredential()) {
      throw new AuthServiceError(409, "CONFLICT", "Setup has already been completed");
    }

    const now = this.now();
    const passwordHash = await hashPassword(password);
    this.options.credentials.createCredential({
      id: AUTH_CREDENTIAL_ID,
      passwordHash,
      passwordAlgo: PASSWORD_ALGO,
      now
    });
    this.options.settings.setJson("setup.completed", true, now);

    return this.createSession(meta, now);
  }

  async login(password: string, meta: AuthRequestMeta = {}): Promise<AuthSessionResult> {
    validatePasswordLengthForLogin(password);

    const credential = this.options.credentials.findCredential();
    if (!credential) {
      throw new AuthServiceError(409, "CONFLICT", "Setup has not been completed");
    }

    const ok = await verifyPassword(password, credential.passwordHash);
    if (!ok) {
      throw new AuthServiceError(401, "UNAUTHORIZED", "Invalid password");
    }

    return this.createSession(meta, this.now());
  }

  getSessionStatus(token: string | null): AuthSessionStatus {
    const setupCompleted = this.options.credentials.hasCredential();

    return {
      setupCompleted,
      authenticated: setupCompleted && this.authenticate(token)
    };
  }

  authenticate(token: string | null): boolean {
    if (!token) {
      return false;
    }

    const sessionHash = hashSessionToken(token);
    const session = this.options.sessions.findByHash(sessionHash);
    if (!session) {
      return false;
    }

    const now = this.now();
    if (session.expiresAt <= now) {
      this.options.sessions.deleteByHash(sessionHash);
      return false;
    }

    this.options.sessions.touchSession(session.id, now);
    return true;
  }

  logout(token: string | null): void {
    if (!token) {
      return;
    }

    this.options.sessions.deleteByHash(hashSessionToken(token));
  }

  deleteExpiredSessions(): void {
    this.options.sessions.deleteExpired(this.now());
  }

  private createSession(meta: AuthRequestMeta, now: number): AuthSessionResult {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
    const expiresAt = now + SESSION_DURATION_MS;

    this.options.sessions.createSession({
      id: `session_${randomBytes(16).toString("hex")}`,
      sessionHash: hashSessionToken(token),
      createdAt: now,
      expiresAt,
      userAgent: normalizeUserAgent(meta.userAgent),
      ipHash: meta.ip ? hashMetadata(meta.ip) : null
    });

    return {
      token,
      expiresAt
    };
  }
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await scryptBuffer(password, salt);

  return [
    "scrypt",
    "v1",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    String(SCRYPT_SALT_BYTES),
    String(SCRYPT_KEYLEN),
    salt.toString("base64url"),
    derived.toString("base64url")
  ].join(":");
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(storedHash);
  if (!parsed) {
    return false;
  }

  const derived = await scryptBuffer(password, parsed.salt);
  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
}

function parsePasswordHash(value: string): { salt: Buffer; hash: Buffer } | null {
  const parts = value.split(":");
  if (parts.length !== 9) {
    return null;
  }

  const [algo, version, n, r, p, saltBytes, keylen, salt, hash] = parts;
  if (
    algo !== "scrypt" ||
    version !== "v1" ||
    Number(n) !== SCRYPT_N ||
    Number(r) !== SCRYPT_R ||
    Number(p) !== SCRYPT_P ||
    Number(saltBytes) !== SCRYPT_SALT_BYTES ||
    Number(keylen) !== SCRYPT_KEYLEN
  ) {
    return null;
  }

  try {
    const saltBuffer = Buffer.from(salt, "base64url");
    const hashBuffer = Buffer.from(hash, "base64url");
    if (saltBuffer.length !== SCRYPT_SALT_BYTES || hashBuffer.length !== SCRYPT_KEYLEN) {
      return null;
    }
    return { salt: saltBuffer, hash: hashBuffer };
  } catch {
    return null;
  }
}

function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AuthServiceError(400, "VALIDATION_ERROR", "Password must be at least 8 characters", {
      field: "password",
      minLength: PASSWORD_MIN_LENGTH
    });
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new AuthServiceError(400, "VALIDATION_ERROR", "Password is too long", {
      field: "password",
      maxLength: PASSWORD_MAX_LENGTH
    });
  }
}

function validatePasswordLengthForLogin(password: string): void {
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new AuthServiceError(400, "VALIDATION_ERROR", "Password is too long", {
      field: "password",
      maxLength: PASSWORD_MAX_LENGTH
    });
  }
}

function scryptBuffer(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

function normalizeUserAgent(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 512) : null;
}

function hashMetadata(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
