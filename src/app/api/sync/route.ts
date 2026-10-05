import { revalidatePath } from "next/cache";
import { authorized, unauthorized } from "@/lib/auth";
import { runSync } from "@/lib/github";

/** Trigger a GitHub sync. Point a cron job (Vercel Cron, GitHub Actions, crontab) here. */
async function handle(req: Request) {
  if (!authorized(req)) return unauthorized();
  const result = await runSync();
  revalidatePath("/", "layout");
  return Response.json(result, { status: result.ok ? 200 : 502 });
}

export const GET = handle;
export const POST = handle;
