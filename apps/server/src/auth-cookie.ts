export const SESSION_COOKIE_NAME = "dibao_session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionCookieOptions = {
  secure: boolean;
};

export function readSessionCookie(cookieHeader: string | string[] | undefined): string | null {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (rawName !== SESSION_COOKIE_NAME) {
      continue;
    }

    const rawValue = rawValueParts.join("=");
    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function serializeSessionCookie(
  token: string,
  expiresAt: number,
  options: SessionCookieOptions
): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : [])
  ].join("; ");
}

export function serializeClearSessionCookie(options: SessionCookieOptions): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : [])
  ].join("; ");
}
