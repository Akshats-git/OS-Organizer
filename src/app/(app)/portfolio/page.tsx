import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LineBullet } from "@/components/line-bullet";
import { PortfolioExport } from "@/components/portfolio-export";
import { getPortfolio } from "@/lib/data";
import { portfolioMarkdown, totals } from "@/lib/portfolio";
import { age, formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Portfolio" };

const KIND_LABEL: Record<string, string> = { pr: "Opened PR", merged: "Merged", issue: "Opened issue", "review-given": "Reviewed", help: "Helped" };

export default async function PortfolioPage() {
  await connection();
  const { repos, history } = await getPortfolio();
  const t = totals(repos);
  const stats = [
    { label: "PRs opened", value: t.opened },
    { label: "Merged", value: t.merged },
    { label: "Open now", value: t.open },
    { label: "Issues opened", value: t.issues },
    { label: "Reviews given", value: t.reviews },
    { label: "Repos", value: t.repos },
  ];
  const withWork = repos.filter((r) => r.prs.length || r.reviews || r.issues || r.helped);

  return (
    <>
      <header className="mb-9">
        <h1 className="type-display text-[2.5rem] leading-none sm:text-[3.25rem]">Portfolio</h1>
        <p className="mt-3 max-w-[60ch] text-lg text-ink-2">
          Everything you have contributed across {t.orgs} organization{t.orgs === 1 ? "" : "s"}, ready for a proposal.
        </p>
        <div className="mt-5">
          <PortfolioExport markdown={portfolioMarkdown(repos)} />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel px-4 py-4">
            <dd className="numerals text-[2rem] leading-none">{s.value}</dd>
            <dt className="mt-1.5 text-xs text-ink-3">{s.label}</dt>
          </div>
        ))}
      </dl>

      {t.languages.length > 0 && (
        <section className="mt-10" aria-labelledby="lang-title">
          <h2 id="lang-title" className="mb-3 text-sm font-semibold text-ink-2">Languages</h2>
          <ul className="flex flex-wrap gap-2">
            {t.languages.map((l) => (
              <li key={l.name} className="chip border border-rule-strong text-sm">
                {l.name} <span className="numerals ml-1.5 text-ink-3">{l.prs}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="repos-title" className="min-w-0">
          <h2 id="repos-title" className="type-display mb-4 text-2xl">By repository</h2>
          {withWork.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing yet. Merged PRs, issues and reviews will collect here after a GitHub sync.</p>
          ) : (
            <ul className="space-y-6">
              {withWork.map((r) => (
                <li key={r.repoId}>
                  <Link href={`/repos/${r.slug}`} className="flex items-center gap-3 hover:underline hover:decoration-rule-strong hover:underline-offset-4">
                    <LineBullet code={r.code} colorIndex={r.colorIndex} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.owner}/{r.name}</span>
                    {r.language && <span className="text-xs text-ink-3">{r.language}</span>}
                  </Link>
                  <p className="mt-0.5 pl-9 text-xs text-ink-3">
                    {r.orgName} · {r.prs.length} PR{r.prs.length === 1 ? "" : "s"}
                    {r.issues ? ` · ${r.issues} issue${r.issues === 1 ? "" : "s"}` : ""}
                    {r.reviews ? ` · ${r.reviews} review${r.reviews === 1 ? "" : "s"}` : ""}
                  </p>
                  {r.prs.length > 0 && (
                    <ul className="mt-2 divide-y divide-rule pl-9 text-sm">
                      {r.prs.map((p) => (
                        <li key={p.number} className="flex items-baseline gap-3 py-1.5">
                          <a href={p.url} target="_blank" rel="noreferrer" className="link min-w-0 flex-1 truncate">#{p.number} {p.title}</a>
                          <span className={p.status === "merged" ? "text-ok" : "text-ink-3"}>{p.status === "merged" ? "Merged" : p.status === "open" ? "Open" : "Closed"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="history-title" className="min-w-0">
          <h2 id="history-title" className="type-display mb-4 text-2xl">History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-ink-3">No activity yet.</p>
          ) : (
            <ol className="divide-y divide-rule">
              {history.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <LineBullet code={e.repo.code} colorIndex={e.repo.colorIndex} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-3">{KIND_LABEL[e.kind] ?? e.kind} · {e.repo.name}</span>
                    {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="link">{e.title}</a> : e.title}
                  </span>
                  <time dateTime={e.occurredAt} className="numerals shrink-0 text-xs text-ink-3" title={formatDate(e.occurredAt, { month: "short", day: "numeric", year: "numeric" })}>
                    {age(e.occurredAt)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
