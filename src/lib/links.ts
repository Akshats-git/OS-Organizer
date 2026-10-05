export type ParsedLink =
  | { kind: "github-issue" | "github-pr"; owner: string; repo: string; number: number; url: string }
  | { kind: "github-repo"; owner: string; repo: string; url: string }
  | { kind: "discord-message"; guildId: string; channelId: string; messageId: string; url: string };

const GH = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(issues|pull)\/(\d+))?/i;
const DISCORD = /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)/i;

export function parseLink(input: string): ParsedLink | null {
  const text = input.trim();
  const d = text.match(DISCORD);
  if (d) return { kind: "discord-message", guildId: d[1], channelId: d[2], messageId: d[3], url: d[0] };
  const g = text.match(GH);
  if (g) {
    const [, owner, rawRepo, type, num] = g;
    const repo = rawRepo.replace(/\.git$/, "");
    if (type && num) {
      return { kind: type === "pull" ? "github-pr" : "github-issue", owner, repo, number: Number(num), url: g[0] };
    }
    return { kind: "github-repo", owner, repo, url: `https://github.com/${owner}/${repo}` };
  }
  return null;
}

export function findLinks(text: string): ParsedLink[] {
  const out: ParsedLink[] = [];
  for (const m of text.matchAll(/https?:\/\/\S+/g)) {
    const p = parseLink(m[0]);
    if (p) out.push(p);
  }
  return out;
}

/** "[owner/repo]" — how GitHub notification emails tag their subject. */
export function repoFromSubject(subject: string): { owner: string; repo: string } | null {
  const m = subject.match(/\[([\w.-]+)\/([\w.-]+)\]/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export const ghUrl = (owner: string, name: string, path = "") => `https://github.com/${owner}/${name}${path}`;
