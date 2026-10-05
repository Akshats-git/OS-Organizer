import { revalidatePath } from "next/cache";
import { authorized, unauthorized } from "@/lib/auth";
import { getRepoList } from "@/lib/data";
import { ingestItem, ingestSchema } from "@/lib/ingest";

/** Receives forwarded Discord messages and labelled Gmail threads. */
export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();
  const parsed = ingestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  const { item, suggestion } = await ingestItem(parsed.data);
  const repos = (await getRepoList()).map(({ repo, org }) => ({ id: repo.id, code: repo.code, name: `${repo.owner}/${repo.name}`, org: org.name, workflow: repo.workflow }));
  revalidatePath("/", "layout");
  return Response.json({ item: { id: item.id, title: item.title }, suggestion: suggestion ? { id: suggestion.id, name: `${suggestion.owner}/${suggestion.name}` } : null, repos });
}
