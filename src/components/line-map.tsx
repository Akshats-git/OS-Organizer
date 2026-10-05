"use client";

import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Loop, Org, Repo, Stage } from "@/db/schema";
import { lineVar, onLineVar } from "@/lib/lines";
import { loopStatus } from "@/lib/loop-status";
import { ALL_STATIONS, STATION_LABELS, WORKFLOW_STATIONS } from "@/lib/stages";
import { LineBullet } from "./line-bullet";

export type MapLine = {
  repo: Repo;
  org: Org;
  active: Loop[];
  merged: number;
  presence: { label: string };
};

const X = (s: Stage) => ((ALL_STATIONS.indexOf(s) + 0.5) / ALL_STATIONS.length) * 100;
const EASE = [0.22, 1, 0.36, 1] as const;

function useLoopHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (id: number) => {
    const next = new URLSearchParams(params);
    next.set("loop", String(id));
    return `${pathname}?${next.toString()}`;
  };
}

/** The network map: every repo is a line, every stage a station, every loop a train. */
export function LineMap({ lines, animate = true }: { lines: MapLine[]; animate?: boolean }) {
  const loopHref = useLoopHref();
  return (
    <>
      <DesktopMap lines={lines} animate={animate} loopHref={loopHref} />
      <MobileMap lines={lines} loopHref={loopHref} />
    </>
  );
}

function DesktopMap({ lines, animate, loopHref }: { lines: MapLine[]; animate: boolean; loopHref: (id: number) => string }) {
  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-[minmax(170px,210px)_minmax(0,1fr)_84px] gap-x-6 border-b border-rule pb-3">
        <span className="text-xs font-semibold text-ink-3">Line</span>
        <div className="relative h-5">
          {ALL_STATIONS.map((s) => (
            <span key={s} className="type-display absolute top-0 -translate-x-1/2 text-[0.9375rem] text-ink-2" style={{ left: `${X(s)}%` }}>
              {STATION_LABELS[s]}
            </span>
          ))}
        </div>
        <span className="text-right text-xs font-semibold text-ink-3">Done</span>
      </div>
      <ol>
        {lines.map((line, row) => (
          <DesktopRow key={line.repo.id} line={line} row={row} animate={animate} loopHref={loopHref} />
        ))}
      </ol>
    </div>
  );
}

function DesktopRow({ line, row, animate, loopHref }: { line: MapLine; row: number; animate: boolean; loopHref: (id: number) => string }) {
  const { repo, org, active } = line;
  const stations = WORKFLOW_STATIONS[repo.workflow];
  const color = lineVar(repo.colorIndex);
  const start = X(stations[0]);
  const end = X("merged");
  const delay = animate ? row * 0.07 : 0;

  // Group trains by station; the first rides above the line, the second below.
  const byStation = new Map<Stage, Loop[]>();
  for (const l of active) byStation.set(l.stage, [...(byStation.get(l.stage) ?? []), l]);
  // A train may borrow the near half of an empty neighbouring station's column.
  // End stations anchor to the edge; middle stations stay centred, so they need both sides free.
  const roomFor = (stage: Stage, side: 0 | 1) => {
    const i = ALL_STATIONS.indexOf(stage);
    const free = (j: number) => j >= 0 && j < ALL_STATIONS.length && (byStation.get(ALL_STATIONS[j]) ?? []).length <= side;
    if (i === 0) return free(1) ? 20 : 10;
    if (i === ALL_STATIONS.length - 1) return free(i - 1) ? 20 : 10;
    return (free(i - 1) && free(i + 1) ? 40 : 20) - 2;
  };
  const anchor = (stage: Stage) => (stage === "ask" ? "-18px" : stage === "merged" ? "calc(-100% + 18px)" : "-50%");

  return (
    <li className="grid min-h-[104px] grid-cols-[minmax(170px,210px)_minmax(0,1fr)_84px] items-center gap-x-6 border-b border-rule last:border-b-0">
      <Link href={`/repos/${repo.slug}`} className="group flex min-w-0 items-center gap-3 py-4">
        <LineBullet code={repo.code} colorIndex={repo.colorIndex} size="lg" />
        <span className="min-w-0">
          <span className="block truncate type-display text-lg group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{repo.name}</span>
          <span className="block truncate text-xs text-ink-3">{org.name}</span>
        </span>
      </Link>

      <div className="relative h-[104px]">
        {/* Track bed shows stops this repo's workflow skips. */}
        <span className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-rule" style={{ left: `${X("ask")}%`, right: `${100 - end}%` }} />
        {ALL_STATIONS.filter((s) => !stations.includes(s)).map((s) => (
          <span key={s} className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rule-strong" style={{ left: `${X(s)}%` }} />
        ))}

        <motion.span
          className="absolute top-1/2 h-[6px] origin-left rounded-full"
          style={{ left: `${start}%`, width: `${end - start}%`, background: color, translateY: "-50%" }}
          initial={animate ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.75, delay, ease: EASE }}
        />

        {stations.map((s, i) => {
          const occupied = byStation.has(s);
          const terminus = s === "merged";
          return (
            <motion.span
              key={s}
              className={clsx(
                "absolute top-1/2 grid place-items-center rounded-full",
                occupied ? "size-[22px] border-[4px]" : terminus ? "size-[20px] border-[5px]" : "size-[16px] border-[3.5px]",
              )}
              style={{ left: `${X(s)}%`, x: "-50%", y: "-50%", borderColor: color, background: "var(--panel)" }}
              initial={animate ? { scale: 0 } : false}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 26, delay: delay + 0.12 + (i / stations.length) * 0.55 }}
            >
              {occupied && <span className="size-2 rounded-full bg-ink" />}
            </motion.span>
          );
        })}

        {[...byStation.entries()].flatMap(([stage, loops]) =>
          loops.slice(0, 2).map((l, i) => {
            const status = loopStatus(l, repo);
            const extra = i === 1 && loops.length > 2 ? loops.length - 2 : 0;
            return (
              <motion.div
                key={l.id}
                layoutId={`train-d-${l.id}`}
                className={clsx("absolute z-10", i === 0 ? "bottom-[calc(50%+16px)]" : "top-[calc(50%+16px)]")}
                style={{ left: `${X(stage)}%`, x: anchor(stage), maxWidth: `${roomFor(stage, i as 0 | 1)}%` }}
                initial={animate ? { opacity: 0, y: i === 0 ? 6 : -6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ layout: { type: "spring", stiffness: 260, damping: 30 }, opacity: { delay: delay + 0.6, duration: 0.25 }, y: { delay: delay + 0.6, duration: 0.3, ease: EASE } }}
              >
                <Link
                  href={loopHref(l.id)}
                  scroll={false}
                  title={`${l.title}. ${status.label}`}
                  className="flex max-w-full items-center gap-1.5 rounded-full py-1 pl-2.5 pr-3 text-xs font-semibold shadow-[0_1px_0_rgb(0_0_0/0.12)] transition-transform duration-150 hover:-translate-y-px"
                  style={{ background: color, color: onLineVar(repo.colorIndex) }}
                >
                  {status.tone === "urgent" && <TriangleAlert className="size-3.5 shrink-0" strokeWidth={2.5} aria-label="Needs attention" />}
                  <span className="truncate">{l.title}</span>
                  {extra > 0 && <span className="rounded-full bg-black/15 px-1.5">+{extra}</span>}
                </Link>
              </motion.div>
            );
          }),
        )}
      </div>

      <div className="text-right">
        <span className="numerals block text-2xl leading-none">{line.merged}</span>
        <span className="text-xs text-ink-3">{line.presence.label}</span>
      </div>
    </li>
  );
}

function MobileMap({ lines, loopHref }: { lines: MapLine[]; loopHref: (id: number) => string }) {
  return (
    <ol className="space-y-4 md:hidden">
      {lines.map(({ repo, org, active, merged, presence }) => {
        const stations = WORKFLOW_STATIONS[repo.workflow];
        const color = lineVar(repo.colorIndex);
        return (
          <li key={repo.id} className="panel overflow-hidden">
            <Link href={`/repos/${repo.slug}`} className="flex items-center gap-3 border-b border-rule px-4 py-3">
              <LineBullet code={repo.code} colorIndex={repo.colorIndex} />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-display text-lg">{repo.name}</span>
                <span className="block truncate text-xs text-ink-3">{org.name}</span>
              </span>
              <span className="text-right">
                <span className="numerals block text-lg leading-none">{merged}</span>
                <span className="text-[0.6875rem] text-ink-3">merged, {presence.label.toLowerCase()}</span>
              </span>
            </Link>
            <ol className="relative px-4 py-3">
              <span className="absolute bottom-[26px] left-[27px] top-[26px] w-[5px] rounded-full" style={{ background: color }} />
              {stations.map((s) => {
                const here = active.filter((l) => l.stage === s);
                return (
                  <li key={s} className="relative flex min-h-[38px] items-start gap-3 py-1.5">
                    <span
                      className={clsx("relative z-[1] mt-[3px] grid shrink-0 place-items-center rounded-full", here.length ? "ml-[1px] size-[20px] border-4" : "ml-[3px] size-4 border-[3.5px]")}
                      style={{ borderColor: color, background: "var(--panel)" }}
                    >
                      {here.length > 0 && <span className="size-1.5 rounded-full bg-ink" />}
                    </span>
                    <span className={clsx("type-display w-[68px] shrink-0 pt-px text-[0.9375rem]", here.length ? "text-ink" : "text-ink-3")}>{STATION_LABELS[s]}</span>
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      {here.map((l) => {
                        const status = loopStatus(l, repo);
                        return (
                          <motion.span key={l.id} layoutId={`train-m-${l.id}`} className="max-w-full">
                            <Link href={loopHref(l.id)} scroll={false} className="flex max-w-full items-center gap-1.5 rounded-full py-1 pl-2.5 pr-3 text-xs font-semibold" style={{ background: color, color: onLineVar(repo.colorIndex) }}>
                              {status.tone === "urgent" && <TriangleAlert className="size-3.5 shrink-0" strokeWidth={2.5} aria-label="Needs attention" />}
                              <span className="truncate">{l.title}</span>
                            </Link>
                          </motion.span>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}
