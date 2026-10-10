import { authorized, unauthorized } from "@/lib/auth";
import { buildBriefing } from "@/lib/briefing";

/**
 * The morning briefing as { empty, subject, text, html }. The Gmail Apps Script
 * fetches this once a day and mails it to you. Add ?format=html to preview it.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  const url = new URL(req.url);
  const appUrl = (process.env.APP_URL || url.origin).replace(/\/$/, "");
  const briefing = await buildBriefing(appUrl);
  if (url.searchParams.get("format") === "html") {
    return new Response(briefing.html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return Response.json(briefing);
}
