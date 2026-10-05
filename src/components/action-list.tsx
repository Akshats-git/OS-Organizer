"use client";

import clsx from "clsx";
import { Check, Clock, Compass, Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Action, Tone, Waiting } from "@/lib/next-actions";
import { LineBullet } from "./line-bullet";
import { useToast } from "./toast";

export type RepoChip = { id: number; code: string; colorIndex: number; name: string };

const GROUPS: { tone: Tone; title: string; icon: typeof Clock; style: string }[] = [
  { tone: "urgent", title: "Now", icon: TriangleAlert, style: "text-urgent" },
  { tone: "soon", title: "This week", icon: Clock, style: "text-soon" },
  { tone: "nudge", title: "When you have time", icon: Compass, style: "text-ink-2" },
];

export function ActionList({ actions, repos, ages }: { actions: Action[]; repos: RepoChip[]; ages: Record<string, string> }) {
  const byId = new Map(repos.map((r) => [r.id, r]));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = actions.filter((a) => !hidden.has(a.id));

  if (visible.length === 0) {
    return (
      <div className="panel flex items-center gap-4 px-5 py-6">
        <span className="grid size-10 place-items-center rounded-full bg-ok-bg text-ok">
          <Check className="size-5" strokeWidth={2.5} />
        </span>
        <div>
          <p className="font-semibold">Nothing needs you right now.</p>
          <p className="text-sm text-ink-2">Every loop is moving or waiting on maintainers. A good time to review someone else’s PR.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {GROUPS.map(({ tone, title, icon: Icon, style }) => {
        const items = visible.filter((a) => a.tone === tone);
        if (!items.length) return null;
        return (
          <section key={tone} aria-labelledby={`group-${tone}`}>
            <h2 id={`group-${tone}`} className={clsx("mb-3 flex items-center gap-2 text-sm font-semibold", style)}>
              <Icon className="size-4" strokeWidth={2.25} />
              {title}
              <span className="numerals text-ink-3">{items.length}</span>
            </h2>
            <ul className="panel divide-y divide-rule overflow-hidden">
              <AnimatePresence initial={false}>
                {items.map((a) => (
                  <ActionRow key={a.id} action={a} repo={byId.get(a.repoId)} since={a.since ? ages[a.id] : undefined} onDone={() => setHidden((h) => new Set(h).add(a.id))} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ActionRow({ action: a, repo, since, onDone }: { action: Action; repo?: RepoChip; since?: string; onDone: () => void }) {
  const toast = useToast();
  const pathname = usePathname();
  const external = a.href?.startsWith("http");

  const copy = async () => {
    if (!a.draft) return;
    try {
      await navigator.clipboard.writeText(a.draft);
      toast("Copied. Paste it in the thread, then open the link.");
    } catch {
      toast("Couldn’t reach the clipboard. Select the text in the loop panel instead.", "error");
    }
  };

  return (
    <motion.li
      layout
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <div className="flex min-w-0 flex-1 gap-3.5">
        {repo ? <LineBullet code={repo.code} colorIndex={repo.colorIndex} className="mt-0.5" /> : <span className="size-7 shrink-0" />}
        <div className="min-w-0">
          {a.loopId ? (
            <Link href={`${pathname}?loop=${a.loopId}`} scroll={false} className="font-semibold hover:underline hover:decoration-rule-strong hover:underline-offset-4">
              {a.title}
            </Link>
          ) : (
            <p className="font-semibold">{a.title}</p>
          )}
          <p className="mt-0.5 text-sm text-ink-2">{a.detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-[42px] sm:pl-0">
        {since && <span className="numerals mr-1 w-10 text-right text-sm text-ink-3" title="Time since this started">{since}</span>}
        {a.draft && (
          <button onClick={copy} className="btn btn-quiet">
            <Copy className="size-3.5" /> Copy message
          </button>
        )}
        {a.href && (external ? (
          <a href={a.href} target="_blank" rel="noreferrer" className={clsx("btn", a.draft ? "btn-ghost" : "btn-quiet")} aria-label={a.draft ? "Open link" : undefined}>
            {a.draft ? <ExternalLink className="size-4" /> : <>{a.cta} <ExternalLink className="size-3.5" /></>}
          </a>
        ) : (
          <Link href={a.href} className="btn btn-quiet">{a.cta}</Link>
        ))}
        <button onClick={onDone} className="btn btn-ghost" aria-label="Hide until next visit" title="Hide until next visit">
          <Check className="size-4" />
        </button>
      </div>
    </motion.li>
  );
}

export function WaitingList({ items, repos, ages }: { items: Waiting[]; repos: RepoChip[]; ages: Record<string, string> }) {
  const pathname = usePathname();
  const byId = new Map(repos.map((r) => [r.id, r]));
  if (!items.length) return <p className="text-sm text-ink-3">Nothing is waiting on maintainers.</p>;
  return (
    <ul className="divide-y divide-rule">
      {items.map((w) => {
        const repo = byId.get(w.repoId);
        return (
          <li key={w.id}>
            <Link href={`${pathname}?loop=${w.loopId}`} scroll={false} className="flex items-center gap-3 py-3 transition-colors hover:bg-panel-2/60 sm:px-2">
              {repo && <LineBullet code={repo.code} colorIndex={repo.colorIndex} size="sm" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{w.title}</span>
                <span className="block text-xs text-ink-3">{w.detail}</span>
              </span>
              <span className="numerals text-sm text-ink-3">{ages[w.id]}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
