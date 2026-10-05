/**
 * Shared-secret check for machine callers (Discord bot, Gmail script, cron).
 * Without INGEST_SECRET, only local development requests are accepted.
 */
export function authorized(req: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  const url = new URL(req.url);
  const header = req.headers.get("x-ingest-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret || url.searchParams.get("key") === secret;
}

export const unauthorized = () =>
  Response.json({ error: "Missing or wrong secret. Send INGEST_SECRET in the x-ingest-secret header." }, { status: 401 });
