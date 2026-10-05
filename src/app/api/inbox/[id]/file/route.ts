import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorized, unauthorized } from "@/lib/auth";
import { fileItem } from "@/lib/ingest";

const body = z.object({ repoId: z.number().int(), as: z.enum(["ask", "approval", "note"]) });

export async function POST(req: Request, ctx: RouteContext<"/api/inbox/[id]/file">) {
  if (!authorized(req)) return unauthorized();
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { repoId, as: 'ask' | 'approval' | 'note' }" }, { status: 400 });
  try {
    const message = await fileItem(Number(id), parsed.data.repoId, parsed.data.as);
    revalidatePath("/", "layout");
    return Response.json({ message });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}
