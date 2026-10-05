"use client";

import clsx from "clsx";
import { Ban, Check, ExternalLink, TriangleAlert, Undo2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { advanceLoop, clearCollision, moveLoopBack, setLoopStatus, updateLoop } from "@/app/actions";
import type { Event, Loop, Repo } from "@/db/schema";
import { ghUrl } from "@/lib/links";
import { loopStatus } from "@/lib/loop-status";
import { ADVANCE_VERB, nextStage, STATION_LABELS } from "@/lib/stages";
import { age } from "@/lib/time";
import { LineBullet } from "./line-bullet";
import { MiniLine } from "./mini-line";
import { useAction } from "./use-action";

const TONE_STYLE = {
  urgent: "bg-urgent-bg text-urgent",
  soon: "bg-soon-bg text-soon",
  calm: "bg-panel-2 text-ink-2",
  done: "bg-ok-bg text-ok",
} as const;

export function LoopSheet({ loops, repos, events }: { loops: Loop[]; repos: Repo[]; events: Event[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = Number(params.get("loop"));
  const loop = loops.find((l) => l.id === id);
  const repo = loop ? repos.find((r) => r.id === loop.repoId) : undefined;
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("loop");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (!loop) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop?.id]);

  return (
    <AnimatePresence>
      {loop && repo && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-[rgb(12_18_27/0.4)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="loop-sheet-title"
            className={clsx(
              "absolute flex flex-col overflow-hidden bg-panel shadow-float outline-none",
              isMobile ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[20px]" : "inset-y-0 right-0 w-[min(460px,100vw)] border-l border-rule",
            )}
            initial={isMobile ? { y: "100%" } : { x: "100%" }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
          >
            <SheetBody key={loop.id} loop={loop} repo={repo} events={events.filter((e) => e.loopId === loop.id)} onClose={close} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SheetBody({ loop, repo, events, onClose }: { loop: Loop; repo: Repo; events: Event[]; onClose: () => void }) {
  const { run, pending } = useAction();
  const status = loopStatus(loop, repo);
  const to = nextStage(repo.workflow, loop.stage);
  const [title, setTitle] = useState(loop.title);
  const [approvedBy, setApprovedBy] = useState("");
  const [link, setLink] = useState("");
  const issueUrl = loop.issueNumber ? ghUrl(repo.owner, repo.name, `/issues/${loop.issueNumber}`) : null;
  const prUrl = loop.prNumber ? ghUrl(repo.owner, repo.name, `/pull/${loop.prNumber}`) : null;

  const linkPrompt =
    to === "approved" ? "Link to the approval message (optional)" : to === "issue" ? "Issue link or number" : to === "pr" ? "PR link or number" : null;

  return (
    <>
      {isMobileHandle()}
      <div className="flex items-center gap-3 border-b border-rule px-5 py-4">
        <LineBullet code={repo.code} colorIndex={repo.colorIndex} />
        <Link href={`/repos/${repo.slug}`} className="link min-w-0 flex-1 truncate text-sm font-semibold" onClick={onClose}>
          {repo.owner}/{repo.name}
        </Link>
        <button onClick={onClose} className="btn btn-ghost px-2" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
        <label htmlFor="loop-sheet-title" className="sr-only">Loop name</label>
        <input
          id="loop-sheet-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== loop.title && run(() => updateLoop(loop.id, { title }))}
          className="w-full rounded-md bg-transparent type-display text-2xl outline-none focus:bg-panel-2 focus:px-2"
        />
        <span className={clsx("chip mt-2", TONE_STYLE[status.tone])}>
          {status.tone === "urgent" && <TriangleAlert className="size-3" strokeWidth={2.5} />}
          {status.tone === "done" && <Check className="size-3" strokeWidth={3} />}
          {status.label}
        </span>

        <div className="mt-6">
          <MiniLine workflow={repo.workflow} colorIndex={repo.colorIndex} occupied={[loop.stage]} labels />
        </div>

        {loop.collisionUrl && (
          <div className="mt-6 rounded-[var(--radius-control)] border border-urgent/30 bg-urgent-bg p-4 text-sm">
            <p className="font-semibold text-urgent">Someone else opened a PR that references this issue.</p>
            <p className="mt-1 text-ink-2">Read it before writing more code. If it overlaps, ask the maintainer how they want to split the work.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={loop.collisionUrl} target="_blank" rel="noreferrer" className="btn btn-quiet">
                Open their PR <ExternalLink className="size-3.5" />
              </a>
              <button disabled={pending} onClick={() => run(() => clearCollision(loop.id))} className="btn btn-ghost">
                Mark as checked
              </button>
            </div>
          </div>
        )}

        {to && loop.status === "active" && (
          <form
            className="mt-7 space-y-3 rounded-[var(--radius-panel)] border border-rule bg-panel-2/60 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => advanceLoop(loop.id, { link, approvedBy }), () => (setLink(""), setApprovedBy("")));
            }}
          >
            <p className="text-sm text-ink-2">
              Next station: <span className="type-display text-base text-ink">{STATION_LABELS[to]}</span>
            </p>
            {to === "approved" && (
              <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Who approved it? e.g. @lena" className="field" aria-label="Who approved it" />
            )}
            {linkPrompt && <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={linkPrompt} className="field" aria-label={linkPrompt} />}
            <button type="submit" disabled={pending} className="btn btn-primary w-full">
              {ADVANCE_VERB[loop.stage]}
            </button>
          </form>
        )}

        <dl className="mt-7 divide-y divide-rule border-y border-rule text-sm">
          <Row label="Ask" value={loop.askUrl ? <a className="link" href={loop.askUrl} target="_blank" rel="noreferrer">Message</a> : null} meta={age(loop.askedAt)} />
          <Row label="Approved" value={loop.approvedBy ?? (loop.approvedAt ? "Yes" : null)} meta={age(loop.approvedAt)} href={loop.approvalUrl} />
          <Row label="Issue" value={loop.issueNumber ? `#${loop.issueNumber}` : null} meta={age(loop.issueAt)} href={issueUrl} />
          <Row label="PR" value={loop.prNumber ? `#${loop.prNumber}` : null} meta={age(loop.prAt)} href={prUrl} />
          {loop.stage === "pr" && (
            <Row
              label="Checks"
              value={loop.ciState === "success" ? "Passing" : loop.ciState === "failure" ? "Failing" : loop.ciState === "pending" ? "Running" : "Unknown"}
              meta={loop.hasConflict ? "Has conflicts" : ""}
            />
          )}
        </dl>

        {events.length > 0 && (
          <section className="mt-7">
            <h3 className="text-xs font-semibold text-ink-3">History</h3>
            <ol className="mt-2 space-y-2.5">
              {events.slice(0, 12).map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-[7px] size-2 shrink-0 rounded-full bg-rule-strong" />
                  <span className="min-w-0 flex-1">
                    {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="link">{e.title}</a> : e.title}
                  </span>
                  <span className="numerals shrink-0 text-xs text-ink-3">{age(e.occurredAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {loop.stage !== "ask" && loop.status === "active" && (
            <button disabled={pending} onClick={() => run(() => moveLoopBack(loop.id))} className="btn btn-quiet">
              <Undo2 className="size-4" /> Move back a station
            </button>
          )}
          {loop.status === "active" ? (
            <button disabled={pending} onClick={() => run(() => setLoopStatus(loop.id, "dropped"), onClose)} className="btn btn-ghost text-urgent hover:text-urgent">
              <Ban className="size-4" /> Drop this loop
            </button>
          ) : (
            <button disabled={pending} onClick={() => run(() => setLoopStatus(loop.id, "active"))} className="btn btn-quiet">
              Restore
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function isMobileHandle() {
  return <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-rule-strong md:hidden" />;
}

function Row({ label, value, meta, href }: { label: string; value: React.ReactNode; meta?: string; href?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <dt className="type-display w-20 shrink-0 text-[0.9375rem] text-ink-2">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">
        {value ? (href ? <a href={href} target="_blank" rel="noreferrer" className="link">{value}</a> : value) : <span className="text-ink-3">Not yet</span>}
      </dd>
      {meta && <span className="numerals shrink-0 text-xs text-ink-3">{meta}</span>}
    </div>
  );
}
