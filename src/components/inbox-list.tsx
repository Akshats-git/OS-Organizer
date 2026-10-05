"use client";

import clsx from "clsx";
import { ExternalLink, GitPullRequest, Mail, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { dismissInboxItem, fileInboxItem } from "@/app/actions";
import type { InboxItem } from "@/db/schema";
import type { FileAs } from "@/lib/ingest";
import { DiscordMark } from "./icons";
import { LineBullet } from "./line-bullet";
import { useAction } from "./use-action";

type RepoOption = { id: number; code: string; colorIndex: number; name: string; owner: string };

const SOURCE = {
  discord: { label: "Discord", icon: <DiscordMark className="size-4" /> },
  gmail: { label: "Gmail", icon: <Mail className="size-4" /> },
  github: { label: "GitHub", icon: <GitPullRequest className="size-4" /> },
} as const;

export function InboxList({ items, repos, ages }: { items: InboxItem[]; repos: RepoOption[]; ages: Record<number, string> }) {
  const fresh = items.filter((i) => i.status === "new");
  const filed = items.filter((i) => i.status === "filed").slice(0, 12);
  return (
    <>
      {fresh.length === 0 ? (
        <div className="panel px-6 py-8">
          <p className="type-display text-2xl">Inbox zero</p>
          <p className="mt-2 max-w-[56ch] text-ink-2">
            Forward a maintainer’s message to your bot’s inbox channel in Discord, or label an email <span className="font-semibold text-ink">os-organizer</span> in Gmail. It lands here, and you file it to the right line in one click.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {fresh.map((item) => (
              <InboxCard key={item.id} item={item} repos={repos} age={ages[item.id]} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {filed.length > 0 && (
        <section className="mt-12" aria-labelledby="filed-title">
          <h2 id="filed-title" className="mb-2 text-sm font-semibold text-ink-2">Recently filed</h2>
          <ul className="divide-y divide-rule">
            {filed.map((item) => {
              const repo = repos.find((r) => r.id === item.repoId);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="text-ink-3">{SOURCE[item.source].icon}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{item.title}</span>
                  {repo && <LineBullet code={repo.code} colorIndex={repo.colorIndex} size="sm" />}
                  <span className="numerals w-10 text-right text-xs text-ink-3">{ages[item.id]}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function InboxCard({ item, repos, age }: { item: InboxItem; repos: RepoOption[]; age: string }) {
  const [repoId, setRepoId] = useState<number | null>(item.repoId);
  const { run, pending } = useAction();
  const repo = repos.find((r) => r.id === repoId);
  const file = (as: FileAs) => repoId && run(() => fileInboxItem(item.id, repoId, as));
  const body = item.body && item.body !== item.title ? item.body : null;

  return (
    <motion.li layout exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }} className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-ink-3">
        <span className="text-ink-2">{SOURCE[item.source].icon}</span>
        <span className="font-semibold text-ink-2">{SOURCE[item.source].label}</span>
        {item.context && <span className="truncate">{item.context}</span>}
        <span className="numerals ml-auto shrink-0">{age}</span>
        <button disabled={pending} onClick={() => run(() => dismissInboxItem(item.id))} className="btn btn-ghost -mr-2 px-1.5" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-2 font-semibold leading-snug">{item.title}</p>
      {body && <p className="mt-1 line-clamp-3 text-sm text-ink-2">{body}</p>}
      {(item.author || item.url) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-3">
          {item.author && <span>{item.author}</span>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-ink-2">
              Open original <ExternalLink className="size-3" />
            </a>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          {repo ? <LineBullet code={repo.code} colorIndex={repo.colorIndex} size="sm" /> : <span className="size-5 rounded-full border-2 border-dashed border-rule-strong" />}
          <label className="sr-only" htmlFor={`repo-${item.id}`}>File under</label>
          <select
            id={`repo-${item.id}`}
            value={repoId ?? ""}
            onChange={(e) => setRepoId(e.target.value ? Number(e.target.value) : null)}
            className={clsx("field w-auto py-1.5", !repoId && "text-ink-3")}
          >
            <option value="">Choose a line</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.owner}/{r.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {(item.source === "discord"
            ? (["approval", "ask", "note"] as const)
            : (["note", "approval", "ask"] as const)
          ).map((as, i) => (
            <button key={as} disabled={!repoId || pending} onClick={() => file(as)} className={clsx("btn", i === 0 ? "btn-primary" : "btn-quiet")}>
              {as === "approval" ? "It’s an approval" : as === "ask" ? "It’s my ask" : "Save to timeline"}
            </button>
          ))}
        </div>
      </div>
    </motion.li>
  );
}
