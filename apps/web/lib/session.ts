import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "pakangers_organizer_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days -- "session persists on the device"

export type SessionPayload = {
  name: string;
  issuedAt: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET");
  return secret;
}

function sign(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (typeof payload?.name === "string" && typeof payload?.issuedAt === "number") {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Compares a submitted passcode against ORGANIZER_PASSCODE_HASH. Never compares plaintext. */
export async function verifyPasscode(passcode: string): Promise<boolean> {
  const hash = process.env.ORGANIZER_PASSCODE_HASH;
  if (!hash) throw new Error("Missing ORGANIZER_PASSCODE_HASH");
  return bcrypt.compare(passcode, hash);
}

/** Call only from a Server Action or Route Handler, after verifyPasscode succeeds. */
export async function createSession(name: string): Promise<void> {
  const token = sign({ name, issuedAt: Date.now() });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Read-only session check -- safe to call from Server Components and Server Actions alike. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

/**
 * Throws if there is no valid organizer session. Call this as the first line
 * of every admin Server Action -- per the Next.js docs, an action is a
 * reachable POST endpoint regardless of whether the UI that calls it is
 * gated, so authorization has to happen inside the action itself.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}
