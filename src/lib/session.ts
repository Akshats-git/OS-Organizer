/**
 * Single-user login. The session cookie is `<expiry>.<hmac>`, signed with
 * SESSION_SECRET plus APP_PASSWORD, so changing the password signs out every device.
 * Without APP_PASSWORD, development stays open and production stays locked.
 */
export const SESSION_COOKIE = "oso_session";
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer) {
  return Buffer.from(bytes).toString("base64url");
}

async function hmac(key: string, data: string) {
  const k = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(await crypto.subtle.sign("HMAC", k, encoder.encode(data)));
}

/** Compare by HMAC so the comparison time doesn't depend on where strings differ. */
async function safeEqual(a: string, b: string) {
  const key = crypto.randomUUID();
  return (await hmac(key, a)) === (await hmac(key, b));
}

export type AuthMode = "open" | "locked" | "password";

export function authMode(): AuthMode {
  if (process.env.APP_PASSWORD && process.env.SESSION_SECRET) return "password";
  return process.env.NODE_ENV === "development" ? "open" : "locked";
}

const signingKey = () => `${process.env.SESSION_SECRET}:${process.env.APP_PASSWORD}`;

export async function checkPassword(input: string) {
  return authMode() === "password" && (await safeEqual(input, process.env.APP_PASSWORD!));
}

export async function createSession() {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  return `${expires}.${await hmac(signingKey(), String(expires))}`;
}

export async function verifySession(token: string | undefined) {
  const mode = authMode();
  if (mode === "open") return true;
  if (mode === "locked" || !token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, await hmac(signingKey(), expires));
}

/** Only same-site paths, so `?next=` can't bounce you to another site. */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
