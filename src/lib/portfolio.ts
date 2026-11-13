import type { PortfolioRepo } from "./data";

export type PortfolioTotals = {
  opened: number; merged: number; open: number; reviews: number; issues: number; repos: number; orgs: number;
  languages: { name: string; prs: number }[];
};

export function totals(repos: PortfolioRepo[]): PortfolioTotals {
  const active = repos.filter((r) => r.prs.length || r.reviews || r.issues || r.helped);
  const prs = repos.flatMap((r) => r.prs);
  const lang = new Map<string, number>();
  for (const r of repos) if (r.language && r.prs.length) lang.set(r.language, (lang.get(r.language) ?? 0) + r.prs.length);
  return {
    opened: prs.length,
    merged: prs.filter((p) => p.status === "merged").length,
    open: prs.filter((p) => p.status === "open").length,
    reviews: repos.reduce((n, r) => n + r.reviews, 0),
    issues: repos.reduce((n, r) => n + r.issues, 0),
    repos: active.length,
    orgs: new Set(active.map((r) => r.orgName)).size,
    languages: [...lang].map(([name, n]) => ({ name, prs: n })).sort((a, b) => b.prs - a.prs),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cell = (s: string) => s.replace(/\|/g, "\\|");

/** A proposal-ready write-up of everything in the portfolio. */
export function portfolioMarkdown(repos: PortfolioRepo[]): string {
  const t = totals(repos);
  const lines: string[] = ["## Open source contributions", ""];
  if (!t.opened && !t.reviews && !t.issues) return lines.concat("No contributions yet.").join("\n");
  const parts = [`${plural(t.opened, "pull request")} (${t.merged} merged)`];
  if (t.issues) parts.push(plural(t.issues, "issue"));
  if (t.reviews) parts.push(`${plural(t.reviews, "review")} of other people's pull requests`);
  lines.push(`Across ${plural(t.repos, "repository", "repositories")} in ${plural(t.orgs, "organization")}, I have opened ${parts.join(", ")}.`);
  if (t.languages.length) lines.push("", `Languages: ${t.languages.map((l) => l.name).join(", ")}.`);

  const byOrg = new Map<string, PortfolioRepo[]>();
  for (const r of repos) if (r.prs.length) byOrg.set(r.orgName, [...(byOrg.get(r.orgName) ?? []), r]);
  for (const [org, list] of byOrg) {
    lines.push("", `### ${org}`, "", "| Contribution | Repository | Pull request | Status |", "| --- | --- | --- | --- |");
    for (const r of list) {
      for (const p of r.prs) {
        const status = p.status === "merged" ? "Merged" : p.status === "open" ? "Open" : "Closed";
        lines.push(`| ${cell(p.title)} | ${r.owner}/${r.name} | [#${p.number}](${p.url}) | ${status} |`);
      }
    }
  }
  return lines.join("\n");
}
