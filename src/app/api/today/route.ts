import { authorized, unauthorized } from "@/lib/auth";
import { getNetwork } from "@/lib/data";

/** The Today list in plain JSON, for the Discord bot's /today command and digests. */
export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  const { lines, actions, waiting } = await getNetwork();
  const name = (id: number) => {
    const l = lines.find((x) => x.repo.id === id);
    return l ? { code: l.repo.code, repo: `${l.repo.owner}/${l.repo.name}` } : null;
  };
  return Response.json({
    actions: actions.map((a) => ({ tone: a.tone, title: a.title, detail: a.detail, href: a.href, repo: name(a.repoId) })),
    waiting: waiting.map((w) => ({ title: w.title, detail: w.detail, since: w.since, repo: name(w.repoId) })),
  });
}
